// physics/src/dynamics/solver.rs
use crate::engine::state::PhysicsState;
use crate::constraints::distance::DistanceConstraint;
use crate::constraints::bending::BendingConstraint;
use crate::constraints::tether::TetherConstraint;
use crate::collision::CollisionResolver;

pub struct Solver {
    distance_constraint: DistanceConstraint,
    bending_constraint: BendingConstraint,
    tether_constraint: TetherConstraint,
    iterations: usize,
}

impl Solver {
    pub fn new(state: &PhysicsState, scale_factor: f32) -> Self {
        let distance_constraint = DistanceConstraint::new(state);

        let base_compliance = 1.0;
        let tuned_compliance = base_compliance * (scale_factor * scale_factor);

        let bending_constraint = BendingConstraint::new(state, tuned_compliance);
        let tether_constraint = TetherConstraint::new(state);

        Self {
            distance_constraint,
            bending_constraint,
            tether_constraint,
            iterations: 25,
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
            self.tether_constraint.solve(state, dt);
            resolver.resolve_contacts(state, dt);
        }
    }
}