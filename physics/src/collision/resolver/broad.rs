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

    // We assume a base thickness for the static check
    // This should match or exceed the config.contact_thickness
    let base_search_radius = 0.02;

    for i in 0..state.count {
        if state.inv_mass[i] == 0.0 {
            resolver.candidate_counts[i] = 0;
            continue;
        }

        let pos = state.positions[i];
        let prev = state.prev_positions[i];

        // DYNAMIC RADIUS (Speculative Contact Support)
        // If the particle moved fast, we must expand the search radius to include
        // the entire volume it swept through.
        // Radius = Base + Distance Traveled
        let displacement = pos.distance(prev);
        let search_radius = base_search_radius + displacement;

        // OPTIMIZATION: AABB Pruning
        // We check if the expanded bounds touch the collider's global bounds.
        // Note: StaticSpatialHash::contains is a point check.
        // For robustness, we should ideally check the AABB, but checking the
        // current position with a margin is a reasonable approximation for the broad phase.
        if !collider.spatial_hash.contains(pos) && !collider.spatial_hash.contains(prev) {
             // Double check: if it moved a lot, the midpoint might be inside
             let mid = (pos + prev) * 0.5;
             if !collider.spatial_hash.contains(mid) {
                 resolver.candidate_counts[i] = 0;
                 continue;
             }
        }

        // Query Spatial Hash with the dynamic radius
        collider.spatial_hash.query(pos, search_radius, &mut resolver.query_buffer);

        // Store in Cache
        let start_idx = resolver.candidate_indices.len();
        resolver.candidate_indices.extend_from_slice(&resolver.query_buffer);
        let count = resolver.candidate_indices.len() - start_idx;

        resolver.candidate_offsets[i] = start_idx;
        resolver.candidate_counts[i] = count;
    }
}