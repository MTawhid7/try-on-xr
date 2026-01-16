// physics/src/engine/simulation.rs
use crate::collision::MeshCollider;
use crate::collision::self_collision::SelfCollision;
use crate::collision::CollisionResolver;
use crate::dynamics::solver::Solver;
use crate::dynamics::forces::ForceUniform;
use crate::constraints::mouse::MouseConstraint;
use super::state::PhysicsState;

pub struct SimulationLoop {
    pub state: PhysicsState,
    pub collider: MeshCollider,
    pub self_collision: SelfCollision,
    pub resolver: CollisionResolver,
    pub solver: Solver,
    pub forces: ForceUniform,
    pub mouse: MouseConstraint,
}

impl SimulationLoop {
    pub fn new(
        garment_pos: Vec<f32>,
        garment_indices: Vec<u32>,
        garment_uvs: Vec<f32>,
        collider_pos: Vec<f32>,
        collider_normals: Vec<f32>,
        collider_indices: Vec<u32>
    ) -> Self {
        let state = PhysicsState::new(garment_pos, garment_indices, garment_uvs);
        let collider = MeshCollider::new(collider_pos, collider_normals, collider_indices);
        let self_collision = SelfCollision::new(&state, 0.015);
        let resolver = CollisionResolver::new();
        let solver = Solver::new(&state);
        let forces = ForceUniform::new();
        let mouse = MouseConstraint::new();

        SimulationLoop {
            state,
            collider,
            self_collision,
            resolver,
            solver,
            forces,
            mouse,
        }
    }

    pub fn step(&mut self, dt: f32) {
        // RESTORED: 10 substeps for high quality
        let substeps = 10;
        let sdt = dt / substeps as f32;

        for step_i in 0..substeps {
            self.forces.apply(&mut self.state, sdt);
            self.mouse.solve(&mut self.state, sdt);

            // 1. Find Contacts (Expensive, runs once)
            self.resolver.pre_solve(&mut self.state, &self.collider, sdt);

            // 2. Solve Constraints & Contacts (Cheap, runs 10x)
            self.solver.solve(
                &mut self.state,
                &self.resolver, // Pass resolver with cached contacts
                sdt
            );

            // 3. Self Collision (Run once per frame)
            if step_i == 0 {
                self.self_collision.solve(&mut self.state);
            }
        }
    }
}