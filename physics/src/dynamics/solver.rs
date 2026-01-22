// physics/src/dynamics/solver.rs
use crate::engine::state::PhysicsState;
use crate::constraints::distance::DistanceConstraint;
use crate::constraints::bending::BendingConstraint;
use crate::constraints::tether::TetherConstraint; // Import
use crate::collision::CollisionResolver;

pub struct Solver {
    distance_constraint: DistanceConstraint,
    bending_constraint: BendingConstraint,
    tether_constraint: TetherConstraint, // Field
    iterations: usize,
}

impl Solver {
    pub fn new(state: &PhysicsState) -> Self {
        let distance_constraint = DistanceConstraint::new(state);
        let bending_constraint = BendingConstraint::new(state, 0.5);
        // Initialize Tethers
        let tether_constraint = TetherConstraint::new(state);

        Self {
            distance_constraint,
            bending_constraint,
            tether_constraint,
            iterations: 20,
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

            // Solve Tethers
            // They act like "Limiters", so running them inside the loop
            // ensures they work cooperatively with collision.
            self.tether_constraint.solve(state, dt);

            resolver.resolve_contacts(state, dt);
        }
    }
}