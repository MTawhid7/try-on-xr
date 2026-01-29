// physics/src/systems/constraints/bending.rs

use crate::engine::state::PhysicsState;
use crate::utils::coloring;
use std::collections::HashSet;

pub struct BendingConstraint {
    pub constraints: Vec<[usize; 2]>,
    pub rest_lengths: Vec<f32>,
    pub compliances: Vec<f32>,
    pub batch_offsets: Vec<usize>,
}

impl BendingConstraint {
    // Renamed argument to 'compliance_factor' to be explicit
    pub fn new(state: &PhysicsState, compliance_factor: f32) -> Self {
        let mut raw_constraints = Vec::new();
        let mut raw_rest_lengths = Vec::new();
        let mut raw_compliances = Vec::new();

        let mut adj = vec![HashSet::new(); state.count];
        let num_triangles = state.indices.len() / 3;

        for i in 0..num_triangles {
            let idx0 = state.indices[i * 3] as usize;
            let idx1 = state.indices[i * 3 + 1] as usize;
            let idx2 = state.indices[i * 3 + 2] as usize;

            adj[idx0].insert(idx1); adj[idx0].insert(idx2);
            adj[idx1].insert(idx0); adj[idx1].insert(idx2);
            adj[idx2].insert(idx0); adj[idx2].insert(idx1);
        }

        let mut processed = HashSet::new();

        for i in 0..state.count {
            for &neighbor in &adj[i] {
                for &far_neighbor in &adj[neighbor] {
                    if i == far_neighbor { continue; }
                    if adj[i].contains(&far_neighbor) { continue; }

                    let pair = if i < far_neighbor { (i, far_neighbor) } else { (far_neighbor, i) };
                    if processed.contains(&pair) { continue; }
                    processed.insert(pair);

                    let p1 = state.positions[i];
                    let p2 = state.positions[far_neighbor];

                    raw_constraints.push([i, far_neighbor]);
                    raw_rest_lengths.push(p1.distance(p2));

                    let uv1 = state.uvs[i];
                    let uv2 = state.uvs[far_neighbor];

                    let du = (uv1.x - uv2.x).abs();
                    let dv = (uv1.y - uv2.y).abs();
                    let is_axis_aligned = du > 2.0 * dv || dv > 2.0 * du;

                    // FIX: Use compliance_factor to scale the base values.
                    // Base values stiffened: 0.5 -> 0.1 (Cotton/Denim feel)
                    if is_axis_aligned {
                        raw_compliances.push(0.1 * compliance_factor);
                    } else {
                        raw_compliances.push(1.0 * compliance_factor);
                    }
                }
            }
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

    pub fn solve(&self, state: &mut PhysicsState, omega: f32, dt: f32) {
        for b in 0..(self.batch_offsets.len() - 1) {
            let start = self.batch_offsets[b];
            let end = self.batch_offsets[b + 1];

            for k in start..end {
                let [i1, i2] = self.constraints[k];
                let w1 = state.inv_mass[i1];
                let w2 = state.inv_mass[i2];
                let w_sum = w1 + w2;
                if w_sum == 0.0 { continue; }

                let alpha = self.compliances[k] / (dt * dt);
                let p1 = state.positions[i1];
                let p2 = state.positions[i2];
                let delta = p1 - p2;
                let len = delta.length();
                if len < 1e-6 { continue; }

                let rest = self.rest_lengths[k];
                let c = len - rest;

                let delta_lambda = -c / (w_sum + alpha);
                let correction_vector = (delta / len) * delta_lambda;

                let accelerated_correction = correction_vector * omega;

                if w1 > 0.0 { state.positions[i1] += accelerated_correction * w1; }
                if w2 > 0.0 { state.positions[i2] -= accelerated_correction * w2; }
            }
        }
    }
}