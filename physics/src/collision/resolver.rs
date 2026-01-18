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
    // NEW: Friction Coefficients
    pub static_friction: f32,
    pub dynamic_friction: f32,
}

impl CollisionResolver {
    pub fn new() -> Self {
        Self {
            thickness: 0.008,
            search_radius: 0.05,
            contacts: Vec::with_capacity(3000),
            query_buffer: Vec::with_capacity(32),
            // Cotton on Skin approx values
            static_friction: 0.6,
            dynamic_friction: 0.4,
        }
    }

    pub fn pre_solve(&mut self, state: &mut PhysicsState, collider: &MeshCollider, dt: f32) {
        self.contacts.clear();

        let max_v_per_step = self.thickness * 0.9;
        let max_v = max_v_per_step / dt;

        for i in 0..state.count {
            if state.inv_mass[i] == 0.0 { continue; }

            let pos = state.positions[i];

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

    // CHANGED: Added 'dt' parameter
    pub fn resolve_contacts(&self, state: &mut PhysicsState, _dt: f32) {
        for contact in &self.contacts {
            let i = contact.particle_index;
            let pos = state.positions[i];
            let normal = contact.normal;
            let surface_point = contact.surface_point;

            let vec = pos - surface_point;
            let projection = vec.dot(normal);

            if projection < self.thickness {

                // --- Back-Face Recovery (Safety Net) ---
                if projection < 0.0 {
                    let prev = state.prev_positions[i];
                    let velocity = state.positions[i] - prev;
                    if velocity.dot(normal) < 0.0 {
                        state.prev_positions[i] = state.positions[i];
                    }
                    if projection < -self.thickness * 2.0 {
                        let snap_correction = normal * (self.thickness - projection);
                        state.positions[i] += snap_correction;
                        continue;
                    }
                }
                // ---------------------------------------

                // A. Position Correction (Normal Force)
                let penetration = self.thickness - projection;
                let correction = normal * penetration;
                state.positions[i] += correction;

                // B. Coulomb Friction
                // We calculate the velocity implied by the move
                let prev = state.prev_positions[i];
                let velocity = state.positions[i] - prev; // This is actually displacement (v * dt)

                let vn_mag = velocity.dot(normal);
                let vn = normal * vn_mag;
                let vt = velocity - vn; // Tangential displacement
                let vt_len = vt.length();

                // Friction Impulse Limit = Normal Impulse * Mu
                // Here, 'penetration' is the Normal Impulse (distance pushed out)
                // 'vt_len' is the Tangential Impulse (distance trying to slide)

                let mut friction_factor = 0.0;

                if vt_len > 1e-9 {
                    // Static Friction Check
                    // If trying to move less than the Static Limit, we Stick.
                    if vt_len < penetration * self.static_friction {
                        friction_factor = 1.0; // Stop completely
                    } else {
                        // Kinetic Friction
                        // We reduce the sliding by the Kinetic Limit
                        // Sliding = Current - (Normal * Mu_k)
                        let max_slide = penetration * self.dynamic_friction;
                        // Factor to reduce vt by max_slide
                        // new_vt = vt * (1 - max_slide / vt_len)
                        // friction_factor = max_slide / vt_len
                        friction_factor = max_slide / vt_len;

                        // Clamp factor to max 1.0 (shouldn't happen due to if/else, but safety)
                        if friction_factor > 1.0 { friction_factor = 1.0; }
                    }
                }

                let new_vt = vt * (1.0 - friction_factor);

                // Kill normal velocity if moving in (Bounce = 0)
                let new_vn = if vn_mag < 0.0 { Vec3::ZERO } else { vn };

                state.prev_positions[i] = state.positions[i] - (new_vn + new_vt);
            }
        }
    }
}