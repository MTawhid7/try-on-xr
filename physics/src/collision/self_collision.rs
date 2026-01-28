// physics/src/collision/self_collision.rs
use crate::engine::state::PhysicsState;
use super::spatial::DynamicSpatialHash;

// Suppress warnings while this feature is disabled in the main loop
#[allow(dead_code)]
pub struct SelfCollision {
    hash: DynamicSpatialHash,
    thickness: f32,
    neighbors: Vec<Vec<usize>>,
    query_buffer: Vec<usize>,
}

#[allow(dead_code)]
impl SelfCollision {
    pub fn new(state: &PhysicsState, thickness: f32) -> Self {
        // Build static adjacency list to ignore connected neighbors (they can't self-collide)
        let mut neighbors = vec![Vec::new(); state.count];
        let num_triangles = state.indices.len() / 3;

        for i in 0..num_triangles {
            let idx0 = state.indices[i * 3] as usize;
            let idx1 = state.indices[i * 3 + 1] as usize;
            let idx2 = state.indices[i * 3 + 2] as usize;

            Self::add_neighbor(&mut neighbors, idx0, idx1);
            Self::add_neighbor(&mut neighbors, idx0, idx2);
            Self::add_neighbor(&mut neighbors, idx1, idx2);
        }

        // Initialize Dynamic Spatial Hash
        let hash = DynamicSpatialHash::new(thickness * 2.0);

        Self {
            hash,
            thickness,
            neighbors,
            query_buffer: Vec::with_capacity(64),
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

        let repulsion_stiffness = 0.5;

        // 2. Query and Resolve
        for i in 0..state.count {
            let p_i = state.positions[i];

            // Find candidates
            self.hash.query(p_i, self.thickness, &mut self.query_buffer);

            for &j in self.query_buffer.iter() {
                if i == j { continue; }
                // Skip immediate neighbors (connected by edges)
                if self.neighbors[i].contains(&j) { continue; }

                let p_j = state.positions[j];
                let delta = p_i - p_j;
                let dist_sq = delta.length_squared();
                let min_dist = self.thickness;

                if dist_sq < min_dist * min_dist && dist_sq > 1e-9 {
                    let dist = dist_sq.sqrt();
                    let overlap = min_dist - dist;
                    let normal = delta / dist;

                    // Apply repulsion
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