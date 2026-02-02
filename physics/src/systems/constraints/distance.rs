// physics/src/systems/constraints/distance.rs

use crate::engine::state::PhysicsState;
use crate::utils::coloring;
use crate::utils::simd::{F32x4, Vec3x4};
use std::collections::HashMap;

/// Enforces edge length preservation (Stretch Resistance).
/// Uses XPBD (Extended Position Based Dynamics) to handle stiffness compliance.
/// Constraints are colored (batched) to allow stable sequential solving.
///
/// OPTIMIZATION: Uses true SIMD vectorization to process 4 constraints in parallel.
pub struct DistanceConstraint {
    pub constraints: Vec<[usize; 2]>,
    pub rest_lengths: Vec<f32>,
    pub compliances: Vec<f32>,
    pub batch_offsets: Vec<usize>,
}

impl DistanceConstraint {
    /// Builds distance constraints for every unique edge in the mesh.
    pub fn new(state: &PhysicsState) -> Self {
        let mut raw_constraints = Vec::new();
        let mut raw_rest_lengths = Vec::new();
        let mut raw_compliances = Vec::new();

        let mut edge_counts = HashMap::new();
        let num_triangles = state.indices.len() / 3;

        for i in 0..num_triangles {
            let idx0 = state.indices[i * 3] as usize;
            let idx1 = state.indices[i * 3 + 1] as usize;
            let idx2 = state.indices[i * 3 + 2] as usize;

            let e1 = if idx0 < idx1 { (idx0, idx1) } else { (idx1, idx0) };
            let e2 = if idx1 < idx2 { (idx1, idx2) } else { (idx2, idx1) };
            let e3 = if idx2 < idx0 { (idx2, idx0) } else { (idx0, idx2) };

            *edge_counts.entry(e1).or_insert(0) += 1;
            *edge_counts.entry(e2).or_insert(0) += 1;
            *edge_counts.entry(e3).or_insert(0) += 1;
        }

        for ((i1, i2), _count) in edge_counts {
            let p1 = state.positions[i1];
            let p2 = state.positions[i2];
            let dist = p1.distance(p2);

            raw_constraints.push([i1, i2]);
            raw_rest_lengths.push(dist);
            raw_compliances.push(0.0);
        }

        let (sorted_indices, batch_offsets) = coloring::color_constraints(&raw_constraints, state.count);

        let mut constraints = Vec::with_capacity(raw_constraints.len());
        let mut rest_lengths = Vec::with_capacity(raw_constraints.len());
        let mut compliances = Vec::with_capacity(raw_constraints.len());

        for idx in sorted_indices {
            constraints.push(raw_constraints[idx]);
            rest_lengths.push(raw_rest_lengths[idx]);
            compliances.push(raw_compliances[idx]);
        }

        Self {
            constraints,
            rest_lengths,
            compliances,
            batch_offsets,
        }
    }

    /// Solves distance constraints (Edge Springs) using SIMD vectorization.
    /// Processes 4 constraints at a time for maximum throughput.
    ///
    /// OPTIMIZATION: True SIMD - packs 4 constraint computations into vector registers.
    #[inline(never)]
    pub fn solve(&self, state: &mut PhysicsState, omega: f32, dt: f32) {
        let dt_sq_inv = 1.0 / (dt * dt);

        for b in 0..(self.batch_offsets.len() - 1) {
            let start = self.batch_offsets[b];
            let end = self.batch_offsets[b + 1];
            let count = end - start;

            // Process 4 constraints at a time with SIMD
            let chunks = count / 4;
            let remainder = count % 4;

            for chunk in 0..chunks {
                let base = start + chunk * 4;
                self.solve_simd_4(state, base, dt_sq_inv, omega);
            }

            // Handle remainder with scalar fallback
            for k in (start + chunks * 4)..(start + chunks * 4 + remainder) {
                self.solve_single(state, k, dt_sq_inv, omega);
            }
        }
    }

