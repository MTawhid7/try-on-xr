// physics/src/constraints/tether.rs
use crate::engine::state::PhysicsState;
use std::collections::HashMap;

pub struct TetherConstraint {
    pub constraints: Vec<[usize; 2]>,
    pub rest_lengths: Vec<f32>,
}

impl TetherConstraint {
    pub fn new(state: &PhysicsState) -> Self {
        let mut constraints = Vec::new();
        let mut rest_lengths = Vec::new();

        // --- PASS 1: VERTICAL TETHERS (Anti-Sag) ---
        // Prevents the hem from dropping like rubber.
        let cell_size = 0.03;
        let mut columns: HashMap<(i32, i32), Vec<usize>> = HashMap::new();

        for i in 0..state.count {
            let p = state.positions[i];
            let cell_x = (p.x / cell_size).floor() as i32;
            let cell_z = (p.z / cell_size).floor() as i32;

            columns.entry((cell_x, cell_z))
                .or_insert_with(Vec::new)
                .push(i);
        }

        for (_, indices) in columns {
            if indices.len() < 2 { continue; }

            let mut sorted = indices.clone();
            sorted.sort_by(|&a, &b| {
                state.positions[b].y.partial_cmp(&state.positions[a].y).unwrap()
            });

            let top_idx = sorted[0];
            let top_n = state.normals[top_idx];

            for &bottom_idx in sorted.iter().rev() {
                if top_idx == bottom_idx { continue; }
                let bottom_n = state.normals[bottom_idx];

                if top_n.dot(bottom_n) > 0.8 {
                    let p1 = state.positions[top_idx];
                    let p2 = state.positions[bottom_idx];
                    let dist = p1.distance(p2);

                    if dist > 0.10 {
                        constraints.push([top_idx, bottom_idx]);
                        rest_lengths.push(dist);
                        break;
                    }
                }
            }
        }

        // --- PASS 2: HORIZONTAL SHOULDER BRIDGES (Anti-Widen) ---
        // Prevents the neckline from stretching open and slipping off.
        // We look at the top 20% of the shirt.

        // 1. Find bounding box to determine "Top"
        let mut max_y = f32::MIN;
        for p in &state.positions {
            if p.y > max_y { max_y = p.y; }
        }

        let shoulder_threshold = max_y - 0.15; // Top 15cm (Neck & Shoulders)

        // 2. Bucket by Depth (Z) to find horizontal lines
        // We want to connect Left-Shoulder to Right-Shoulder within the same Z-plane.
        let z_cell_size = 0.04; // 4cm slices
        let mut rows: HashMap<i32, Vec<usize>> = HashMap::new();

        for i in 0..state.count {
            let p = state.positions[i];
            if p.y < shoulder_threshold { continue; }

            let cell_z = (p.z / z_cell_size).floor() as i32;
            rows.entry(cell_z).or_insert_with(Vec::new).push(i);
        }

        // 3. Connect Left-most to Right-most in each row
        for (_, indices) in rows {
            if indices.len() < 2 { continue; }

            let mut sorted = indices.clone();
            sorted.sort_by(|&a, &b| {
                state.positions[a].x.partial_cmp(&state.positions[b].x).unwrap()
            });

            // We connect pairs moving inward from the outside
            // Left-most <-> Right-most
            // Left+1 <-> Right-1
            // This creates a "Ladder" of constraints across the shoulders/neck.

            let count = sorted.len();
            let steps = count / 2; // Connect up to half the pairs

            for i in 0..steps {
                let left = sorted[i];
                let right = sorted[count - 1 - i];

                let p1 = state.positions[left];
                let p2 = state.positions[right];
                let dist = p1.distance(p2);

                // Only connect if they are far apart (crossing the body/neck)
                // and facing roughly the same way (Front-to-Front or Back-to-Back)
                // We don't want to connect Front-Left to Back-Right.
                if dist > 0.15 {
                    let n1 = state.normals[left];
                    let n2 = state.normals[right];

                    if n1.dot(n2) > 0.5 {
                        constraints.push([left, right]);
                        rest_lengths.push(dist);
                    }
                }
            }
        }

        Self {
            constraints,
            rest_lengths,
        }
    }

    pub fn solve(&self, state: &mut PhysicsState, _dt: f32) {
        let alpha = 0.0;

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
            // This allows the shirt to crumple inwards when arms are crossed,
            // but prevents it from expanding outwards or sliding off.
            if len <= rest { continue; }

            let c = len - rest;
            let correction_scalar = -c / (w_sum + alpha);
            let correction_vector = (delta / len) * correction_scalar;

            if w1 > 0.0 { state.positions[i1] += correction_vector * w1; }
            if w2 > 0.0 { state.positions[i2] -= correction_vector * w2; }
        }
    }
}