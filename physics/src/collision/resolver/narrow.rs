use crate::engine::state::PhysicsState;
use crate::collision::collider::MeshCollider;
use super::{CollisionResolver, Contact};

pub fn perform_narrow_phase(
    resolver: &mut CollisionResolver,
    state: &mut PhysicsState,
    collider: &MeshCollider,
    dt: f32
) {
    resolver.contacts.clear();

    let max_v_per_step = resolver.thickness * 0.9;
    let max_v = max_v_per_step / dt;

    for i in 0..state.count {
        let count = resolver.candidate_counts[i];
        if count == 0 { continue; }

        let offset = resolver.candidate_offsets[i];
        let pos = state.positions[i];

        // Find closest point among cached candidates
        let mut best_dist_sq = resolver.search_radius * resolver.search_radius;
        let mut best_result = None;

        for j in 0..count {
            let tri_idx = resolver.candidate_indices[offset + j];
            let tri = &collider.triangles[tri_idx];

            let (closest, bary) = tri.closest_point(pos);
            let dist_sq = closest.distance_squared(pos);

            if dist_sq < best_dist_sq {
                best_dist_sq = dist_sq;

                // Reconstruct smooth normal
                let idx0 = collider.indices[tri_idx * 3] as usize;
                let idx1 = collider.indices[tri_idx * 3 + 1] as usize;
                let idx2 = collider.indices[tri_idx * 3 + 2] as usize;

                let n0 = collider.normals[idx0];
                let n1 = collider.normals[idx1];
                let n2 = collider.normals[idx2];

                let smooth_normal = (n0 * bary[0] + n1 * bary[1] + n2 * bary[2]).normalize();

                best_result = Some((closest, smooth_normal));
            }
        }

        // If we found a collision
        if let Some((surface_point, normal)) = best_result {
            // "Airbag" Velocity Clamping
            let prev = state.prev_positions[i];
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