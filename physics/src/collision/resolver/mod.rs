// physics/src/collision/resolver/mod.rs
mod broad;
mod narrow;

use glam::{Vec3, Vec4};
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
    pub(crate) contacts: Vec<Contact>,
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

            // FIX: Truncate for calculation
            let pos_v4 = state.positions[i];
            let pos = pos_v4.truncate();

            let normal = contact.normal;
            let surface_point = contact.surface_point;

            let vec = pos - surface_point;
            let projection = vec.dot(normal);

            if projection < config.contact_thickness {
                // 1. Position Correction
                let penetration = config.contact_thickness - projection;
                let stiffness = if projection < 0.0 { 1.0 } else { config.collision_stiffness };

                let correction = normal * penetration * stiffness;

                // FIX: Apply as Vec4
                state.positions[i] += Vec4::from((correction, 0.0));

                // 2. Friction
                let prev_v4 = state.prev_positions[i];
                // Note: We use the *updated* position for velocity calculation
                let current_pos_v3 = state.positions[i].truncate();
                let prev_pos_v3 = prev_v4.truncate();

                let velocity = current_pos_v3 - prev_pos_v3;
                let vn_mag = velocity.dot(normal);
                let vn = normal * vn_mag;
                let vt = velocity - vn;
                let vt_len = vt.length();

                let mut friction_factor = 0.0;
                if vt_len > 1e-9 {
                    if vt_len < penetration * config.static_friction {
                        friction_factor = 1.0;
                    } else {
                        let max_slide = penetration * config.dynamic_friction;
                        friction_factor = max_slide / vt_len;
                        if friction_factor > 1.0 { friction_factor = 1.0; }
                    }
                }

                let new_vt = vt * (1.0 - friction_factor);
                let new_vn = if vn_mag < 0.0 { Vec3::ZERO } else { vn };

                // FIX: Apply friction correction to prev_positions (Verlet damping)
                let total_correction = new_vn + new_vt;
                state.prev_positions[i] = state.positions[i] - Vec4::from((total_correction, 0.0));
            }
        }
    }
}