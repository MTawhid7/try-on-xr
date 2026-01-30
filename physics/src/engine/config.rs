// physics/sr/engine/config.rs

use glam::Vec3;

/// Global configuration for the physics simulation.
/// Controls solver quality/speed trade-offs and physical properties like gravity and stiffness.
#[derive(Clone, Debug)]
pub struct PhysicsConfig {
    // --- Simulation Quality ---
    /// Number of sub-steps per frame. Higher = More stable, Slower.
    pub substeps: usize,
    /// Number of solver iterations per sub-step. Higher = Stiffer constraints.
    pub solver_iterations: usize,
    /// Relaxation parameter (Successive Over-Relaxation). 1.0 = Gauss-Seidel. <1.0 = More stable.
    pub spectral_radius: f32,

    // --- Environment ---
    pub gravity: Vec3,
    pub wind: Vec3,
    /// Global Velocity Damping (0.0 to 1.0). Simulates air resistance.
    pub damping: f32,

    // --- Material Properties ---
    pub drag_coeff: f32,
    pub lift_coeff: f32,
    #[allow(dead_code)]
    pub density: f32,

    // --- Constraint Stiffness ---
    /// Resistance to area change (Shearing). Very low for cloth.
    pub area_compliance: f32,
    /// Distance between cloth layers or cloth/body.
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

            // Reduced to 0.85 to prevent "locking" the mesh into a rigid shape.
            spectral_radius: 0.85,

            gravity: Vec3::new(0.0, -9.81, 0.0),
            wind: Vec3::new(0.0, 0.0, 0.0),
            damping: 0.99,

            // Reduced drag so the cloth falls naturally instead of floating
            drag_coeff: 0.5,
            lift_coeff: 0.05,
            density: 1.0,

            // RELAXED: 2.0e-4 allows for natural draping/shearing.
            // 1e-6 was effectively "Sheet Metal".
            area_compliance: 2.0e-4,

            contact_thickness: 0.005,
            static_friction: 0.3,
            dynamic_friction: 0.2,
            collision_stiffness: 0.9,
        }
    }
}