// physics/src/engine/collision_resolver.rs
use glam::Vec3;
use crate::engine::state::PhysicsState;
use super::collider::MeshCollider;

// Helper struct to store collision data
#[derive(Clone, Copy)]
pub struct Contact {
    pub particle_index: usize,
    pub normal: Vec3,
    pub surface_point: Vec3, // Store point to calculate depth dynamically
}

pub struct CollisionResolver {
    thickness: f32,
    search_radius: f32,
    // Reusable buffer for contacts
    contacts: Vec<Contact>,
    // Reusable buffer for query indices
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

    /// PHASE 1: Find Contacts & Velocity Clamp (The "Airbag")
    /// Run this ONCE per substep.
    pub fn pre_solve(&mut self, state: &mut PhysicsState, collider: &MeshCollider, dt: f32) {
        self.contacts.clear();

        let max_v_per_step = self.thickness * 0.9;
        let max_v = max_v_per_step / dt;

        for i in 0..state.count {
            if state.inv_mass[i] == 0.0 { continue; }

            let pos = state.positions[i];

            // Optimization: Only check particles near the mesh
            // We use the reusable query buffer
            if let Some((surface_point, normal, _)) = collider.query_closest(pos, self.search_radius, &mut self.query_buffer) {

                // 1. Velocity Clamping (Anti-Tunneling)
                let prev = state.prev_positions[i];
                let velocity = (pos - prev) / dt;
                let v_normal = velocity.dot(normal);

                if v_normal < -max_v {
                    let v_tangent = velocity - normal * v_normal;
                    let v_clamped = normal * -max_v;
                    let new_velocity = v_tangent + v_clamped;
                    state.prev_positions[i] = pos - new_velocity * dt;
                }

                // 2. Cache the Contact
                // We store it if it's within search radius.
                // We will check exact depth inside the inner loop.
                self.contacts.push(Contact {
                    particle_index: i,
                    normal,
                    surface_point,
                });
            }
        }
    }

    /// PHASE 2: Position Projection
    /// Run this INSIDE the solver loop (10x).
    /// It iterates the CACHED contacts, avoiding expensive spatial lookups.
    pub fn resolve_contacts(&self, state: &mut PhysicsState) {
        for contact in &self.contacts {
            let i = contact.particle_index;
            let pos = state.positions[i];
            let normal = contact.normal;
            let surface_point = contact.surface_point;

            // Re-calculate depth dynamically as the particle moves during iterations
            let vec = pos - surface_point;
            let projection = vec.dot(normal);

            if projection < self.thickness {
                // A. Position Correction
                let penetration = self.thickness - projection;
                let correction = normal * penetration;
                state.positions[i] += correction;

                // B. Friction
                let prev = state.prev_positions[i];
                let velocity = state.positions[i] - prev;

                let vn_mag = velocity.dot(normal);
                let vn = normal * vn_mag;
                let vt = velocity - vn;

                let is_horizontal = normal.y > 0.7;
                let friction = if is_horizontal { 1.0 } else { 0.1 };

                let new_vt = vt * (1.0 - friction);
                let new_vn = if vn_mag < 0.0 { Vec3::ZERO } else { vn };

                state.prev_positions[i] = state.positions[i] - (new_vn + new_vt);
            }
        }
    }
}