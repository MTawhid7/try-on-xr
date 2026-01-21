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
    pub static_friction: f32,
    pub dynamic_friction: f32,
    pub collision_stiffness: f32,
}

impl CollisionResolver {
    pub fn new() -> Self {
        Self {
            thickness: 0.012,
            search_radius: 0.05,
            contacts: Vec::with_capacity(3000),
            query_buffer: Vec::with_capacity(64), // Reusable buffer
            static_friction: 0.7,
            dynamic_friction: 0.4,
            collision_stiffness: 0.8,
        }
    }

    pub fn pre_solve(&mut self, state: &mut PhysicsState, collider: &MeshCollider, dt: f32) {
        self.contacts.clear();

        let max_v_per_step = self.thickness * 0.9;
        let max_v = max_v_per_step / dt;

        // Optimization: Pre-calculate the effective search margin
        // We need to check slightly further than search_radius to account for velocity
        let margin = self.search_radius + 0.05;

        for i in 0..state.count {
            if state.inv_mass[i] == 0.0 { continue; }

            let pos = state.positions[i];

            // PHASE 2 OPTIMIZATION: AABB Pruning
            // If the particle is outside the global bounding box of the body,
            // we skip the expensive Spatial Hash query entirely.
            if !collider.contains_point(pos, margin) {
                continue;
            }

            // If inside AABB, proceed to Narrow Phase
            if let Some((surface_point, normal, _)) = collider.query_closest(pos, self.search_radius, &mut self.query_buffer) {

                let prev = state.prev_positions[i];
                let velocity = (pos - prev) / dt;
                let v_normal = velocity.dot(normal);

                // Velocity Clamping (The Airbag)
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

    pub fn resolve_contacts(&self, state: &mut PhysicsState, _dt: f32) {
        for contact in &self.contacts {
            let i = contact.particle_index;
            let pos = state.positions[i];
            let normal = contact.normal;
            let surface_point = contact.surface_point;

            let vec = pos - surface_point;
            let projection = vec.dot(normal);

            if projection < self.thickness {
                // Back-Face Recovery
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

                // Soft Position Correction
                let penetration = self.thickness - projection;
                let stiffness = if projection < 0.0 { 1.0 } else { self.collision_stiffness };
                let correction = normal * penetration * stiffness;
                state.positions[i] += correction;

                // Friction
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