// physics/src/engine/collision_resolver.rs
use glam::Vec3;
use crate::engine::state::PhysicsState;
use super::collider::MeshCollider;

pub struct CollisionResolver {
    thickness: f32,
    search_radius: f32,
}

impl CollisionResolver {
    pub fn new() -> Self {
        Self {
            thickness: 0.008,    // 8mm skin offset
            search_radius: 0.05, // 5cm search range
        }
    }

    /// PHASE 1: Velocity Clamping (The "Airbag")
    /// Run this ONCE before the solver loop.
    pub fn pre_solve(&self, state: &mut PhysicsState, collider: &MeshCollider, dt: f32) {
        let max_v_per_step = self.thickness * 0.9;
        let max_v = max_v_per_step / dt;

        for i in 0..state.count {
            if state.inv_mass[i] == 0.0 { continue; }

            let pos = state.positions[i];
            let prev = state.prev_positions[i];

            // Optimization: Only check if moving fast
            let dist_sq = pos.distance_squared(prev);
            if dist_sq < 1e-6 { continue; }

            if let Some((_, normal, _)) = collider.query_closest(pos, self.search_radius) {
                let velocity = (pos - prev) / dt;
                let v_normal = velocity.dot(normal);

                if v_normal < -max_v {
                    // Clamp velocity to prevent tunneling
                    let v_tangent = velocity - normal * v_normal;
                    let v_clamped = normal * -max_v;
                    let new_velocity = v_tangent + v_clamped;

                    state.prev_positions[i] = pos - new_velocity * dt;
                }
            }
        }
    }

    /// PHASE 2: Position Projection (The "Contact")
    /// Run this INSIDE the solver loop (Interleaved).
    pub fn resolve_position(&self, state: &mut PhysicsState, collider: &MeshCollider, _dt: f32) {
        for i in 0..state.count {
            if state.inv_mass[i] == 0.0 { continue; }

            let pos = state.positions[i];

            // 1. Query Geometric Data
            // We ignore the 'dist' returned by the query because it is unsigned (always positive).
            // We calculate our own signed distance using the dot product.
            if let Some((surface_point, normal, _)) = collider.query_closest(pos, self.search_radius) {

                // Vector from surface to particle
                let vec = pos - surface_point;

                // Dot product determines "Side-ness"
                // > 0: In front of face (Outside)
                // < 0: Behind face (Inside)
                let projection = vec.dot(normal);

                // We want the particle to be at least 'thickness' away from the surface.
                // So if projection < thickness, we are either touching or inside.
                if projection < self.thickness {

                    // A. Position Correction
                    // Calculate how deep we are (penetration depth)
                    // If projection is -0.5 (inside) and thickness is 0.1, penetration is 0.6.
                    // If projection is 0.05 (touching) and thickness is 0.1, penetration is 0.05.
                    let penetration = self.thickness - projection;

                    // Push along the normal
                    let correction = normal * penetration;
                    state.positions[i] += correction;

                    // B. Friction (Impulse based)
                    // We update prev_pos immediately so the next iteration "knows" we stopped.
                    let prev = state.prev_positions[i];
                    let velocity = state.positions[i] - prev;

                    // Decompose velocity relative to the collision normal
                    let vn_mag = velocity.dot(normal); // Normal velocity (bouncing)
                    let vn = normal * vn_mag;
                    let vt = velocity - vn;            // Tangent velocity (sliding)

                    // Shoulder Friction (Sticky Shoulders)
                    // If normal points up (> 0.7), we apply max friction to hold the shirt up.
                    let is_horizontal = normal.y > 0.7;
                    let friction = if is_horizontal { 1.0 } else { 0.1 };

                    // Apply Friction to Tangent
                    let new_vt = vt * (1.0 - friction);

                    // Kill Normal velocity ONLY if moving into the body.
                    // If moving away (bouncing), let it keep some energy (optional),
                    // but for cloth, we usually kill it to prevent jitter.
                    let new_vn = if vn_mag < 0.0 { Vec3::ZERO } else { vn };

                    // Reconstruct previous position to reflect the new velocity
                    state.prev_positions[i] = state.positions[i] - (new_vn + new_vt);
                }
            }
        }
    }
}