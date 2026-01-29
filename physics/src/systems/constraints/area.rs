// physics/src/systems/constraints/area.rs

use crate::engine::state::PhysicsState;

pub struct AreaConstraint {
    indices: Vec<[usize; 3]>,
    rest_areas: Vec<f32>,
    // REMOVED: compliance (It is now passed at runtime)
}

impl AreaConstraint {
    pub fn new(state: &PhysicsState) -> Self {
        let num_triangles = state.indices.len() / 3;
        let mut indices = Vec::with_capacity(num_triangles);
        let mut rest_areas = Vec::with_capacity(num_triangles);

        for i in 0..num_triangles {
            let idx0 = state.indices[i * 3] as usize;
            let idx1 = state.indices[i * 3 + 1] as usize;
            let idx2 = state.indices[i * 3 + 2] as usize;

            let p0 = state.positions[idx0];
            let p1 = state.positions[idx1];
            let p2 = state.positions[idx2];

            // Calculate Rest Area
            // Area = 0.5 * |(p1 - p0) x (p2 - p0)|
            let u = p1 - p0;
            let v = p2 - p0;
            let cross = u.cross(v);
            let area = 0.5 * cross.length();

            // Only add non-degenerate triangles
            if area > 1e-6 {
                indices.push([idx0, idx1, idx2]);
                rest_areas.push(area);
            }
        }

        Self {
            indices,
            rest_areas,
        }
    }

    // Compliance is now passed per-frame, allowing runtime material changes
    pub fn solve(&self, state: &mut PhysicsState, compliance: f32, dt: f32) {
        let alpha = compliance / (dt * dt);

        for k in 0..self.indices.len() {
            let [i0, i1, i2] = self.indices[k];

            let w0 = state.inv_mass[i0];
            let w1 = state.inv_mass[i1];
            let w2 = state.inv_mass[i2];

            let w_sum = w0 + w1 + w2;
            if w_sum == 0.0 { continue; }

            let p0 = state.positions[i0];
            let p1 = state.positions[i1];
            let p2 = state.positions[i2];

            // Current Area Calculation
            let u = p1 - p0;
            let v = p2 - p0;
            let cross = u.cross(v);
            let current_area = 0.5 * cross.length();

            // Constraint: C(x) = A - A_rest
            let rest_area = self.rest_areas[k];
            let c = current_area - rest_area;

            if c.abs() < 1e-6 { continue; }

            // Gradients
            if current_area < 1e-9 { continue; }

            let n = cross / (2.0 * current_area); // Normalized normal

            let grad0 = 0.5 * (p2 - p1).cross(n);
            let grad1 = 0.5 * (p0 - p2).cross(n);
            let grad2 = 0.5 * (p1 - p0).cross(n);

            let denom = w0 * grad0.length_squared() +
                        w1 * grad1.length_squared() +
                        w2 * grad2.length_squared();

            if denom < 1e-9 { continue; }

            let delta_lambda = -c / (denom + alpha);

            if w0 > 0.0 { state.positions[i0] += grad0 * (delta_lambda * w0); }
            if w1 > 0.0 { state.positions[i1] += grad1 * (delta_lambda * w1); }
            if w2 > 0.0 { state.positions[i2] += grad2 * (delta_lambda * w2); }
        }
    }
}