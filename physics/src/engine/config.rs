// physics/sr/engine/config.rs

use glam::Vec3;

#[derive(Clone, Debug)]
pub struct PhysicsConfig {
    // --- Simulation Quality ---
    pub substeps: usize,
    pub solver_iterations: usize,

    // --- Global Forces ---
    pub gravity: Vec3,
    pub wind: Vec3,

    // --- Material Properties ---
    pub drag_coeff: f32,      // Air resistance (Perpendicular)
    pub lift_coeff: f32,      // Air resistance (Parallel)

    #[allow(dead_code)]       // Placeholder for future mass calculation
    pub density: f32,

    // Compliance (Inverse Stiffness)
    pub area_compliance: f32,

    // --- Collision Settings ---
    pub contact_thickness: f32, // Distance to trigger collision (padding)
    pub static_friction: f32,
    pub dynamic_friction: f32,
    pub collision_stiffness: f32, // 0.0 to 1.0 (How hard the surface is)
}

impl PhysicsConfig {
    pub fn default() -> Self {
        Self {
            // Quality
            substeps: 8,
            solver_iterations: 25,

            // Forces
            gravity: Vec3::new(0.0, -9.81, 0.0),
            wind: Vec3::new(0.0, 0.0, 0.0),

            // Material (Cotton-like)
            drag_coeff: 2.0,
            lift_coeff: 0.05,
            density: 1.0,

            // Area Compliance:
            // Changed from 0.0 to 1e-6.
            // This provides "effectively rigid" behavior while preventing
            // numerical explosions if the mesh starts in a slightly invalid state.
            area_compliance: 1e-6,

            // Collision
            // 5mm thickness + 2mm visual inflation = ~7mm gap
            contact_thickness: 0.005,
            static_friction: 0.3,
            dynamic_friction: 0.2,

            // Response
            collision_stiffness: 0.9,
        }
    }
}