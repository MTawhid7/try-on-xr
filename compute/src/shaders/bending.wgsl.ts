
import { MATH_WGSL } from './common/math.wgsl';
import { TYPES_WGSL } from './common/types.wgsl';

/**
 * Workgroup size for bending constraint shader.
 */
export const BENDING_WORKGROUP_SIZE = 256;

/**
 * Complete bending constraint shader source.
 * NOTE: This is now identical to DISTANCE_WGSL but bound to 'bending' pipeline.
 * It implements "cross-edge" distance constraints.
 */
export const BENDING_WGSL = /* wgsl */`
${TYPES_WGSL}
${MATH_WGSL}

// ============================================
// Bending Constraint Shader (XPBD Distance)
// ============================================

// Bind group 0: Simulation parameters
@group(0) @binding(0) var<uniform> params: SimParams;

// Bind group 1: Particle data
@group(1) @binding(0) var<storage, read_write> positions: array<vec4f>;
@group(1) @binding(1) var<storage, read_write> prev_positions: array<vec4f>;
@group(1) @binding(2) var<storage, read_write> velocities: array<vec4f>;
@group(1) @binding(3) var<storage, read> inverse_masses: array<vec4f>;

// Bind group 2: Constraint data for this batch (DistanceConstraint struct)
@group(2) @binding(0) var<storage, read> constraints: array<DistanceConstraint>;
@group(2) @binding(1) var<uniform> constraint_count: u32;

@compute @workgroup_size(${BENDING_WORKGROUP_SIZE})
fn main(@builtin(global_invocation_id) global_id: vec3u) {
    let constraint_idx = global_id.x;

    if (constraint_idx >= constraint_count) {
        return;
    }

    let c = constraints[constraint_idx];
    let i0 = c.i0;
    let i1 = c.i1;
    let rest_length = c.rest_length;
    let compliance = c.compliance;

    let p0 = positions[i0].xyz;
    let p1 = positions[i1].xyz;
    let w0 = inverse_masses[i0].x;
    let w1 = inverse_masses[i1].x;

    let w_sum = w0 + w1;
    if (w_sum < EPSILON) {
        return;
    }

    let diff = p1 - p0;
    let dist = length(diff);

    if (dist < EPSILON) {
        return;
    }

    let C = dist - rest_length;

    let dt = params.config.x;
    let alpha = compliance / (dt * dt);
    let lambda = -C / (w_sum + alpha);
    let gradient = diff / dist;
    let correction = lambda * gradient;

    let new_p0 = p0 - correction * w0;
    let new_p1 = p1 + correction * w1;

    positions[i0] = vec4f(new_p0, 0.0);
    positions[i1] = vec4f(new_p1, 0.0);
}
`;

export default BENDING_WGSL;
