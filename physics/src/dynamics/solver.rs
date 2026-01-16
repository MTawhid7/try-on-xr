// physics/src/dynamics/solver.rs
use crate::engine::state::PhysicsState;
use crate::constraints::distance::DistanceConstraint;
use crate::constraints::bending::BendingConstraint;
// Import Collider and Resolver
use crate::collision::MeshCollider;
use crate::collision::CollisionResolver;

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
            iterations: 10, // Keep high iterations for stiffness
        }
    }

    // UPDATED SIGNATURE
    pub fn solve(
        &self,
        state: &mut PhysicsState,
        collider: &MeshCollider,
        resolver: &CollisionResolver,
        dt: f32
    ) {
        for _ in 0..self.iterations {
            // 1. Solve Cloth Stiffness
            self.distance_constraint.solve(state, dt);

            // 2. Solve Bending (Optional: Run every other step for perf)
            self.bending_constraint.solve(state, dt);

            // 3. Solve Collision (INTERLEAVED)
            // The cloth tries to shrink, the body pushes back.
            // Doing this in the loop finds the equilibrium.
            resolver.resolve_position(state, collider, dt);
        }
    }
}