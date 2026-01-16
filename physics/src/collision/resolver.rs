// physics/src/engine/collision_resolver.rs
use glam::Vec3;
use crate::engine::state::PhysicsState;
use super::collider::MeshCollider;

#[derive(Clone, Copy)]
pub struct Contact {
    pub particle_index: usize,
    pub normal: Vec3,
    pub surface_point: Vec3,
}

pub struct CollisionResolver {
    thickness: f32,
    search_radius: f32,
    contacts: Vec<Contact>,
    query_buffer: Vec<usize>,
}

impl CollisionResolver {
    pub fn new() -> Self {
        Self {
            thickness: 0.008,
            search_radius: 0.05,
            contacts: Vec::with_capacity(3000),
            query_buffer: Vec::with_capacity(32),
        }
    }

    pub fn pre_solve(&mut self, state: &mut PhysicsState, collider: &MeshCollider, dt: f32) {
        self.contacts.clear();

        let max_v_per_step = self.thickness * 0.9;
        let max_v = max_v_per_step / dt;

        // Reusable buffer is already allocated in struct

        for i in 0..state.count {
            if state.inv_mass[i] == 0.0 { continue; }

            let pos = state.positions[i];

            // Optimization: Only check if moving or near body
            // (We skip the dist_sq check here to ensure we catch resting contacts)

            if let Some((surface_point, normal, _)) = collider.query_closest(pos, self.search_radius, &mut self.query_buffer) {

                // 1. Velocity Clamping (The "Airbag")
                let prev = state.prev_positions[i];
                let velocity = (pos - prev) / dt;
                let v_normal = velocity.dot(normal);

                if v_normal < -max_v {
                    let v_tangent = velocity - normal * v_normal;
                    let v_clamped = normal * -max_v;
                    let new_velocity = v_tangent + v_clamped;
                    state.prev_positions[i] = pos - new_velocity * dt;
                }

                self.contacts.push(Contact {
                    particle_index: i,
                    normal,
                    surface_point,
                });
            }
        }
    }

    pub fn resolve_contacts(&self, state: &mut PhysicsState) {
        for contact in &self.contacts {
            let i = contact.particle_index;
            let pos = state.positions[i];
            let normal = contact.normal;
            let surface_point = contact.surface_point;

            let vec = pos - surface_point;
            let projection = vec.dot(normal);

            // Check if we are interacting (Inside or Touching)
            if projection < self.thickness {

                // --- PHASE 4: BACK-FACE RECOVERY ---
                // If we are actually INSIDE (negative projection)
                if projection < 0.0 {
                    let prev = state.prev_positions[i];
                    let velocity = state.positions[i] - prev;

                    // Check if moving deeper into the body
                    if velocity.dot(normal) < 0.0 {
                        // HARD STOP: Kill all motion to prevent further tunneling.
                        // We reset prev_pos to current pos, effectively setting velocity to 0.
                        // The projection step below will then push it out safely.
                        state.prev_positions[i] = state.positions[i];
                    }

                    // Deep Penetration Rescue
                    // If we are deeper than 2x thickness, the springs might be pulling us in too hard.
                    // We perform a "Hard Snap" to the surface.
                    if projection < -self.thickness * 2.0 {
                        let snap_correction = normal * (self.thickness - projection);
                        state.positions[i] += snap_correction;
                        // Continue to next contact, we are done here.
                        continue;
                    }
                }
                // -----------------------------------

                // Standard Projection (The "Contact")
                let penetration = self.thickness - projection;
                let correction = normal * penetration;
                state.positions[i] += correction;

                // Friction
                let prev = state.prev_positions[i];
                let velocity = state.positions[i] - prev;

                let vn_mag = velocity.dot(normal);
                let vn = normal * vn_mag;
                let vt = velocity - vn;

                let is_horizontal = normal.y > 0.7;
                let friction = if is_horizontal { 1.0 } else { 0.1 };

                let new_vt = vt * (1.0 - friction);
                // Only kill normal velocity if moving in (standard bounce handling)
                let new_vn = if vn_mag < 0.0 { Vec3::ZERO } else { vn };

                state.prev_positions[i] = state.positions[i] - (new_vn + new_vt);
            }
        }
    }
}