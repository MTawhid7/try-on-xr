// compute/src/shaders/area.wgsl.ts
/**
 * @fileoverview Area constraint compute shader.
 *
 * Enforces triangle area preservation to prevent shearing.
 * Based on XPBD Area Constraint.
 */

import { MATH_WGSL } from './common/math.wgsl';
import { TYPES_WGSL } from './common/types.wgsl';

/**
 * Workgroup size for area constraints.
 */
export const AREA_WORKGROUP_SIZE = 256;

/**
 * Complete area constraint shader source.
 */
export const AREA_WGSL = /* wgsl */`
${TYPES_WGSL}
${MATH_WGSL}

// ============================================
// Area Constraint Shader
// ============================================

struct AreaConstraint {
    i0: u32,
    i1: u32,
    i2: u32,
    pad1: u32,
    restArea: f32,
    compliance: f32,
    pad2: f32,
    pad3: f32,
}

struct AreaCount {
    count: u32,
    pad1: u32,
    pad2: u32,
    pad3: u32,
} // 16 bytes aligned

// Bind group 0: Simulation parameters
@group(0) @binding(0) var<uniform> params: SimParams;

// Bind group 1: Particle data
@group(1) @binding(0) var<storage, read_write> positions: array<vec4f>;
@group(1) @binding(1) var<storage, read_write> prev_positions: array<vec4f>;
@group(1) @binding(2) var<storage, read_write> velocities: array<vec4f>; // Unused here
@group(1) @binding(3) var<storage, read> inverse_masses: array<vec4f>;

// Bind group 2: Area constraints
@group(2) @binding(0) var<storage, read> constraints: array<AreaConstraint>;
@group(2) @binding(1) var<uniform> constraint_count: AreaCount;

@compute @workgroup_size(${AREA_WORKGROUP_SIZE})
fn main(@builtin(global_invocation_id) global_id: vec3u) {
    let idx = global_id.x;
    if (idx >= constraint_count.count) {
        return;
    }

    let c = constraints[idx];
    let i0 = c.i0;
    let i1 = c.i1;
    let i2 = c.i2;

    let w0 = inverse_masses[i0].x;
    let w1 = inverse_masses[i1].x;
    let w2 = inverse_masses[i2].x;

    let w_sum = w0 + w1 + w2;
    if (w_sum == 0.0) {
        return;
    }

    let p0 = positions[i0].xyz;
    let p1 = positions[i1].xyz;
    let p2 = positions[i2].xyz;

    // Calculate current area and normal
    let u = p1 - p0;
    let v = p2 - p0;
    let cross_prod = cross(u, v);
    let current_area = 0.5 * length(cross_prod);

    // Calculate constraint violation (C)
    // C(x) = current_area - rest_area
    let C = current_area - c.restArea;

    // Small epsilon to avoid division by zero
    if (abs(C) < 1e-6 || current_area < 1e-9) {
        return;
    }

    let n = cross_prod / (2.0 * current_area); // Triangle normal (normalized if area is correct)

    // Calculate Gradients
    // grad0 = 0.5 * (p2 - p1) x n
    // grad1 = 0.5 * (p0 - p2) x n
    // grad2 = 0.5 * (p1 - p0) x n

    let grad0 = 0.5 * cross(p2 - p1, n);
    let grad1 = 0.5 * cross(p0 - p2, n);
    let grad2 = 0.5 * cross(p1 - p0, n);

    // Compute denominator (w * |grad|^2)
    let denom = w0 * dot(grad0, grad0) +
                w1 * dot(grad1, grad1) +
                w2 * dot(grad2, grad2);

    if (denom < 1e-9) {
        return;
    }

    // XPBD Alpha
    // alpha = compliance / dt^2
    let dt = params.config.x;
    let alpha = c.compliance / (dt * dt);

    // Delta Lambda
    let delta_lambda = -C / (denom + alpha);

    // Apply corrections
    if (w0 > 0.0) {
        let corr = grad0 * delta_lambda * w0;
        positions[i0] += vec4f(corr, 0.0);
    }
    if (w1 > 0.0) {
        let corr = grad1 * delta_lambda * w1;
        positions[i1] += vec4f(corr, 0.0);
    }
    if (w2 > 0.0) {
        let corr = grad2 * delta_lambda * w2;
        positions[i2] += vec4f(corr, 0.0);
    }
}
`;

export default AREA_WGSL;
