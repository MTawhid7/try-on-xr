// compute/src/shaders/tether.wgsl.ts
/**
 * @fileoverview Tether (long-range attachment) constraint compute shader.
 *
 * Implements XPBD tether constraints that limit the maximum distance
 * a particle can move from an anchor point. This prevents excessive stretching.
 *
 * Unlike distance constraints, tether constraints are one-sided:
 * they only activate when the distance exceeds the maximum.
 */

import { MATH_WGSL } from './common/math.wgsl';
import { TYPES_WGSL } from './common/types.wgsl';

/**
 * Workgroup size for tether constraint shader.
 */
export const TETHER_WORKGROUP_SIZE = 256;

/**
 * Complete tether constraint shader source.
 */
export const TETHER_WGSL = /* wgsl */`
${TYPES_WGSL}
${MATH_WGSL}

// ============================================
// Tether Constraint Shader (XPBD)
// ============================================

// Bind group 0: Simulation parameters
@group(0) @binding(0) var<uniform> params: SimParams;

// Bind group 1: Particle data (must match layout: positions, prev_positions, velocities, inverse_masses)
@group(1) @binding(0) var<storage, read_write> positions: array<vec4f>;
@group(1) @binding(1) var<storage, read_write> prev_positions: array<vec4f>;
@group(1) @binding(2) var<storage, read_write> velocities: array<vec4f>;
@group(1) @binding(3) var<storage, read> inverse_masses: array<vec4f>;

// Bind group 2: Constraint data for this batch
@group(2) @binding(0) var<storage, read> constraints: array<TetherConstraint>;
@group(2) @binding(1) var<uniform> constraint_count: u32;

@compute @workgroup_size(${TETHER_WORKGROUP_SIZE})
fn main(@builtin(global_invocation_id) global_id: vec3u) {
    let constraint_idx = global_id.x;

    // Bounds check
    if (constraint_idx >= constraint_count) {
        return;
    }

    // Load constraint
    let c = constraints[constraint_idx];
    let anchor_idx = c.anchor;
    let particle_idx = c.particle;
    let max_distance = c.max_distance;
    let compliance = c.compliance;

    // Load positions and inverse masses
    let anchor_pos = positions[anchor_idx].xyz;
    let particle_pos = positions[particle_idx].xyz;
    let w_anchor = inverse_masses[anchor_idx].x;
    let w_particle = inverse_masses[particle_idx].x;

    // Skip if particle is pinned
    if (w_particle < EPSILON) {
        return;
    }

    // Compute current distance
    let diff = particle_pos - anchor_pos;
    let dist = length(diff);

    // Only apply if distance exceeds maximum (one-sided constraint)
    if (dist <= max_distance) {
        return;
    }

    // Constraint value: C = dist - max_distance (positive when violated)
    let C = dist - max_distance;

    // XPBD correction
    let dt = params.config.x;
    let alpha = compliance / (dt * dt);

    // Effective inverse mass (anchor may be pinned or mobile)
    let w_sum = w_anchor + w_particle;

    // Lambda = -C / (w_sum + alpha)
    let lambda = -C / (w_sum + alpha);

    // Direction of correction
    let gradient = diff / dist;

    // Apply correction
    // Particle moves in, anchor moves out (if not pinned)
    let correction = lambda * gradient;

    // Both anchor and particle get corrected proportionally
    let new_anchor = anchor_pos - correction * w_anchor;
    let new_particle = particle_pos + correction * w_particle;

    // Write back
    if (w_anchor > EPSILON) {
        positions[anchor_idx] = vec4f(new_anchor, 0.0);
    }
    positions[particle_idx] = vec4f(new_particle, 0.0);

    // Unused bindings referenced to satisfy layout requirements
    _ = prev_positions[0];
    _ = velocities[0];
}
`;

export default TETHER_WGSL;
