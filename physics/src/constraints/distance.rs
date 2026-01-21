// physics/src/constraints/distance.rs
use crate::engine::state::PhysicsState;
use std::collections::HashMap;

pub struct DistanceConstraint {
    pub constraints: Vec<[usize; 2]>,
    pub rest_lengths: Vec<f32>,
    pub compliances: Vec<f32>,
}

impl DistanceConstraint {
    pub fn new(state: &PhysicsState) -> Self {
        let mut constraints = Vec::new();
        let mut rest_lengths = Vec::new();
        let mut compliances = Vec::new();

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

            constraints.push([i1, i2]);
            rest_lengths.push(dist);

            // FIX: Set compliance to 0.0 (Rigid) for ALL edges.
            // This forces the solver to minimize stretching as much as possible.
            compliances.push(0.0);
        }

        Self {
            constraints,
            rest_lengths,
            compliances,
        }
    }

    pub fn solve(&self, state: &mut PhysicsState, dt: f32) {
        for k in 0..self.constraints.len() {
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
            let correction_scalar = -c / (w_sum + alpha);
            let correction_vector = (delta / len) * correction_scalar;

            if w1 > 0.0 { state.positions[i1] += correction_vector * w1; }
            if w2 > 0.0 { state.positions[i2] -= correction_vector * w2; }
        }
    }
}