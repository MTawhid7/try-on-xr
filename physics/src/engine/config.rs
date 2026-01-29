// physics/sr/engine/config.rs

use glam::Vec3;

#[derive(Clone, Debug)]
pub struct PhysicsConfig {
    // --- Simulation Quality ---
    pub substeps: usize,
    pub solver_iterations: usize,
    pub spectral_radius: f32, // Chebyshev
    pub gravity: Vec3,
    pub wind: Vec3,
    pub damping: f32,
    // --- Material Properties ---

    pub drag_coeff: f32,
    pub lift_coeff: f32,
    #[allow(dead_code)]
    pub density: f32,
    pub area_compliance: f32,
    pub contact_thickness: f32,
    pub static_friction: f32,
    pub dynamic_friction: f32,
    pub collision_stiffness: f32,
}

impl PhysicsConfig {
    pub fn default() -> Self {
        Self {
            substeps: 8,
            solver_iterations: 15,

            // Reduced to 0.90 to prevent "over-drive" noise (micro-crumples)
            spectral_radius: 0.90,

            gravity: Vec3::new(0.0, -9.81, 0.0),
            wind: Vec3::new(0.0, 0.0, 0.0),
            damping: 0.99,

            drag_coeff: 2.0,
            lift_coeff: 0.05,
            density: 1.0,

            // RELAXED: Changed from 1e-6 to 1e-4.
            // This allows slight shearing, preventing the "buckling" artifacts
            // while still maintaining the overall surface area.
            area_compliance: 1.0e-4,

            contact_thickness: 0.005,
            static_friction: 0.3,
            dynamic_friction: 0.2,
            collision_stiffness: 0.9,
        }
    }
}