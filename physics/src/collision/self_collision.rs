// physics/src/collision/self_collision.rs

use crate::engine::state::PhysicsState;
use super::spatial::HierarchicalSpatialHash;
use super::exclusion::TopologyExclusion;
use glam::Vec4;

/// Configuration for self-collision behavior.
/// Allows runtime tuning of quality vs. performance trade-off.
pub struct SelfCollisionConfig {
    /// Minimum separation distance between particles (default: 0.005 = 5mm)
    pub thickness: f32,
    /// Repulsion strength (0.0 - 1.0, default: 0.5)
    pub stiffness: f32,
    /// Solve every N substeps (1 = every substep, 2 = every other, etc.)
    pub frequency: u8,
    /// Maximum collision pairs to process per frame (performance cap)
    #[allow(dead_code)] // Reserved for future batched implementation
    pub max_pairs: usize,
}

impl Default for SelfCollisionConfig {
    fn default() -> Self {
        Self {
            thickness: 0.005,
            stiffness: 0.5,
            frequency: 2, // Every other substep
            max_pairs: 10000,
        }
    }
}

/// Handles cloth-on-cloth collision detection and resolution.
/// Uses hierarchical spatial hashing with Morton codes for efficient broad-phase,
/// and topology-aware exclusion to prevent instability from constrained neighbors.
pub struct SelfCollision {
    hash: HierarchicalSpatialHash,
    exclusion: TopologyExclusion,
    pub config: SelfCollisionConfig,
    query_buffer: Vec<u32>,
}

impl SelfCollision {
    /// Creates a new self-collision system from mesh topology.
    pub fn new(state: &PhysicsState, config: SelfCollisionConfig) -> Self {
        // Build topology exclusion with 2-ring depth (recommended for stability)
        let exclusion = TopologyExclusion::new(&state.indices, state.count, 2);

        // Initialize hierarchical hash with collision radius
        let hash = HierarchicalSpatialHash::new(config.thickness);

        Self {
            hash,
            exclusion,
            config,
            query_buffer: Vec::with_capacity(64),
        }
    }

    /// Detects and resolves self-collisions.
    /// Should be called at reduced frequency (e.g., every 2nd substep) for performance.
    pub fn solve(&mut self, state: &mut PhysicsState) {
        // 1. Rebuild hash with current positions
        self.hash.clear();
        for i in 0..state.count {
            self.hash.insert_point(i as u32, state.positions[i].truncate());
        }

        let stiffness = self.config.stiffness;
        let thickness = self.config.thickness;
        let thickness_sq = thickness * thickness;

        // 2. Query and resolve collisions
        for i in 0..state.count {
            let p_i = state.positions[i].truncate();

            self.hash.query(p_i, thickness, &mut self.query_buffer);

            for &j in self.query_buffer.iter() {
                let j = j as usize;

                // Skip self and topologically connected neighbors
                if i == j { continue; }
                if self.exclusion.should_exclude(i, j) { continue; }

                let p_j = state.positions[j].truncate();
                let delta = p_i - p_j;
                let dist_sq = delta.length_squared();

                // Only resolve if within collision threshold
                if dist_sq < thickness_sq && dist_sq > 1e-9 {
                    let dist = dist_sq.sqrt();
                    let overlap = thickness - dist;
                    let normal = delta / dist;
                    let correction = normal * overlap * stiffness;

                    let w1 = state.inv_mass[i];
                    let w2 = state.inv_mass[j];
                    let w_sum = w1 + w2;

                    if w_sum > 0.0 {
                        let ratio1 = w1 / w_sum;
                        let ratio2 = w2 / w_sum;

                        if w1 > 0.0 {
                            state.positions[i] += Vec4::from((correction * ratio1, 0.0));
                        }
                        if w2 > 0.0 {
                            state.positions[j] -= Vec4::from((correction * ratio2, 0.0));
                        }
                    }
                }
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use glam::Vec4;

    fn make_test_state() -> PhysicsState {
        // Create a simple 2-triangle mesh for testing
        let positions = vec![
            0.0, 0.0, 0.0,  // 0
            1.0, 0.0, 0.0,  // 1
            0.5, 1.0, 0.0,  // 2
            1.5, 1.0, 0.0,  // 3
        ];
        let indices = vec![0, 1, 2, 1, 3, 2];
        let uvs = vec![0.0; 8];
        PhysicsState::new(&positions, &indices, &uvs)
    }

    #[test]
    fn test_self_collision_creation() {
        let state = make_test_state();
        let config = SelfCollisionConfig::default();
        let self_coll = SelfCollision::new(&state, config);

        assert_eq!(self_coll.config.frequency, 2);
        assert_eq!(self_coll.exclusion.ring_depth(), 2);
    }

    #[test]
    fn test_neighbors_not_colliding() {
        let mut state = make_test_state();
        // Move particles 0 and 1 very close (they share an edge)
        state.positions[0] = Vec4::new(0.0, 0.0, 0.0, 0.0);
        state.positions[1] = Vec4::new(0.001, 0.0, 0.0, 0.0); // 1mm apart

        let config = SelfCollisionConfig {
            thickness: 0.01, // 10mm threshold
            ..Default::default()
        };
        let mut self_coll = SelfCollision::new(&state, config);

        let pos_before = state.positions[0];
        self_coll.solve(&mut state);

        // Positions should NOT change because 0 and 1 are topology neighbors
        assert_eq!(state.positions[0], pos_before);
    }
}