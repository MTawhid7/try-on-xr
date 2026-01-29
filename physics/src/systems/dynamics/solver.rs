// physics/src/systems/dynamics/solver.rs

use crate::engine::state::PhysicsState;
use crate::engine::config::PhysicsConfig;
use crate::collision::CollisionResolver;
use crate::systems::constraints::{
    DistanceConstraint,
    BendingConstraint,
    TetherConstraint,
    AreaConstraint
};

pub struct Solver {
    distance_constraint: DistanceConstraint,
    bending_constraint: BendingConstraint,
    tether_constraint: TetherConstraint,
    area_constraint: AreaConstraint,
}

impl Solver {
    pub fn new(state: &PhysicsState, scale_factor: f32) -> Self {
        let distance_constraint = DistanceConstraint::new(state);

        // Tune bending stiffness based on scale
        let base_compliance = 1.0;
        let tuned_compliance = base_compliance * (scale_factor * scale_factor);

        let bending_constraint = BendingConstraint::new(state, tuned_compliance);
        let tether_constraint = TetherConstraint::new(state);

        // Initialize Area Constraint (Topology only)
        let area_constraint = AreaConstraint::new(state);

        Self {
            distance_constraint,
            bending_constraint,
            tether_constraint,
            area_constraint,
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

            // Solve Area Conservation
            // We pass the compliance from the config here.
            // This allows the user to change the material stiffness at runtime.
            self.area_constraint.solve(state, config.area_compliance, dt);

            // Resolve collisions last
            resolver.resolve_contacts(state, config, dt);
        }
    }
}