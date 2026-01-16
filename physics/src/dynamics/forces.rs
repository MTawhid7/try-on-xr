// physics/src/engine/simulation.rs
use glam::Vec3;
use crate::engine::state::PhysicsState;

pub struct ForceUniform {
    pub gravity: Vec3,
    pub drag: f32,
}

impl ForceUniform {
    pub fn new() -> Self {
        Self {
            gravity: Vec3::new(0.0, -9.81, 0.0),
            drag: 0.99, // Simple air resistance
        }
    }

    pub fn apply(&self, state: &mut PhysicsState, dt: f32) {
        for i in 0..state.count {
            if state.inv_mass[i] == 0.0 { continue; }

            let pos = state.positions[i];
            let prev = state.prev_positions[i];

            // Verlet Integration
            let velocity = (pos - prev) * self.drag;
            let next_pos = pos + velocity + self.gravity * (dt * dt);

            state.prev_positions[i] = pos;
            state.positions[i] = next_pos;
        }
    }
}