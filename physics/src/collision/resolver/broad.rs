// physics/src/collision/resolver/broad.rs
use crate::engine::state::PhysicsState;
use crate::collision::collider::MeshCollider;
use super::CollisionResolver;

// Removed unused import: use glam::Vec4;

pub fn perform_broad_phase(resolver: &mut CollisionResolver, state: &PhysicsState, collider: &MeshCollider) {
    // Reset Cache
    resolver.candidate_indices.clear();

    // Resize offsets/counts to match particle count
    if resolver.candidate_offsets.len() != state.count {
        resolver.candidate_offsets.resize(state.count, 0);
        resolver.candidate_counts.resize(state.count, 0);
    }

    let base_search_radius = 0.02;

    for i in 0..state.count {
        if state.inv_mass[i] == 0.0 {
            resolver.candidate_counts[i] = 0;
            continue;
        }

        // FIX: Truncate Vec4 -> Vec3 for geometric checks
        let pos = state.positions[i].truncate();
        let prev = state.prev_positions[i].truncate();

        let displacement = pos.distance(prev);
        let search_radius = base_search_radius + displacement;

        // OPTIMIZATION: AABB Pruning
        if !collider.spatial_hash.contains(pos) && !collider.spatial_hash.contains(prev) {
             let mid = (pos + prev) * 0.5;
             if !collider.spatial_hash.contains(mid) {
                 resolver.candidate_counts[i] = 0;
                 continue;
             }
        }

        // Query Spatial Hash
        collider.spatial_hash.query(pos, search_radius, &mut resolver.query_buffer);

        // Store in Cache
        let start_idx = resolver.candidate_indices.len();
        resolver.candidate_indices.extend_from_slice(&resolver.query_buffer);
        let count = resolver.candidate_indices.len() - start_idx;

        resolver.candidate_offsets[i] = start_idx;
        resolver.candidate_counts[i] = count;
    }
}