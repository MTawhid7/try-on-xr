// physics/src/collision/self_collision/detection.rs

//! Phase 1: Collision pair detection using spatial hashing.

use crate::engine::state::PhysicsState;
use super::SelfCollision;
use super::config::CollisionPair;

impl SelfCollision {
    /// Phase 1: Detect all collision pairs (read-only on positions).
    /// Returns true if there are pairs to resolve.
    pub(crate) fn detect_pairs(&mut self, state: &PhysicsState) -> bool {
        self.collision_pairs.clear();

        // Rebuild hash with current positions
        self.hash.clear();
        for i in 0..state.count {
            self.hash.insert_point(i as u32, state.positions[i].truncate());
        }

        let thickness = self.config.thickness;
        let thickness_sq = thickness * thickness;

        // Detect pairs (only store i < j to avoid duplicates)
        for i in 0..state.count {
            let p_i = state.positions[i].truncate();
            self.hash.query(p_i, thickness, &mut self.query_buffer);

            for &j in self.query_buffer.iter() {
                let j = j as usize;

                // Only process once per pair (i < j)
                if i >= j { continue; }
                if self.exclusion.should_exclude(i, j) { continue; }

                let p_j = state.positions[j].truncate();
                let delta = p_i - p_j;
                let dist_sq = delta.length_squared();

                if dist_sq < thickness_sq && dist_sq > 1e-9 {
                    self.collision_pairs.push(CollisionPair {
                        i: i as u32,
                        j: j as u32,
                    });

                    // Cap pairs for performance
                    if self.collision_pairs.len() >= self.config.max_pairs {
                        break;
                    }
                }
            }

            if self.collision_pairs.len() >= self.config.max_pairs {
                break;
            }
        }

        !self.collision_pairs.is_empty()
    }
}
