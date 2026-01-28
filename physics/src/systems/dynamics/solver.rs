// physics/src/systems/dynamics/solver.rs

use crate::engine::state::PhysicsState;
use crate::engine::config::PhysicsConfig;
use crate::collision::CollisionResolver;
use crate::systems::constraints::{
    DistanceConstraint,
    BendingConstraint,
    TetherConstraint
};

pub struct Solver {
    distance_constraint: DistanceConstraint,
    bending_constraint: BendingConstraint,
    tether_constraint: TetherConstraint,
}

impl Solver {
    pub fn new(state: &PhysicsState, scale_factor: f32) -> Self {
        let distance_constraint = DistanceConstraint::new(state);

        // Tune bending stiffness based on scale
        // Larger shirts need to be stiffer to avoid looking like wet tissue paper.
        let base_compliance = 1.0;
        let tuned_compliance = base_compliance * (scale_factor * scale_factor);

        let bending_constraint = BendingConstraint::new(state, tuned_compliance);
        let tether_constraint = TetherConstraint::new(state);

        Self {
            distance_constraint,
            bending_constraint,
            tether_constraint,
        }
    }

    pub fn solve(
        &self,
        state: &mut PhysicsState,
        resolver: &CollisionResolver,
        config: &PhysicsConfig,
        dt: f32
    ) {
        for _ in 0..config.solver_iterations {
            self.distance_constraint.solve(state, dt);
            self.bending_constraint.solve(state, dt);
            self.tether_constraint.solve(state, dt);

            // Resolve collisions last to prevent constraints pushing particles into the body
            resolver.resolve_contacts(state, config, dt);
        }
    }
}