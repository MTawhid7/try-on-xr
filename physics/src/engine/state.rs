// physics/src/engine/state.rs
use glam::{Vec3, Vec2}; // Import Vec2

pub struct PhysicsState {
    pub count: usize,
    pub positions: Vec<Vec3>,
    pub prev_positions: Vec<Vec3>,
    pub inv_mass: Vec<f32>,
    pub indices: Vec<u32>,
    #[allow(dead_code)]
    pub normals: Vec<Vec3>,
    // NEW: UV Coordinates for Anisotropy
    pub uvs: Vec<Vec2>,
}

impl PhysicsState {
    // Update signature to accept UVs
    pub fn new(raw_positions: Vec<f32>, raw_indices: Vec<u32>, raw_uvs: Vec<f32>) -> Self {
        let count = raw_positions.len() / 3;
        let mut positions = Vec::with_capacity(count);
        let mut prev_positions = Vec::with_capacity(count);
        let mut normals = Vec::with_capacity(count);
        let mut uvs = Vec::with_capacity(count);

        for i in 0..count {
            positions.push(Vec3::new(
                raw_positions[i * 3],
                raw_positions[i * 3 + 1],
                raw_positions[i * 3 + 2],
            ));
            prev_positions.push(positions[i]);
            normals.push(Vec3::Y);

            // Parse UVs (stride 2)
            // Handle case where UVs might be missing or shorter (safety)
            if i * 2 + 1 < raw_uvs.len() {
                uvs.push(Vec2::new(raw_uvs[i * 2], raw_uvs[i * 2 + 1]));
            } else {
                uvs.push(Vec2::ZERO);
            }
        }

        let inv_mass = vec![1.0; count];

        PhysicsState {
            count,
            positions,
            prev_positions,
            inv_mass,
            indices: raw_indices,
            normals,
            uvs, // Store
        }
    }
}