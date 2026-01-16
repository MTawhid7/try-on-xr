// physics/src/dynamics/solver.rs
use crate::engine::state::PhysicsState;
use crate::constraints::distance::DistanceConstraint;
use crate::constraints::bending::BendingConstraint;

pub struct Solver {
    distance_constraint: DistanceConstraint,
    bending_constraint: BendingConstraint,
    iterations: usize,
}

impl Solver {
    pub fn new(state: &PhysicsState) -> Self {
        let distance_constraint = DistanceConstraint::new(state);
        let bending_constraint = BendingConstraint::new(state, 0.5);

        Self {
            distance_constraint,
            bending_constraint,
            // INCREASED: 10 iterations makes the constraints 2.5x stiffer than 4
            // This is much cheaper than increasing substeps.
            iterations: 10,
        }
    }

    pub fn solve(&self, state: &mut PhysicsState, dt: f32) {
        for _ in 0..self.iterations {
            self.distance_constraint.solve(state, dt);
            // Bending is soft, so we can run it less frequently to save CPU
            // Running it every other iteration is a common optimization
            self.bending_constraint.solve(state, dt);
        }
    }
}