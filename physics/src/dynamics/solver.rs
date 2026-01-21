// physics/src/dynamics/solver.rs
use crate::engine::state::PhysicsState;
use crate::constraints::distance::DistanceConstraint;
use crate::constraints::bending::BendingConstraint;
use crate::collision::CollisionResolver;

pub struct Solver {
    distance_constraint: DistanceConstraint,
    bending_constraint: BendingConstraint,
    iterations: usize,
}

impl Solver {
    pub fn new(state: &PhysicsState) -> Self {
        let distance_constraint = DistanceConstraint::new(state);
        // Bending: 0.5 is good for cotton. Lower = Silk, Higher = Leather.
        let bending_constraint = BendingConstraint::new(state, 0.5);

        Self {
            distance_constraint,
            bending_constraint,
            // FIX: Increase iterations to cure "Rubber" effect.
            // 4 was too low. 15 gives us high stiffness.
            // Since we optimized the collision broad phase, we can afford this.
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
            resolver.resolve_contacts(state, dt);
        }
    }
}