// physics/src/collision/resolver/narrow.rs

use crate::engine::state::PhysicsState;
use crate::engine::config::PhysicsConfig;
use crate::collision::collider::MeshCollider;
use super::{CollisionResolver, Contact};
use glam::Vec3;

pub fn perform_narrow_phase(
    resolver: &mut CollisionResolver,
    state: &mut PhysicsState,
    collider: &MeshCollider,
    config: &PhysicsConfig,
    dt: f32
) {
    resolver.contacts.clear();

    // "Airbag" logic: Limit how fast a particle can penetrate the collider
    let max_v_per_step = config.contact_thickness * 0.9;
    let max_v = max_v_per_step / dt;

    // Base search radius for discrete checks
    let discrete_radius = 0.05;

    for i in 0..state.count {
        let count = resolver.candidate_counts[i];
        if count == 0 { continue; }

        let offset = resolver.candidate_offsets[i];
        let pos = state.positions[i];
        let prev = state.prev_positions[i];

        // --- STRATEGY: Hybrid Discrete + Continuous ---

        let mut best_contact: Option<(Vec3, Vec3, f32)> = None; // (Point, Normal, Distance/Time)
        let mut min_metric = f32::MAX; // Metric is DistanceSq (Discrete) or Time (Continuous)
        let mut is_continuous = false;

        for j in 0..count {
            let tri_idx = resolver.candidate_indices[offset + j];
            let tri = &collider.triangles[tri_idx];

            // 1. Continuous Check (Tunneling Prevention)
            // Check if the segment Prev -> Curr intersected the triangle
            if let Some((hit_point, hit_normal, t)) = tri.intersect_segment(prev, pos) {
                // We prioritize the earliest impact time
                if t < min_metric {
                    // Re-orient normal to face the incoming particle
                    let normal = if hit_normal.dot(pos - prev) < 0.0 { hit_normal } else { -hit_normal };

                    best_contact = Some((hit_point, normal, t));
                    min_metric = t;
                    is_continuous = true;
                }
            }

            // 2. Discrete Check (Standard)
            // Only run if we haven't found a continuous collision yet (or if we want to find the closest surface)
            // Note: If we found a continuous collision, that is usually the "truth".
            if !is_continuous {
                let (closest, _bary) = tri.closest_point(pos);
                let dist_sq = closest.distance_squared(pos);

                if dist_sq < discrete_radius * discrete_radius {
                    if dist_sq < min_metric {
                        // Reconstruct smooth normal
                        let idx0 = collider.indices[tri_idx * 3] as usize;
                        let idx1 = collider.indices[tri_idx * 3 + 1] as usize;
                        let idx2 = collider.indices[tri_idx * 3 + 2] as usize;
                        let n0 = collider.normals[idx0];
                        let n1 = collider.normals[idx1];
                        let n2 = collider.normals[idx2];

                        // Recalculate barycentric for normal interpolation
                        let (_, bary) = tri.closest_point(pos);
                        let smooth_normal = (n0 * bary[0] + n1 * bary[1] + n2 * bary[2]).normalize();

                        best_contact = Some((closest, smooth_normal, dist_sq));
                        min_metric = dist_sq;
                    }
                }
            }
        }

        // If we found a collision
        if let Some((surface_point, normal, _metric)) = best_contact {

            // If it was a continuous collision, we effectively "snap" the particle
            // back to the surface for the solver to handle.
            // This prevents the "teleportation" effect.

            // Velocity Clamping (Airbag)
            let velocity = (pos - prev) / dt;
            let v_normal = velocity.dot(normal);

            if v_normal < -max_v {
                let v_tangent = velocity - normal * v_normal;
                let v_clamped = normal * -max_v;
                let new_velocity = v_tangent + v_clamped;
                state.prev_positions[i] = pos - new_velocity * dt;
            }

            resolver.contacts.push(Contact {
                particle_index: i,
                normal,
                surface_point,
            });
        }
    }
}