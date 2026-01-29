// physics/src/systems/dynamics/integrator.rs

use glam::{Vec3, Vec4};
use crate::engine::state::PhysicsState;
use crate::engine::config::PhysicsConfig;

pub struct Integrator;

impl Integrator {
    pub fn integrate(
        state: &mut PhysicsState,
        config: &PhysicsConfig,
        external_forces: &[Vec3],
        dt: f32
    ) {
        let dt_sq = dt * dt;
        let gravity = Vec4::from((config.gravity, 0.0));
        let count = state.count;

        // Process in chunks of 4 for explicit vectorization hints
        let mut i = 0;
        while i + 4 <= count {
            // We can't easily use slice iterators here because we need to access multiple arrays
            // (positions, prev_positions, inv_mass, external_forces)
            // So we unroll manually.

            Self::integrate_particle(state, config, external_forces, dt, dt_sq, gravity, i);
            Self::integrate_particle(state, config, external_forces, dt, dt_sq, gravity, i+1);
            Self::integrate_particle(state, config, external_forces, dt, dt_sq, gravity, i+2);
            Self::integrate_particle(state, config, external_forces, dt, dt_sq, gravity, i+3);

            i += 4;
        }

        // Handle remainder
        while i < count {
            Self::integrate_particle(state, config, external_forces, dt, dt_sq, gravity, i);
            i += 1;
        }
    }

    #[inline(always)]
    fn integrate_particle(
        state: &mut PhysicsState,
        _config: &PhysicsConfig,
        external_forces: &[Vec3],
        dt: f32,
        dt_sq: f32,
        gravity: Vec4,
        i: usize
    ) {
        if state.inv_mass[i] == 0.0 { return; }

        let pos = state.positions[i];
        let prev = state.prev_positions[i];

        let f_aero = Vec4::from((external_forces[i], 0.0));
        let acceleration = gravity + (f_aero * state.inv_mass[i]);

        let velocity_term = pos - prev;
        let next_pos = pos + velocity_term + acceleration * dt_sq;

        state.prev_positions[i] = pos;
        state.positions[i] = next_pos;
        state.velocities[i] = (next_pos - pos) / dt;
    }
}