// physics/src/systems/constraints/tether/mod.rs

mod vertical;
mod horizontal;

use crate::engine::state::PhysicsState;

pub struct TetherConstraint {
    pub constraints: Vec<[usize; 2]>,
    pub rest_lengths: Vec<f32>,
}

impl TetherConstraint {
    pub fn new(state: &PhysicsState) -> Self {
        // Generate both types of tethers
        let (mut constraints, mut rest_lengths) = vertical::generate(state);
        let (h_constraints, h_lengths) = horizontal::generate(state);

        // Merge them
        constraints.extend(h_constraints);
        rest_lengths.extend(h_lengths);

        Self {
            constraints,
            rest_lengths,
        }
    }

    pub fn solve(&self, state: &mut PhysicsState, _dt: f32) {
        let alpha = 0.0; // Rigid tether

        for k in 0..self.constraints.len() {
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

            // UNILATERAL CHECK:
            // Only correct if stretched (len > rest).
            if len <= rest { continue; }

            let c = len - rest;
            let correction_scalar = -c / (w_sum + alpha);
            let correction_vector = (delta / len) * correction_scalar;

            if w1 > 0.0 { state.positions[i1] += correction_vector * w1; }
            if w2 > 0.0 { state.positions[i2] -= correction_vector * w2; }
        }
    }
}