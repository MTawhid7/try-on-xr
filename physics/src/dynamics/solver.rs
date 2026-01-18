// physics/src/dynamics/solver.rs
use crate::engine::state::PhysicsState;
use crate::constraints::distance::DistanceConstraint;
use crate::constraints::bending::BendingConstraint;
use crate::collision::CollisionResolver; // Updated Import

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
            iterations: 10, // High iterations for stiffness
        }
    }

    pub fn solve(
        &self,
        state: &mut PhysicsState,
        resolver: &CollisionResolver,
        dt: f32
    ) {
        for _ in 0..self.iterations {
            self.distance_constraint.solve(state, dt);
            self.bending_constraint.solve(state, dt);

            // CHANGED: Pass dt
            resolver.resolve_contacts(state, dt);
        }
    }
}