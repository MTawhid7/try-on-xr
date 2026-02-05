// compute/src/shaders/distance.wgsl.ts
/**
 * @fileoverview Distance constraint compute shader.
 *
 * Implements XPBD (Extended Position-Based Dynamics) distance constraint solving.
 * Each constraint maintains a fixed distance between two particles.
 *
 * The constraint gradient is: C = |p1 - p0| - rest_length
 * Correction: Δx = -λ * ∇C where λ = C / (w0 + w1 + α/dt²)
 */

import { MATH_WGSL } from './common/math.wgsl';
import { TYPES_WGSL } from './common/types.wgsl';

/**
 * Workgroup size for constraint shaders.
 */
export const DISTANCE_WORKGROUP_SIZE = 256;

/**
 * Complete distance constraint shader source.
 */
export const DISTANCE_WGSL = /* wgsl */`
${TYPES_WGSL}
${MATH_WGSL}

// ============================================
// Distance Constraint Shader (XPBD)
// ============================================

// Bind group 0: Simulation parameters
@group(0) @binding(0) var<uniform> params: SimParams;

// Bind group 1: Particle data (must match layout: positions, prev_positions, velocities, inverse_masses)
@group(1) @binding(0) var<storage, read_write> positions: array<vec4f>;
@group(1) @binding(1) var<storage, read_write> prev_positions: array<vec4f>;
@group(1) @binding(2) var<storage, read_write> velocities: array<vec4f>;
@group(1) @binding(3) var<storage, read> inverse_masses: array<vec4f>;

// Bind group 2: Constraint data for this batch
@group(2) @binding(0) var<storage, read> constraints: array<DistanceConstraint>;
@group(2) @binding(1) var<uniform> constraint_count: u32;

@compute @workgroup_size(${DISTANCE_WORKGROUP_SIZE})
fn main(@builtin(global_invocation_id) global_id: vec3u) {
    let constraint_idx = global_id.x;

    // Bounds check
    if (constraint_idx >= constraint_count) {
        return;
    }

    // Load constraint data
    let c = constraints[constraint_idx];
    let i0 = c.i0;
    let i1 = c.i1;
    let rest_length = c.rest_length;
    let compliance = c.compliance;

    // Load particle positions and inverse masses
    let p0 = positions[i0].xyz;
    let p1 = positions[i1].xyz;
    let w0 = inverse_masses[i0].x;
    let w1 = inverse_masses[i1].x;

    // Skip if both particles are pinned
    let w_sum = w0 + w1;
    if (w_sum < EPSILON) {
        return;
    }

    // Compute constraint vector and distance
    let diff = p1 - p0;
    let dist = length(diff);

    // Skip if particles are at same position
    if (dist < EPSILON) {
        return;
    }

    // Constraint value: C = |p1 - p0| - rest_length
    let C = dist - rest_length;

    // XPBD: compute Lagrange multiplier update
    // XPBD correction
    let dt = params.config.x;
    let alpha = compliance / (dt * dt);

    // λ = -C / (w0 + w1 + α)
    let lambda = -C / (w_sum + alpha);

    // Gradient direction (normalized)
    let gradient = diff / dist;

    // Apply corrections (FIXED: match Rust sign convention)
    // Δp0 = +λ * w0 * ∇C (move toward p1 when stretched)
    // Δp1 = -λ * w1 * ∇C (move toward p0 when stretched)
    let correction = lambda * gradient;

    let new_p0 = p0 - correction * w0;  // SUBTRACT to move toward p1 (correction points p1->p0)
    let new_p1 = p1 + correction * w1;  // ADD to move toward p0 (correction points p1->p0)

    // Write back (atomic operations not needed with graph coloring)
    positions[i0] = vec4f(new_p0, 0.0);
    positions[i1] = vec4f(new_p1, 0.0);

    // Unused bindings referenced to satisfy layout requirements
    _ = prev_positions[0];
    _ = velocities[0];
}
`;

export default DISTANCE_WGSL;
