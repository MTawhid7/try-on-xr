// physics/src/collision/self_collision.rs

use crate::engine::state::PhysicsState;
use crate::utils::simd::{F32x4, Vec3x4};
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

/// A collision pair between two particles.
#[derive(Clone, Copy)]
struct CollisionPair {
    i: u32,
    j: u32,
}

/// Handles cloth-on-cloth collision detection and resolution.
/// Uses hierarchical spatial hashing with Morton codes for efficient broad-phase,
/// and topology-aware exclusion to prevent instability from constrained neighbors.
///
/// OPTIMIZATION: Two-phase approach with graph coloring for batched parallel resolution.
pub struct SelfCollision {
    hash: HierarchicalSpatialHash,
    exclusion: TopologyExclusion,
    pub config: SelfCollisionConfig,
    query_buffer: Vec<u32>,
    /// Detected collision pairs (phase 1 output)
    collision_pairs: Vec<CollisionPair>,
    /// Batch offsets for graph-colored pairs
    batch_offsets: Vec<usize>,
    /// Particle count for coloring
    particle_count: usize,
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
            collision_pairs: Vec::with_capacity(1000),
            batch_offsets: Vec::new(),
            particle_count: state.count,
        }
    }

    /// Phase 1: Detect all collision pairs (read-only on positions).
    /// Returns true if there are pairs to resolve.
    fn detect_pairs(&mut self, state: &PhysicsState) -> bool {
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

    /// Phase 2: Color pairs for parallel-safe resolution.
    fn color_pairs(&mut self) {
        if self.collision_pairs.is_empty() {
            self.batch_offsets.clear();
            return;
        }

        // Build degree count for each particle
        let mut degree = vec![0usize; self.particle_count];
        for pair in &self.collision_pairs {
            degree[pair.i as usize] += 1;
            degree[pair.j as usize] += 1;
        }

        // CSR offset array
        let mut offset = vec![0usize; self.particle_count + 1];
        for i in 0..self.particle_count {
            offset[i + 1] = offset[i] + degree[i];
        }

        // Adjacency list (pair indices for each particle)
        let mut adj = vec![0usize; offset[self.particle_count]];
        let mut counter = offset.clone();
        for (idx, pair) in self.collision_pairs.iter().enumerate() {
            let i = pair.i as usize;
            let j = pair.j as usize;
            adj[counter[i]] = idx; counter[i] += 1;
            adj[counter[j]] = idx; counter[j] += 1;
        }

        // Greedy coloring
        let mut pair_colors: Vec<Option<usize>> = vec![None; self.collision_pairs.len()];
        let mut batch_indices: Vec<Vec<usize>> = Vec::new();

        for idx in 0..self.collision_pairs.len() {
            let pair = &self.collision_pairs[idx];
            let i = pair.i as usize;
            let j = pair.j as usize;
            let mut used_colors = 0u64;

            // Check neighbors of particle i
            for &c_idx in &adj[offset[i]..offset[i + 1]] {
                if let Some(c) = pair_colors[c_idx] {
                    if c < 64 {
                        used_colors |= 1u64 << c;
                    }
                }
            }
            // Check neighbors of particle j
            for &c_idx in &adj[offset[j]..offset[j + 1]] {
                if let Some(c) = pair_colors[c_idx] {
                    if c < 64 {
                        used_colors |= 1u64 << c;
                    }
                }
            }

            let color = (!used_colors).trailing_zeros() as usize;
            pair_colors[idx] = Some(color);

            if color >= batch_indices.len() {
                batch_indices.resize(color + 1, Vec::new());
            }
            batch_indices[color].push(idx);
        }

        // Reorder pairs by batch and store offsets
        let mut sorted_pairs = Vec::with_capacity(self.collision_pairs.len());
        self.batch_offsets.clear();
        let mut current_offset = 0;

        for batch in batch_indices {
            self.batch_offsets.push(current_offset);
            for idx in batch {
                sorted_pairs.push(self.collision_pairs[idx]);
            }
            current_offset = sorted_pairs.len();
        }
        self.batch_offsets.push(current_offset);
        self.collision_pairs = sorted_pairs;
    }

    /// Phase 3: Resolve collisions in batches (SIMD-accelerated).
    fn resolve_batched(&self, state: &mut PhysicsState) {
        let stiffness = self.config.stiffness;
        let thickness = self.config.thickness;

        for b in 0..(self.batch_offsets.len().saturating_sub(1)) {
            let start = self.batch_offsets[b];
            let end = self.batch_offsets[b + 1];
            let count = end - start;

            // SIMD: process 4 pairs at a time
            let chunks = count / 4;
            let remainder = count % 4;

            for chunk in 0..chunks {
                let base = start + chunk * 4;
                self.resolve_simd_4(state, base, stiffness, thickness);
            }

            // Scalar remainder
            for k in (start + chunks * 4)..(start + chunks * 4 + remainder) {
                self.resolve_single(state, k, stiffness, thickness);
            }
        }
    }

    /// SIMD-accelerated resolution for 4 collision pairs.
    #[inline(always)]
    fn resolve_simd_4(&self, state: &mut PhysicsState, base: usize, stiffness: f32, thickness: f32) {
        let p0 = &self.collision_pairs[base];
        let p1 = &self.collision_pairs[base + 1];
        let p2 = &self.collision_pairs[base + 2];
        let p3 = &self.collision_pairs[base + 3];

        let i0 = p0.i as usize; let j0 = p0.j as usize;
        let i1 = p1.i as usize; let j1 = p1.j as usize;
        let i2 = p2.i as usize; let j2 = p2.j as usize;
        let i3 = p3.i as usize; let j3 = p3.j as usize;

        // Load positions
        let pos_i = Vec3x4::from_vec4s(
            state.positions[i0],
            state.positions[i1],
            state.positions[i2],
            state.positions[i3],
        );
        let pos_j = Vec3x4::from_vec4s(
            state.positions[j0],
            state.positions[j1],
            state.positions[j2],
            state.positions[j3],
        );

        // Load inverse masses
        let w_i = F32x4::new(
            state.inv_mass[i0],
            state.inv_mass[i1],
            state.inv_mass[i2],
            state.inv_mass[i3],
        );
        let w_j = F32x4::new(
            state.inv_mass[j0],
            state.inv_mass[j1],
            state.inv_mass[j2],
            state.inv_mass[j3],
        );

        let delta = pos_i.sub(pos_j);
        let dist_sq = delta.length_squared();
        let dist = dist_sq.sqrt();

        // Overlap = thickness - dist
        let overlap = F32x4::splat(thickness).sub(dist);

        // Only apply if overlap > 0
        let zero = F32x4::splat(0.0);
        let positive_overlap = overlap.max(zero);

        // Normal = delta / dist
        let safe_dist = dist.max(F32x4::splat(1e-8));
        let normal = delta.div_scalar(safe_dist);

        // Correction magnitude = overlap * stiffness
        let correction_mag = positive_overlap.mul(F32x4::splat(stiffness));

        // Weight ratios
        let w_sum = w_i.add(w_j);
        let safe_w_sum = w_sum.max(F32x4::splat(1e-8));
        let ratio_i = w_i.div(safe_w_sum);
        let ratio_j = w_j.div(safe_w_sum);

        let corr_i = normal.mul_scalar(correction_mag.mul(ratio_i));
        let corr_j = normal.mul_scalar(correction_mag.mul(ratio_j));

        // Apply corrections
        let mask_wi = w_i.gt_mask(zero);
        let mask_wj = w_j.gt_mask(zero);

        if mask_wi.lane0().to_bits() != 0 {
            state.positions[i0] += corr_i.extract_lane0();
        }
        if mask_wj.lane0().to_bits() != 0 {
            state.positions[j0] -= corr_j.extract_lane0();
        }

        if mask_wi.lane1().to_bits() != 0 {
            state.positions[i1] += corr_i.extract_lane1();
        }
        if mask_wj.lane1().to_bits() != 0 {
            state.positions[j1] -= corr_j.extract_lane1();
        }

        if mask_wi.lane2().to_bits() != 0 {
            state.positions[i2] += corr_i.extract_lane2();
        }
        if mask_wj.lane2().to_bits() != 0 {
            state.positions[j2] -= corr_j.extract_lane2();
        }

        if mask_wi.lane3().to_bits() != 0 {
            state.positions[i3] += corr_i.extract_lane3();
        }
        if mask_wj.lane3().to_bits() != 0 {
            state.positions[j3] -= corr_j.extract_lane3();
        }
    }

    /// Scalar fallback for single pair resolution.
    #[inline(always)]
    fn resolve_single(&self, state: &mut PhysicsState, k: usize, stiffness: f32, thickness: f32) {
        let pair = &self.collision_pairs[k];
        let i = pair.i as usize;
        let j = pair.j as usize;

        let p_i = state.positions[i].truncate();
        let p_j = state.positions[j].truncate();
        let delta = p_i - p_j;
        let dist = delta.length();

        if dist < 1e-9 { return; }

        let overlap = thickness - dist;
        if overlap <= 0.0 { return; }

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

    /// Detects and resolves self-collisions using three-phase approach:
    /// 1. Detect pairs (read-only broad-phase)
    /// 2. Color pairs for parallel-safe batching
    /// 3. Resolve in batches with SIMD acceleration
    pub fn solve(&mut self, state: &mut PhysicsState) {
        if self.detect_pairs(state) {
            self.color_pairs();
            self.resolve_batched(state);
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