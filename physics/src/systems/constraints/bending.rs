// physics/src/systems/constraints/bending.rs

use crate::engine::state::PhysicsState;
use std::collections::HashSet;

pub struct BendingConstraint {
    pub constraints: Vec<[usize; 2]>,
    pub rest_lengths: Vec<f32>,
    pub compliances: Vec<f32>,
}

impl BendingConstraint {
    pub fn new(state: &PhysicsState, _default_compliance: f32) -> Self {
        let mut constraints = Vec::new();
        let mut rest_lengths = Vec::new();
        let mut compliances = Vec::new();

        // 1. Build Adjacency
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

        // 2. Build Constraints (2-ring neighbors)
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

                    constraints.push([i, far_neighbor]);
                    rest_lengths.push(p1.distance(p2));

                    // --- ANISOTROPIC LOGIC ---
                    let uv1 = state.uvs[i];
                    let uv2 = state.uvs[far_neighbor];

                    let du = (uv1.x - uv2.x).abs();
                    let dv = (uv1.y - uv2.y).abs();

                    // Check alignment
                    // If du is much larger than dv, it's U-aligned (Horizontal)
                    // If dv is much larger than du, it's V-aligned (Vertical)
                    let is_axis_aligned = du > 2.0 * dv || dv > 2.0 * du;

                    if is_axis_aligned {
                        // Warp/Weft: Stiff (Cotton)
                        compliances.push(0.5);
                    } else {
                        // Bias (Diagonal): Soft (Stretch)
                        // This allows the fabric to drape naturally over curves
                        compliances.push(2.0);
                    }
                }
            }
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