// physics/src/collision/resolver/mod.rs
mod broad;
mod narrow;

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
    // Shared settings
    pub(crate) thickness: f32,
    pub(crate) search_radius: f32,
    pub(crate) static_friction: f32,
    pub(crate) dynamic_friction: f32,
    pub(crate) collision_stiffness: f32,

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
            // 1. THICKNESS: Reduced from 0.02 (2cm) to 0.005 (5mm)
            // Combined with the 5mm mesh inflation, the total visual gap is ~1cm.
            thickness: 0.005,

            search_radius: 0.05,
            contacts: Vec::with_capacity(3000),
            query_buffer: Vec::with_capacity(32),
            candidate_indices: Vec::with_capacity(10000),
            candidate_offsets: Vec::new(),
            candidate_counts: Vec::new(),

            // 2. FRICTION: Lowered to allow draping
            // High friction acts like Velcro. Low friction allows the cloth
            // to slide down the chest and back to find its natural resting state.
            static_friction: 0.3,  // Was 0.7
            dynamic_friction: 0.2, // Was 0.4

            collision_stiffness: 0.9, // Increased slightly for harder contact
        }
    }

    // Delegate Broad Phase to sub-module
    pub fn broad_phase(&mut self, state: &PhysicsState, collider: &MeshCollider) {
        broad::perform_broad_phase(self, state, collider);
    }

    // Delegate Narrow Phase to sub-module
    pub fn narrow_phase(&mut self, state: &mut PhysicsState, collider: &MeshCollider, dt: f32) {
        narrow::perform_narrow_phase(self, state, collider, dt);
    }

    // Keep Resolution logic here (it's the core physics response)
    pub fn resolve_contacts(&self, state: &mut PhysicsState, _dt: f32) {
        for contact in &self.contacts {
            let i = contact.particle_index;
            let pos = state.positions[i];
            let normal = contact.normal;
            let surface_point = contact.surface_point;

            let vec = pos - surface_point;
            let projection = vec.dot(normal);

            if projection < self.thickness {
                // 1. Back-Face Recovery
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

                // 2. Position Correction (Stiffness)
                let penetration = self.thickness - projection;
                let stiffness = if projection < 0.0 { 1.0 } else { self.collision_stiffness };
                let correction = normal * penetration * stiffness;
                state.positions[i] += correction;

                // 3. Friction
                let prev = state.prev_positions[i];
                let velocity = state.positions[i] - prev;
                let vn_mag = velocity.dot(normal);
                let vn = normal * vn_mag;
                let vt = velocity - vn;
                let vt_len = vt.length();

                let mut friction_factor = 0.0;
                if vt_len > 1e-9 {
                    if vt_len < penetration * self.static_friction {
                        friction_factor = 1.0;
                    } else {
                        let max_slide = penetration * self.dynamic_friction;
                        friction_factor = max_slide / vt_len;
                        if friction_factor > 1.0 { friction_factor = 1.0; }
                    }
                }

                let new_vt = vt * (1.0 - friction_factor);
                let new_vn = if vn_mag < 0.0 { Vec3::ZERO } else { vn };
                state.prev_positions[i] = state.positions[i] - (new_vn + new_vt);
            }
        }
    }
}