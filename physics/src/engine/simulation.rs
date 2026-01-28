// physics/src/engine/simulation.rs

use crate::engine::{PhysicsState, PhysicsConfig};
use crate::collision::{MeshCollider, CollisionResolver};
use crate::systems::dynamics::{Solver, Integrator};
use crate::systems::forces::Aerodynamics;
use crate::systems::constraints::MouseConstraint;

pub struct Simulation {
    // Data
    pub state: PhysicsState,
    pub config: PhysicsConfig,

    // Subsystems
    pub collider: MeshCollider,
    pub resolver: CollisionResolver,
    pub solver: Solver,
    pub aerodynamics: Aerodynamics,
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
        let config = PhysicsConfig::default();

        let collider = MeshCollider::new(
            collider_pos,
            collider_normals,
            collider_indices,
            collider_smoothing,
            collider_inflation
        );

        let resolver = CollisionResolver::new();
        let solver = Solver::new(&state, scale_factor);
        let aerodynamics = Aerodynamics::new();
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

    pub fn step(&mut self, dt: f32) {
        // Divide the frame time by the number of substeps for stability
        let sdt = dt / self.config.substeps as f32;

        // 1. Broad Phase Collision Detection
        // We do this once per frame as the body doesn't move fast enough to require substep checks.
        self.resolver.broad_phase(&self.state, &self.collider);

        for _ in 0..self.config.substeps {
            // 2. Apply External Forces (Gravity + Wind + Drag/Lift)
            let forces = self.aerodynamics.apply(&self.state, &self.config, sdt);

            // 3. Integrate (Verlet: Update Positions based on Forces)
            Integrator::integrate(&mut self.state, &self.config, forces, sdt);

            // 4. Solve User Interaction (Mouse Drag)
            self.mouse.solve(&mut self.state, sdt);

            // 5. Narrow Phase Collision Detection
            // Checks precise triangle intersections for candidates found in Broad Phase.
            self.resolver.narrow_phase(&mut self.state, &self.collider, &self.config, sdt);

            // 6. Solve Constraints & Resolve Contacts
            // This enforces cloth structure (Distance/Bending) and pushes particles out of the body.
            self.solver.solve(&mut self.state, &self.resolver, &self.config, sdt);
        }
    }
}