// physics/src/collision/resolver/broad.rs
use crate::engine::state::PhysicsState;
use crate::collision::collider::MeshCollider;
use super::CollisionResolver;


/// Executes the Broad Phase of collision detection.
/// Queries the Spatial Hash to find potential collision candidates (triangles close to particles).
/// Populates the `candidate_indices` buffer in the resolver.
pub fn perform_broad_phase(resolver: &mut CollisionResolver, state: &PhysicsState, collider: &mut MeshCollider) {
    resolver.candidate_indices.clear();

    for i in 0..state.count {
        if state.inv_mass[i] == 0.0 {
            resolver.candidate_counts[i] = 0;
            continue;
        }

        let pos = state.positions[i].truncate();
        let prev = state.prev_positions[i].truncate();
        let search_radius = 0.02 + pos.distance(prev);

        if !collider.spatial_hash.contains(pos) && !collider.spatial_hash.contains(prev) {
            resolver.candidate_counts[i] = 0;
            continue;
        }

        collider.spatial_hash.query(pos, search_radius, &mut resolver.query_buffer);

        let start_idx = resolver.candidate_indices.len();
        let query_len = resolver.query_buffer.len();

        // HEAP GUARD: Prevents memory.grow by capping candidates to pre-allocated capacity
        if start_idx + query_len < resolver.candidate_indices.capacity() {
            resolver.candidate_indices.extend_from_slice(&resolver.query_buffer);
            resolver.candidate_offsets[i] = start_idx;
            resolver.candidate_counts[i] = query_len;
        } else {
            // If we hit capacity, we sacrifice a few collisions to keep memory stable
            resolver.candidate_counts[i] = 0;
        }
    }
}