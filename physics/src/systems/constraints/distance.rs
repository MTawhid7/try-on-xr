// physics/src/systems/constraints/distance.rs

use crate::engine::state::PhysicsState;
use crate::utils::coloring;
use std::collections::HashMap;

/// Enforces edge length preservation (Stretch Resistance).
/// Uses XPBD (Extended Position Based Dynamics) to handle stiffness compliance.
/// Constraints are colored (batched) to allow stable sequential solving.
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

    /// Solves distance constraints (Edge Springs).
    /// This gives the cloth its "tensile strength".
    /// Uses infinite stiffness (compliance = 0.0) by default to prevent stretching like rubber.
    ///
    /// OPTIMIZATION: Uses 4x loop unrolling for better instruction-level parallelism.
    /// By batching calls to solve_single, we increase the work per iteration,
    /// allowing the CPU to potentially execute independent operations in parallel
    /// and better utilizing the instruction pipeline.
    #[inline(never)]
    pub fn solve(&self, state: &mut PhysicsState, omega: f32, dt: f32) {
        let dt_sq_inv = 1.0 / (dt * dt);

        for b in 0..(self.batch_offsets.len() - 1) {
            let start = self.batch_offsets[b];
            let end = self.batch_offsets[b + 1];
            let count = end - start;

            // Process 4 constraints at a time
            let chunks = count / 4;
            let remainder = count % 4;

            for chunk in 0..chunks {
                let base = start + chunk * 4;

                // Unroll 4 iterations
                Self::solve_single(state, &self.constraints[base], self.rest_lengths[base], self.compliances[base] * dt_sq_inv, omega);
                Self::solve_single(state, &self.constraints[base + 1], self.rest_lengths[base + 1], self.compliances[base + 1] * dt_sq_inv, omega);
                Self::solve_single(state, &self.constraints[base + 2], self.rest_lengths[base + 2], self.compliances[base + 2] * dt_sq_inv, omega);
                Self::solve_single(state, &self.constraints[base + 3], self.rest_lengths[base + 3], self.compliances[base + 3] * dt_sq_inv, omega);
            }

            // Handle remainder
            for k in (start + chunks * 4)..(start + chunks * 4 + remainder) {
                Self::solve_single(state, &self.constraints[k], self.rest_lengths[k], self.compliances[k] * dt_sq_inv, omega);
            }
        }
    }

    /// Solves a single distance constraint.
    /// Separated for cleaner unrolling and potential inlining.
    #[inline(always)]
    fn solve_single(state: &mut PhysicsState, constraint: &[usize; 2], rest_length: f32, alpha: f32, omega: f32) {
        let [i1, i2] = *constraint;
        let w1 = state.inv_mass[i1];
        let w2 = state.inv_mass[i2];
        let w_sum = w1 + w2;
        if w_sum == 0.0 { return; }

        let p1 = state.positions[i1];
        let p2 = state.positions[i2];
        let delta = p1 - p2;
        let len = delta.length();
        if len < 1e-6 { return; }

        let c = len - rest_length;
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