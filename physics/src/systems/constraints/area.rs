// physics/src/systems/constraints/area.rs

use crate::engine::state::PhysicsState;
use crate::utils::coloring;
use glam::Vec4;

/// Enforces triangle area preservation.
/// Prevents the mesh from shearing or collapsing, simulating the material's resistance to planar deformation.
pub struct AreaConstraint {
    indices: Vec<[usize; 3]>,
    rest_areas: Vec<f32>,
    batch_offsets: Vec<usize>,
}

impl AreaConstraint {
    /// Computes the rest area of every triangle in the mesh.
    pub fn new(state: &PhysicsState) -> Self {
        let num_triangles = state.indices.len() / 3;
        let mut raw_indices = Vec::with_capacity(num_triangles);
        let mut raw_rest_areas = Vec::with_capacity(num_triangles);

        for i in 0..num_triangles {
            let idx0 = state.indices[i * 3] as usize;
            let idx1 = state.indices[i * 3 + 1] as usize;
            let idx2 = state.indices[i * 3 + 2] as usize;

            let p0 = state.positions[idx0];
            let p1 = state.positions[idx1];
            let p2 = state.positions[idx2];

            let u = p1 - p0;
            let v = p2 - p0;
            let u3 = u.truncate();
            let v3 = v.truncate();
            let cross = u3.cross(v3);
            let area = 0.5 * cross.length();

            if area > 1e-6 {
                raw_indices.push([idx0, idx1, idx2]);
                raw_rest_areas.push(area);
            }
        }

        let (sorted_indices, batch_offsets) = coloring::color_constraints_3(&raw_indices, state.count);

        let mut indices = Vec::with_capacity(raw_indices.len());
        let mut rest_areas = Vec::with_capacity(raw_indices.len());

        for idx in sorted_indices {
            indices.push(raw_indices[idx]);
            rest_areas.push(raw_rest_areas[idx]);
        }

        Self {
            indices,
            rest_areas,
            batch_offsets,
        }
    }

    /// Solves the area constraint using XPBD.
    /// 1. Computes the current area of each triangle.
    /// 2. Compares it to the rest area.
    /// 3. Applies positional corrections (gradients) to restore the original area.
    pub fn solve(&self, state: &mut PhysicsState, compliance: f32, omega: f32, dt: f32) {
        let alpha = compliance / (dt * dt);

        for b in 0..(self.batch_offsets.len() - 1) {
            let start = self.batch_offsets[b];
            let end = self.batch_offsets[b + 1];

            for k in start..end {
                let [i0, i1, i2] = self.indices[k];

                let w0 = state.inv_mass[i0];
                let w1 = state.inv_mass[i1];
                let w2 = state.inv_mass[i2];
                let w_sum = w0 + w1 + w2;
                if w_sum == 0.0 { continue; }

                let p0 = state.positions[i0];
                let p1 = state.positions[i1];
                let p2 = state.positions[i2];

                let u = p1 - p0;
                let v = p2 - p0;
                let u3 = u.truncate();
                let v3 = v.truncate();
                let cross = u3.cross(v3);
                let current_area = 0.5 * cross.length();

                let rest_area = self.rest_areas[k];
                let c = current_area - rest_area;

                if c.abs() < 1e-6 { continue; }
                if current_area < 1e-9 { continue; }

                let n = cross / (2.0 * current_area);

                let grad0 = 0.5 * (p2.truncate() - p1.truncate()).cross(n);
                let grad1 = 0.5 * (p0.truncate() - p2.truncate()).cross(n);
                let grad2 = 0.5 * (p1.truncate() - p0.truncate()).cross(n);

                let denom = w0 * grad0.length_squared() +
                            w1 * grad1.length_squared() +
                            w2 * grad2.length_squared();

                if denom < 1e-9 { continue; }

                let delta_lambda = -c / (denom + alpha);

                // Chebyshev Scaling
                let lambda_omega = delta_lambda * omega;

                if w0 > 0.0 { state.positions[i0] += Vec4::from((grad0 * (lambda_omega * w0), 0.0)); }
                if w1 > 0.0 { state.positions[i1] += Vec4::from((grad1 * (lambda_omega * w1), 0.0)); }
                if w2 > 0.0 { state.positions[i2] += Vec4::from((grad2 * (lambda_omega * w2), 0.0)); }
            }
        }
    }
}