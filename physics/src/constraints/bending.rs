// physics/src/constraints/bending.rs
use crate::engine::state::PhysicsState;
use std::collections::HashSet;

pub struct BendingConstraint {
    pub constraints: Vec<[usize; 2]>,
    pub rest_lengths: Vec<f32>,
    pub compliance: f32,
}

impl BendingConstraint {
    pub fn new(state: &PhysicsState, compliance: f32) -> Self {
        let mut constraints = Vec::new();
        let mut rest_lengths = Vec::new();

        // 1. Build Adjacency Map (Vertex -> Neighbors)
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

        // 2. Find "2-Ring" Neighbors (Neighbors of Neighbors)
        let mut processed = HashSet::new();

        for i in 0..state.count {
            for &neighbor in &adj[i] {
                for &far_neighbor in &adj[neighbor] {
                    if i == far_neighbor { continue; }
                    // If they are directly connected, it's a structural edge, not bending
                    if adj[i].contains(&far_neighbor) { continue; }

                    // Ensure unique pairs
                    let pair = if i < far_neighbor { (i, far_neighbor) } else { (far_neighbor, i) };
                    if processed.contains(&pair) { continue; }
                    processed.insert(pair);

                    // Add Constraint
                    let p1 = state.positions[i];
                    let p2 = state.positions[far_neighbor];

                    constraints.push([i, far_neighbor]);
                    rest_lengths.push(p1.distance(p2));
                }
            }
        }

        Self {
            constraints,
            rest_lengths,
            compliance,
        }
    }

    pub fn solve(&self, state: &mut PhysicsState, dt: f32) {
        let alpha = self.compliance / (dt * dt);

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
            let c = len - rest;

            let correction_scalar = -c / (w_sum + alpha);
            let correction_vector = (delta / len) * correction_scalar;

            if w1 > 0.0 { state.positions[i1] += correction_vector * w1; }
            if w2 > 0.0 { state.positions[i2] -= correction_vector * w2; }
        }
    }
}