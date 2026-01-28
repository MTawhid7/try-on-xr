// physics/src/collision/resolver/broad.rs
use crate::engine::state::PhysicsState;
use crate::collision::collider::MeshCollider;
use super::CollisionResolver;

pub fn perform_broad_phase(resolver: &mut CollisionResolver, state: &PhysicsState, collider: &MeshCollider) {
    // Reset Cache
    resolver.candidate_indices.clear();

    // Resize offsets/counts to match particle count
    if resolver.candidate_offsets.len() != state.count {
        resolver.candidate_offsets.resize(state.count, 0);
        resolver.candidate_counts.resize(state.count, 0);
    }

    for i in 0..state.count {
        if state.inv_mass[i] == 0.0 {
            resolver.candidate_counts[i] = 0;
            continue;
        }

        let pos = state.positions[i];

        // OPTIMIZATION: AABB Pruning
        // If the particle is outside the Body's bounding box, skip.
        if !collider.spatial_hash.contains(pos) {
            resolver.candidate_counts[i] = 0;
            continue;
        }

        // Query Spatial Hash
        // We use a search radius slightly larger than the contact thickness
        let search_radius = 0.05;
        collider.spatial_hash.query(pos, search_radius, &mut resolver.query_buffer);

        // Store in Cache
        let start_idx = resolver.candidate_indices.len();
        resolver.candidate_indices.extend_from_slice(&resolver.query_buffer);
        let count = resolver.candidate_indices.len() - start_idx;

        resolver.candidate_offsets[i] = start_idx;
        resolver.candidate_counts[i] = count;
    }
}