    /// SIMD-accelerated solver for 4 constraints at once.
    /// Uses Vec3x4 to process all vector math in parallel.
    #[inline(always)]
    fn solve_simd_4(&self, state: &mut PhysicsState, base: usize, dt_sq_inv: f32, omega: f32) {
        // Load indices
        let [i1_0, i2_0] = self.constraints[base];
        let [i1_1, i2_1] = self.constraints[base + 1];
        let [i1_2, i2_2] = self.constraints[base + 2];
        let [i1_3, i2_3] = self.constraints[base + 3];

        // Load inverse masses (4-wide)
        let w1 = F32x4::new(
            state.inv_mass[i1_0],
            state.inv_mass[i1_1],
            state.inv_mass[i1_2],
            state.inv_mass[i1_3],
        );
        let w2 = F32x4::new(
            state.inv_mass[i2_0],
            state.inv_mass[i2_1],
            state.inv_mass[i2_2],
            state.inv_mass[i2_3],
        );
        let w_sum = w1.add(w2);

        // Load positions (4 pairs = 8 positions)
        let p1 = Vec3x4::from_vec4s(
            state.positions[i1_0],
            state.positions[i1_1],
            state.positions[i1_2],
            state.positions[i1_3],
        );
        let p2 = Vec3x4::from_vec4s(
            state.positions[i2_0],
            state.positions[i2_1],
            state.positions[i2_2],
            state.positions[i2_3],
        );

        // Compute delta vectors
        let delta = p1.sub(p2);
        let len = delta.length();

        // Load rest lengths and compliances
        let rest = F32x4::new(
            self.rest_lengths[base],
            self.rest_lengths[base + 1],
            self.rest_lengths[base + 2],
            self.rest_lengths[base + 3],
        );
        let compliance = F32x4::new(
            self.compliances[base],
            self.compliances[base + 1],
            self.compliances[base + 2],
            self.compliances[base + 3],
        );
        let alpha = compliance.mul(F32x4::splat(dt_sq_inv));

        // Constraint: C = len - rest_length
        let c = len.sub(rest);

        // delta_lambda = -C / (w_sum + alpha)
        let denom = w_sum.add(alpha);
        let safe_denom = denom.max(F32x4::splat(1e-8));
        let delta_lambda = c.neg().div(safe_denom);

        // Normalize delta: direction = delta / len
        let safe_len = len.max(F32x4::splat(1e-8));
        let direction = delta.div_scalar(safe_len);

        // Correction vector = direction * delta_lambda * omega
        let omega_vec = F32x4::splat(omega);
        let correction_mag = delta_lambda.mul(omega_vec);
        let correction = direction.mul_scalar(correction_mag);

        // Apply corrections weighted by inverse mass
        let corr1 = correction.mul_scalar(w1);
        let corr2 = correction.mul_scalar(w2);

        // Write back positions (masking handled by zero inverse mass = zero correction)
        let mask_w1_gt_zero = w1.gt_mask(F32x4::splat(0.0));
        let mask_w2_gt_zero = w2.gt_mask(F32x4::splat(0.0));

        // Lane 0
        if mask_w1_gt_zero.lane0().to_bits() != 0 {
            state.positions[i1_0] += corr1.extract_lane0();
        }
        if mask_w2_gt_zero.lane0().to_bits() != 0 {
            state.positions[i2_0] -= corr2.extract_lane0();
        }

        // Lane 1
        if mask_w1_gt_zero.lane1().to_bits() != 0 {
            state.positions[i1_1] += corr1.extract_lane1();
        }
        if mask_w2_gt_zero.lane1().to_bits() != 0 {
            state.positions[i2_1] -= corr2.extract_lane1();
        }

        // Lane 2
        if mask_w1_gt_zero.lane2().to_bits() != 0 {
            state.positions[i1_2] += corr1.extract_lane2();
        }
        if mask_w2_gt_zero.lane2().to_bits() != 0 {
            state.positions[i2_2] -= corr2.extract_lane2();
        }

        // Lane 3
        if mask_w1_gt_zero.lane3().to_bits() != 0 {
            state.positions[i1_3] += corr1.extract_lane3();
        }
        if mask_w2_gt_zero.lane3().to_bits() != 0 {
            state.positions[i2_3] -= corr2.extract_lane3();
        }
    }

    /// Scalar fallback for remainder constraints.
    #[inline(always)]
    fn solve_single(&self, state: &mut PhysicsState, k: usize, dt_sq_inv: f32, omega: f32) {
        let [i1, i2] = self.constraints[k];
        let w1 = state.inv_mass[i1];
        let w2 = state.inv_mass[i2];
        let w_sum = w1 + w2;
        if w_sum == 0.0 { return; }

        let p1 = state.positions[i1];
        let p2 = state.positions[i2];
        let delta = p1 - p2;
        let len = delta.length();
        if len < 1e-6 { return; }

        let c = len - self.rest_lengths[k];
        let alpha = self.compliances[k] * dt_sq_inv;
        let delta_lambda = -c / (w_sum + alpha);

        let correction_vector = (delta / len) * delta_lambda;
        let accelerated_correction = correction_vector * omega;

        if w1 > 0.0 {
            state.positions[i1] += accelerated_correction * w1;
        }
        if w2 > 0.0 {
            state.positions[i2] -= accelerated_correction * w2;
        }
    }
}