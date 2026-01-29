// physics/src/systems/constraints/tether/mod.rs

mod vertical;
mod horizontal;

use crate::engine::state::PhysicsState;
use crate::utils::coloring;

pub struct TetherConstraint {
    pub constraints: Vec<[usize; 2]>,
    pub rest_lengths: Vec<f32>,
    pub batch_offsets: Vec<usize>,
}

impl TetherConstraint {
    pub fn new(state: &PhysicsState) -> Self {
        // Generate both types of tethers
        let (v_constraints, v_lengths) = vertical::generate(state);
        let (h_constraints, h_lengths) = horizontal::generate(state);

        let mut raw_constraints = v_constraints;
        raw_constraints.extend(h_constraints);

        let mut raw_rest_lengths = v_lengths;
        raw_rest_lengths.extend(h_lengths);

        // --- GRAPH COLORING ---
        let (sorted_indices, batch_offsets) = coloring::color_constraints(&raw_constraints, state.count);

        let mut constraints = Vec::with_capacity(raw_constraints.len());
        let mut rest_lengths = Vec::with_capacity(raw_constraints.len());

        for idx in sorted_indices {
            constraints.push(raw_constraints[idx]);
            rest_lengths.push(raw_rest_lengths[idx]);
        }

        Self {
            constraints,
            rest_lengths,
            batch_offsets,
        }
    }

    pub fn solve(&self, state: &mut PhysicsState, _dt: f32) {
        let alpha = 0.0; // Rigid tether

        for b in 0..(self.batch_offsets.len() - 1) {
            let start = self.batch_offsets[b];
            let end = self.batch_offsets[b + 1];

            for k in start..end {
                let [i1, i2] = self.constraints[k];
                let w1 = state.inv_mass[i1];
                let w2 = state.inv_mass[i2];
                let w_sum = w1 + w2;
                if w_sum == 0.0 { continue; }

                let p1 = state.positions[i1];
                let p2 = state.positions[i2];
                let delta = p1 - p2;
                let len = delta.length();

                if len < 1e-6 { continue; }

                let rest = self.rest_lengths[k];

                // UNILATERAL CHECK: Only correct if stretched
                if len <= rest { continue; }

                let c = len - rest;
                let correction_scalar = -c / (w_sum + alpha);
                let correction_vector = (delta / len) * correction_scalar;

                if w1 > 0.0 { state.positions[i1] += correction_vector * w1; }
                if w2 > 0.0 { state.positions[i2] -= correction_vector * w2; }
            }
        }
    }
}