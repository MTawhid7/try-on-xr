// physics/src/engine/state.rs
use glam::Vec3;

pub struct PhysicsState {
    pub count: usize,
    pub positions: Vec<Vec3>,
    pub prev_positions: Vec<Vec3>,
    pub inv_mass: Vec<f32>,
    pub indices: Vec<u32>,

    // FIX: Suppress warning because this is read by JS, not Rust
    #[allow(dead_code)]
    pub normals: Vec<Vec3>,
}

impl PhysicsState {
    pub fn new(raw_positions: Vec<f32>, raw_indices: Vec<u32>) -> Self {
        let count = raw_positions.len() / 3;
        let mut positions = Vec::with_capacity(count);
        let mut prev_positions = Vec::with_capacity(count);
        let mut normals = Vec::with_capacity(count);

        for i in 0..count {
            let v = Vec3::new(
                raw_positions[i * 3],
                raw_positions[i * 3 + 1],
                raw_positions[i * 3 + 2],
            );
            positions.push(v);
            prev_positions.push(v);
            normals.push(Vec3::Y);
        }

        let inv_mass = vec![1.0; count];

        PhysicsState {
            count,
            positions,
            prev_positions,
            inv_mass,
            indices: raw_indices,
            normals,
        }
    }
}