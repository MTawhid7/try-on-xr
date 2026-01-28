// physics/src/engine/state.rs
use glam::{Vec3, Vec2};

pub struct PhysicsState {
    pub count: usize,

    // --- Particle Data ---
    pub positions: Vec<Vec3>,
    pub prev_positions: Vec<Vec3>,
    pub velocities: Vec<Vec3>, // Explicit velocity tracking (optional but good for damping)
    pub inv_mass: Vec<f32>,
    pub normals: Vec<Vec3>,
    pub uvs: Vec<Vec2>,        // Needed for Anisotropic Bending

    // --- Topology ---
    pub indices: Vec<u32>,     // Triangle indices
}

impl PhysicsState {
    pub fn new(
        raw_positions: &[f32],
        raw_indices: &[u32],
        raw_uvs: &[f32]
    ) -> Self {
        let count = raw_positions.len() / 3;

        let mut positions = Vec::with_capacity(count);
        let mut prev_positions = Vec::with_capacity(count);
        let velocities = vec![Vec3::ZERO; count];
        let normals = vec![Vec3::Y; count];
        let mut uvs = Vec::with_capacity(count);

        // 1. Parse Positions
        for i in 0..count {
            let p = Vec3::new(
                raw_positions[i * 3],
                raw_positions[i * 3 + 1],
                raw_positions[i * 3 + 2],
            );
            positions.push(p);
            prev_positions.push(p);
        }

        // 2. Parse UVs (Safety check for stride)
        for i in 0..count {
            if i * 2 + 1 < raw_uvs.len() {
                uvs.push(Vec2::new(raw_uvs[i * 2], raw_uvs[i * 2 + 1]));
            } else {
                uvs.push(Vec2::ZERO);
            }
        }

        // 3. Initialize Mass (Uniform for now)
        // In the future, we can calculate this based on triangle area * density
        let inv_mass = vec![1.0; count];

        PhysicsState {
            count,
            positions,
            prev_positions,
            velocities,
            inv_mass,
            normals,
            uvs,
            indices: raw_indices.to_vec(),
        }
    }
}