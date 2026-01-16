// physics/src/engine/simulation.rs
use glam::Vec3;
use crate::collision::MeshCollider;
use crate::collision::self_collision::SelfCollision; // Import
use crate::dynamics::solver::Solver;
use crate::dynamics::forces::ForceUniform;
use crate::constraints::mouse::MouseConstraint;
use super::state::PhysicsState;

pub struct SimulationLoop {
    pub state: PhysicsState,
    pub collider: MeshCollider,
    pub self_collision: SelfCollision, // Add field
    pub solver: Solver,
    pub forces: ForceUniform,
    pub mouse: MouseConstraint,
}

impl SimulationLoop {
    pub fn new(
        garment_pos: Vec<f32>,
        garment_indices: Vec<u32>,
        garment_uvs: Vec<f32>, // NEW
        collider_pos: Vec<f32>,
        collider_normals: Vec<f32>,
        collider_indices: Vec<u32>
    ) -> Self {
        // Pass UVs to State
        let state = PhysicsState::new(garment_pos, garment_indices, garment_uvs);

        let collider = MeshCollider::new(collider_pos, collider_normals, collider_indices);
        let self_collision = SelfCollision::new(&state, 0.015);
        let solver = Solver::new(&state);
        let forces = ForceUniform::new();
        let mouse = MouseConstraint::new();

        SimulationLoop {
            state,
            collider,
            self_collision,
            solver,
            forces,
            mouse,
        }
    }

    pub fn step(&mut self, dt: f32) {
        let substeps = 10;
        let sdt = dt / substeps as f32;

        for step_i in 0..substeps {
            self.forces.apply(&mut self.state, sdt);
            self.mouse.solve(&mut self.state, sdt);
            self.solver.solve(&mut self.state, sdt);
            self.resolve_collisions();

            // Run Self-Collision less frequently to save CPU.
            // Running it every 5th substep (2 times per frame) is a good balance.
            if step_i % 5 == 0 {
                self.self_collision.solve(&mut self.state);
            }
        }
    }

    fn resolve_collisions(&mut self) {
        // Increase search radius to catch fast moving particles
        let search_radius = 0.05; // 5cm
        let thickness = 0.008;    // 8mm skin offset

        for i in 0..self.state.count {
            if self.state.inv_mass[i] == 0.0 { continue; }

            let pos = self.state.positions[i];

            if let Some((surface_point, normal, _dist)) = self.collider.query_closest(pos, search_radius) {

                // Vector from surface to particle
                let vec = pos - surface_point;

                // Dot product tells us if we are Inside or Outside
                // < 0.0 means we are BEHIND the face (Inside the body)
                let projection = vec.dot(normal);

                // If we are inside OR within the skin thickness
                if projection < thickness {
                    // 1. Position Correction
                    // Push out to surface + thickness
                    let penetration = thickness - projection;
                    let correction = normal * penetration;
                    self.state.positions[i] += correction;

                    // 2. Friction & Velocity Kill
                    let prev = self.state.prev_positions[i];
                    let velocity = self.state.positions[i] - prev;

                    // Separate velocity into Normal (bouncing) and Tangent (sliding) components
                    let v_normal_mag = velocity.dot(normal);
                    let v_normal = normal * v_normal_mag;
                    let v_tangent = velocity - v_normal;

                    // FRICTION LOGIC:
                    // If the surface points UP (shoulders), high friction (sticky).
                    // If vertical (chest/back), low friction (sliding).
                    let is_horizontal = normal.y > 0.7;
                    let friction = if is_horizontal { 1.0 } else { 0.1 };

                    // Apply friction to tangent velocity
                    let new_tangent = v_tangent * (1.0 - friction);

                    // Kill normal velocity if moving into body (stop bouncing)
                    let new_normal = if v_normal_mag < 0.0 { Vec3::ZERO } else { v_normal };

                    // Reconstruct previous position
                    self.state.prev_positions[i] = self.state.positions[i] - (new_normal + new_tangent);
                }
            }
        }
    }
}