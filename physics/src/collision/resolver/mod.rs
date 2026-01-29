// physics/src/collision/resolver/mod.rs
mod broad;
mod narrow;

use glam::Vec3;
use crate::engine::state::PhysicsState;
use crate::engine::config::PhysicsConfig;
use super::collider::MeshCollider;

#[derive(Clone, Copy)]
pub struct Contact {
    pub particle_index: usize,
    pub normal: Vec3,
    pub surface_point: Vec3,
}

pub struct CollisionResolver {
    // Shared State
    pub(crate) contacts: Vec<Contact>,

    // Caching Structures (Broad Phase Data)
    pub(crate) query_buffer: Vec<usize>,
    pub(crate) candidate_indices: Vec<usize>,
    pub(crate) candidate_offsets: Vec<usize>,
    pub(crate) candidate_counts: Vec<usize>,
}

impl CollisionResolver {
    pub fn new() -> Self {
        Self {
            contacts: Vec::with_capacity(3000),
            query_buffer: Vec::with_capacity(32),
            candidate_indices: Vec::with_capacity(10000),
            candidate_offsets: Vec::new(),
            candidate_counts: Vec::new(),
        }
    }

    pub fn broad_phase(&mut self, state: &PhysicsState, collider: &MeshCollider) {
        broad::perform_broad_phase(self, state, collider);
    }

    pub fn narrow_phase(&mut self, state: &mut PhysicsState, collider: &MeshCollider, config: &PhysicsConfig, dt: f32) {
        narrow::perform_narrow_phase(self, state, collider, config, dt);
    }

    pub fn resolve_contacts(&self, state: &mut PhysicsState, config: &PhysicsConfig, _dt: f32) {
        for contact in &self.contacts {
            let i = contact.particle_index;
            let pos = state.positions[i];
            let normal = contact.normal;
            let surface_point = contact.surface_point;

            let vec = pos - surface_point;
            let projection = vec.dot(normal);

            // Robustness Check:
            // If projection is deeply negative (tunneling), we still want to resolve it.
            // The narrow phase ensures 'normal' points towards the outside.

            if projection < config.contact_thickness {

                // 1. Position Correction
                // We push the particle out to 'contact_thickness' distance.
                let penetration = config.contact_thickness - projection;

                // Stiffness:
                // If deep penetration (tunneling), use max stiffness (1.0) to snap back immediately.
                // Otherwise use configured stiffness for soft contact.
                let stiffness = if projection < 0.0 { 1.0 } else { config.collision_stiffness };

                let correction = normal * penetration * stiffness;
                state.positions[i] += correction;

                // 2. Friction
                // Standard Coulomb friction model
                let prev = state.prev_positions[i];
                let velocity = state.positions[i] - prev;
                let vn_mag = velocity.dot(normal);
                let vn = normal * vn_mag;
                let vt = velocity - vn;
                let vt_len = vt.length();

                let mut friction_factor = 0.0;
                if vt_len > 1e-9 {
                    if vt_len < penetration * config.static_friction {
                        friction_factor = 1.0; // Static friction (stick)
                    } else {
                        let max_slide = penetration * config.dynamic_friction;
                        friction_factor = max_slide / vt_len;
                        if friction_factor > 1.0 { friction_factor = 1.0; }
                    }
                }

                let new_vt = vt * (1.0 - friction_factor);

                // Restitution / Normal Damping
                // If moving into the wall, kill normal velocity (inelastic collision)
                let new_vn = if vn_mag < 0.0 { Vec3::ZERO } else { vn };

                state.prev_positions[i] = state.positions[i] - (new_vn + new_vt);
            }
        }
    }
}