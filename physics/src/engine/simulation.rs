// physics/src/engine/simulation.rs

use crate::engine::{PhysicsState, PhysicsConfig};
use crate::collision::{MeshCollider, CollisionResolver};
use crate::systems::dynamics::{Solver, Integrator};
use crate::systems::forces::Aerodynamics;
use crate::systems::constraints::MouseConstraint;
use crate::utils::normals;

/// The core physics simulation state and logic container.
/// Holds all subsystems (solver, collider, aerodynamics, etc.) and orchestrates the time step.
pub struct Simulation {
    /// The raw particle data (Position, Velocity, Mass).
    pub state: PhysicsState,
    /// Configuration parameters for the solver.
    pub config: PhysicsConfig,
    /// The static collision geometry (e.g., the Mannequin).
    pub collider: MeshCollider,
    /// Handles collision detection and response.
    pub resolver: CollisionResolver,
    /// Solves internal constraints (Distance, Bending, etc.).
    pub solver: Solver,
    /// Calculates external wind/drag forces.
    pub aerodynamics: Aerodynamics,
    /// Handles user interaction (Mouse dragging).
    pub mouse: MouseConstraint,
}

impl Simulation {
    pub fn new(
        garment_pos: Vec<f32>,
        garment_indices: Vec<u32>,
        garment_uvs: Vec<f32>,
        collider_pos: Vec<f32>,
        collider_normals: Vec<f32>,
        collider_indices: Vec<u32>,
        collider_smoothing: usize,
        collider_inflation: f32,
        scale_factor: f32
    ) -> Self {
        let state = PhysicsState::new(&garment_pos, &garment_indices, &garment_uvs);
        let particle_count = state.count; // Exact count

        let config = PhysicsConfig::default();

        let collider = MeshCollider::new(
            collider_pos,
            collider_normals,
            collider_indices,
            collider_smoothing,
            collider_inflation
        );

        // Subsystems now initialized with fixed-size buffers
        let resolver = CollisionResolver::new(particle_count);
        let aerodynamics = Aerodynamics::new(particle_count);

        let solver = Solver::new(&state, scale_factor);
        let mouse = MouseConstraint::new();

        Self {
            state,
            config,
            collider,
            resolver,
            solver,
            aerodynamics,
            mouse,
        }
    }

    /// Advances the simulation by `dt` seconds.
    /// Uses a sub-stepping approach for stability (e.g., 5-10 substeps per frame).
    pub fn step(&mut self, dt: f32) {
        let sdt = dt / self.config.substeps as f32;

        self.resolver.broad_phase(&self.state, &mut self.collider);

        for _ in 0..self.config.substeps {
            let forces = self.aerodynamics.apply(&self.state, &self.config, sdt);
            Integrator::integrate(&mut self.state, &self.config, forces, sdt);
            self.mouse.solve(&mut self.state, sdt);
            self.resolver.narrow_phase(&mut self.state, &self.collider, &self.config, sdt);
            self.solver.solve(&mut self.state, &self.resolver, &self.config, sdt);
        }

        // Compute vertex normals in WASM (moved from JavaScript for performance)
        normals::compute_vertex_normals(
            &self.state.positions,
            &self.state.indices,
            &mut self.state.normals
        );
    }
}