// physics/src/collision/self_collision.rs
use crate::engine::state::PhysicsState;
use super::spatial_hash::SpatialHash;

pub struct SelfCollision {
    hash: SpatialHash,
    thickness: f32,
    // Adjacency list to ignore connected neighbors
    // We use a simple Vec<Vec<usize>> where index i contains neighbors of i
    neighbors: Vec<Vec<usize>>,
}

impl SelfCollision {
    pub fn new(state: &PhysicsState, thickness: f32) -> Self {
        // 1. Build Adjacency Map
        // We need to know which particles are directly connected so we don't collide them.
        let mut neighbors = vec![Vec::new(); state.count];
        let num_triangles = state.indices.len() / 3;

        for i in 0..num_triangles {
            let idx0 = state.indices[i * 3] as usize;
            let idx1 = state.indices[i * 3 + 1] as usize;
            let idx2 = state.indices[i * 3 + 2] as usize;

            // Add connections (undirected)
            Self::add_neighbor(&mut neighbors, idx0, idx1);
            Self::add_neighbor(&mut neighbors, idx0, idx2);
            Self::add_neighbor(&mut neighbors, idx1, idx2);
        }

        // Cell size should be roughly 2x the thickness
        let hash = SpatialHash::new(thickness * 2.0);

        Self {
            hash,
            thickness,
            neighbors,
        }
    }

    fn add_neighbor(map: &mut Vec<Vec<usize>>, a: usize, b: usize) {
        if !map[a].contains(&b) { map[a].push(b); }
        if !map[b].contains(&a) { map[b].push(a); }
    }

    pub fn solve(&mut self, state: &mut PhysicsState) {
        // 1. Rebuild Hash
        self.hash.clear();
        for i in 0..state.count {
            self.hash.insert_point(i, state.positions[i]);
        }

        // 2. Iterate and Solve
        let repulsion_stiffness = 0.5; // Soft repulsion to avoid jitter

        for i in 0..state.count {
            let p_i = state.positions[i];

            // Query nearby particles
            let candidates = self.hash.query(p_i, self.thickness);

            for &j in &candidates {
                if i == j { continue; }

                // Ignore directly connected neighbors (structural edges)
                if self.neighbors[i].contains(&j) { continue; }

                let p_j = state.positions[j];
                let delta = p_i - p_j;
                let dist_sq = delta.length_squared();

                let min_dist = self.thickness; // Minimum separation

                if dist_sq < min_dist * min_dist && dist_sq > 1e-9 {
                    let dist = dist_sq.sqrt();
                    let overlap = min_dist - dist;

                    // Simple Position Correction
                    let normal = delta / dist;
                    let correction = normal * overlap * repulsion_stiffness;

                    let w1 = state.inv_mass[i];
                    let w2 = state.inv_mass[j];
                    let w_sum = w1 + w2;

                    if w_sum > 0.0 {
                        if w1 > 0.0 { state.positions[i] += correction * (w1 / w_sum); }
                        if w2 > 0.0 { state.positions[j] -= correction * (w2 / w_sum); }
                    }
                }
            }
        }
    }
}