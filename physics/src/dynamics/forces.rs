// physics/src/engine/simulation.rs
use glam::Vec3;
use crate::engine::state::PhysicsState;

pub struct Aerodynamics {
    pub gravity: Vec3,
    pub wind: Vec3,
    pub drag_coeff: f32, // Resistance perpendicular to surface (Catching wind)
    pub lift_coeff: f32, // Resistance parallel to surface (Slicing air)

    // Buffer to accumulate forces per particle before integration
    force_buffer: Vec<Vec3>,
}

impl Aerodynamics {
    pub fn new() -> Self {
        Self {
            gravity: Vec3::new(0.0, -9.81, 0.0),
            wind: Vec3::new(0.0, 0.0, 0.0),
            drag_coeff: 2.0, // High drag for cloth
            lift_coeff: 0.05, // Low friction for slicing
            force_buffer: Vec::new(),
        }
    }

    pub fn apply(&mut self, state: &mut PhysicsState, dt: f32) {
        // 1. Resize/Reset Buffer
        if self.force_buffer.len() != state.count {
            self.force_buffer.resize(state.count, Vec3::ZERO);
        } else {
            self.force_buffer.fill(Vec3::ZERO);
        }

        // 2. Accumulate Aerodynamic Forces (Iterate Triangles)
        let num_triangles = state.indices.len() / 3;
        for i in 0..num_triangles {
            let idx0 = state.indices[i * 3] as usize;
            let idx1 = state.indices[i * 3 + 1] as usize;
            let idx2 = state.indices[i * 3 + 2] as usize;

            let p0 = state.positions[idx0];
            let p1 = state.positions[idx1];
            let p2 = state.positions[idx2];

            // Calculate Triangle Velocity (Average of vertices)
            // v = (p - prev) / dt
            let v0 = (p0 - state.prev_positions[idx0]) / dt;
            let v1 = (p1 - state.prev_positions[idx1]) / dt;
            let v2 = (p2 - state.prev_positions[idx2]) / dt;
            let tri_vel = (v0 + v1 + v2) / 3.0;

            // Relative velocity (Air moving against cloth)
            let rel_vel = tri_vel - self.wind;
            let vel_sq = rel_vel.length_squared();

            if vel_sq < 1e-6 { continue; }

            // Calculate Normal and Area
            let edge1 = p1 - p0;
            let edge2 = p2 - p0;
            let cross = edge1.cross(edge2);
            let area_x2 = cross.length();

            if area_x2 < 1e-6 { continue; }

            let area = area_x2 * 0.5;
            let normal = cross / area_x2; // Normalize

            // Decompose Velocity
            // v_normal = (v . n) * n
            let v_dot_n = rel_vel.dot(normal);
            let v_normal = normal * v_dot_n;
            let v_tangent = rel_vel - v_normal;

            // Drag Force (Opposes Normal Velocity)
            // Fd = -0.5 * Cd * Area * |vn| * vn
            // We assume density = 1.0 for simplicity
            let f_drag = -0.5 * self.drag_coeff * area * v_normal.length() * v_normal;

            // Lift/Skin Friction (Opposes Tangent Velocity)
            let f_lift = -0.5 * self.lift_coeff * area * v_tangent.length() * v_tangent;

            let total_force = f_drag + f_lift;

            // Distribute force to vertices
            let force_per_vert = total_force / 3.0;
            self.force_buffer[idx0] += force_per_vert;
            self.force_buffer[idx1] += force_per_vert;
            self.force_buffer[idx2] += force_per_vert;
        }

        // 3. Integrate (Verlet)
        for i in 0..state.count {
            if state.inv_mass[i] == 0.0 { continue; }

            let pos = state.positions[i];
            let prev = state.prev_positions[i];

            // F = ma => a = F * inv_mass
            // Gravity is constant acceleration, Aero is a force.
            let f_aero = self.force_buffer[i];
            let acceleration = self.gravity + f_aero * state.inv_mass[i];

            // Verlet Integration
            // x_new = x + v*dt + a*dt^2
            // We assume v = (x - prev) / dt
            let velocity = pos - prev; // This is v*dt

            // Note: We removed the linear 'drag' multiplier (0.99).
            // The aerodynamic forces now provide the damping naturally.
            let next_pos = pos + velocity + acceleration * (dt * dt);

            state.prev_positions[i] = pos;
            state.positions[i] = next_pos;
        }
    }
}