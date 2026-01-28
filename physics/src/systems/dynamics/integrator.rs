// physics/src/systems/dynamics/integrator.rs

use glam::Vec3;
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

        for i in 0..state.count {
            if state.inv_mass[i] == 0.0 { continue; }

            let pos = state.positions[i];
            let prev = state.prev_positions[i];

            // F = ma => a = F * inv_mass
            // Gravity is constant acceleration.
            // Aerodynamics is a Force, so we multiply by inv_mass.
            let f_aero = external_forces[i];
            let acceleration = config.gravity + (f_aero * state.inv_mass[i]);

            // Verlet Integration
            // x_new = x + v*dt + a*dt^2
            // v*dt is approximated as (x - prev)
            let velocity_term = pos - prev;

            // Note: We rely on aerodynamic drag for damping, so no explicit linear damping here.
            let next_pos = pos + velocity_term + acceleration * dt_sq;

            state.prev_positions[i] = pos;
            state.positions[i] = next_pos;

            // Update explicit velocity for other systems to use
            state.velocities[i] = (next_pos - pos) / dt;
        }
    }
}