// physics/src/systems/constraints/mouse.rs

use glam::Vec3;
use crate::engine::state::PhysicsState;

pub struct MouseConstraint {
    pub grabbed_index: Option<usize>,
    pub target_position: Vec3,
    pub compliance: f32,
}

impl MouseConstraint {
    pub fn new() -> Self {
        Self {
            grabbed_index: None,
            target_position: Vec3::ZERO,
            compliance: 0.0,
        }
    }

    pub fn grab(&mut self, index: usize, position: Vec3) {
        self.grabbed_index = Some(index);
        self.target_position = position;
    }

    pub fn update_target(&mut self, position: Vec3) {
        self.target_position = position;
    }

    pub fn release(&mut self) {
        self.grabbed_index = None;
    }

    pub fn solve(&self, state: &mut PhysicsState, dt: f32) {
        if let Some(idx) = self.grabbed_index {
            if idx >= state.count { return; }

            let w = state.inv_mass[idx];
            if w == 0.0 { return; }

            let alpha = self.compliance / (dt * dt);
            let current_pos = state.positions[idx];
            let difference = self.target_position - current_pos;

            // XPBD Position Update:
            // Delta x = (target - x) * w / (w + alpha)
            let multiplier = w / (w + alpha);

            state.positions[idx] += difference * multiplier;
        }
    }
}