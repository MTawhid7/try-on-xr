// compute/src/shaders/integrator.wgsl.ts
/**
 * @fileoverview Verlet integration compute shader.
 *
 * Implements proper Verlet integration for particle positions:
 * 1. Compute velocity from position difference (pos - prev)
 * 2. Apply damping to velocity
 * 3. Save current position to prev
 * 4. Update position: next = pos + velocity + acceleration * dt²
 *
 * This matches the Rust implementation for stability.
 */

import { MATH_WGSL } from './common/math.wgsl';
import { TYPES_WGSL } from './common/types.wgsl';

/**
 * Workgroup size for integrator.
 * 256 is optimal for most GPUs (multiple of 32/64 wavefront size).
 */
export const INTEGRATOR_WORKGROUP_SIZE = 256;

/**
 * Complete integrator shader source.
 */
export const INTEGRATOR_WGSL = /* wgsl */`
${TYPES_WGSL}
${MATH_WGSL}

// ============================================
// Verlet Integrator Shader
// ============================================

// Bind group 0: Simulation parameters
@group(0) @binding(0) var<uniform> params: SimParams;

// Bind group 1: Particle data (read-write)
@group(1) @binding(0) var<storage, read_write> positions: array<vec4f>;
@group(1) @binding(1) var<storage, read_write> prev_positions: array<vec4f>;
@group(1) @binding(2) var<storage, read_write> velocities: array<vec4f>;
@group(1) @binding(3) var<storage, read> inverse_masses: array<vec4f>;

@compute @workgroup_size(${INTEGRATOR_WORKGROUP_SIZE})
fn main(@builtin(global_invocation_id) global_id: vec3u) {
    let idx = global_id.x;

    // particle_count is in counts.x
    if (idx >= params.counts.x) {
        return;
    }

    // Load particle data
    let pos = positions[idx].xyz;
    let prev_pos = prev_positions[idx].xyz;
    let inv_mass = inverse_masses[idx].x;

    // Skip pinned particles (inv_mass == 0)
    if (inv_mass < EPSILON) {
        return;
    }

    // dt is config.x, damping is config.y
    // dt is config.x, damping is config.y
    let dt = params.config.x;
    let drag = params.config.w;
    let gravity = params.gravity.xyz;
    let damping = params.config.y;

    // Proper Verlet integration (matching Rust implementation):
    // velocity = (pos - prev) * damping * (1.0 - drag)
    let velocity = (pos - prev_pos) * damping * (1.0 - drag);

    // acceleration = gravity (force per unit mass)
    let acceleration = gravity;

    // next_pos = pos + velocity + acceleration * dt²
    let dt_sq = dt * dt;
    let next_pos = pos + velocity + acceleration * dt_sq;

    // Save current position as previous (BEFORE updating position)
    prev_positions[idx] = vec4f(pos, 0.0);

    // Update position
    positions[idx] = vec4f(next_pos, 0.0);

    // Store velocity for other uses (normalized by dt for correct units)
    velocities[idx] = vec4f(velocity / dt, 0.0);
}
`;

export default INTEGRATOR_WGSL;
