// compute/src/shaders/bending.wgsl.ts
/**
 * @fileoverview Bending constraint compute shader.
 *
 * Implements XPBD bending constraint using dihedral angle between adjacent triangles.
 * The constraint maintains the angle between two triangles sharing an edge.
 *
 * Triangle 1: (i0, i1, i2)
 * Triangle 2: (i0, i1, i3)
 * Edge: (i0, i1)
 */

import { MATH_WGSL } from './common/math.wgsl';
import { TYPES_WGSL } from './common/types.wgsl';

/**
 * Workgroup size for bending constraint shader.
 */
export const BENDING_WORKGROUP_SIZE = 256;

/**
 * Complete bending constraint shader source.
 */
export const BENDING_WGSL = /* wgsl */`
${TYPES_WGSL}
${MATH_WGSL}

// ============================================
// Bending Constraint Shader (XPBD)
// ============================================

// Bind group 0: Simulation parameters
@group(0) @binding(0) var<uniform> params: SimParams;

// Bind group 1: Particle data (must match layout: positions, prev_positions, velocities, inverse_masses)
@group(1) @binding(0) var<storage, read_write> positions: array<vec4f>;
@group(1) @binding(1) var<storage, read_write> prev_positions: array<vec4f>;
@group(1) @binding(2) var<storage, read_write> velocities: array<vec4f>;
@group(1) @binding(3) var<storage, read> inverse_masses: array<vec4f>;

// Bind group 2: Constraint data for this batch
@group(2) @binding(0) var<storage, read> constraints: array<BendingConstraint>;
@group(2) @binding(1) var<uniform> constraint_count: u32;

// Compute dihedral angle between two triangles
fn compute_dihedral_angle(p0: vec3f, p1: vec3f, p2: vec3f, p3: vec3f) -> f32 {
    // Edge vector
    let e = p1 - p0;

    // Face normals
    let n1 = cross(e, p2 - p0);
    let n2 = cross(p3 - p0, e);

    let n1_len = length(n1);
    let n2_len = length(n2);

    if (n1_len < EPSILON || n2_len < EPSILON) {
        return 0.0;
    }

    let n1_norm = n1 / n1_len;
    let n2_norm = n2 / n2_len;

    // Dihedral angle
    let cos_theta = clamp_value(dot(n1_norm, n2_norm), -1.0, 1.0);
    return acos(cos_theta);
}

@compute @workgroup_size(${BENDING_WORKGROUP_SIZE})
fn main(@builtin(global_invocation_id) global_id: vec3u) {
    let constraint_idx = global_id.x;

    // Bounds check
    if (constraint_idx >= constraint_count) {
        return;
    }

    // Load constraint
    let c = constraints[constraint_idx];
    let i0 = c.i0;
    let i1 = c.i1;
    let i2 = c.i2;
    let i3 = c.i3;
    let rest_angle = c.rest_angle;
    let compliance = c.compliance;

    // Load positions and inverse masses
    let p0 = positions[i0].xyz;
    let p1 = positions[i1].xyz;
    let p2 = positions[i2].xyz;
    let p3 = positions[i3].xyz;

    let w0 = inverse_masses[i0].x;
    let w1 = inverse_masses[i1].x;
    let w2 = inverse_masses[i2].x;
    let w3 = inverse_masses[i3].x;

    let w_sum = w0 + w1 + w2 + w3;
    if (w_sum < EPSILON) {
        return;
    }

    // Current dihedral angle
    let current_angle = compute_dihedral_angle(p0, p1, p2, p3);

    // Constraint value
    let C = current_angle - rest_angle;

    // Skip if constraint is satisfied
    if (abs(C) < EPSILON) {
        return;
    }

    // XPBD correction
    let dt = params.config.x;
    let alpha = compliance / (dt * dt);

    // Simplified bending correction (approximate gradients)
    // Apply correction along the direction that reduces the angle
    let edge = p1 - p0;
    let edge_len = length(edge);
    if (edge_len < EPSILON) {
        return;
    }
    let edge_dir = edge / edge_len;

    // Wing positions relative to edge midpoint
    let mid = (p0 + p1) * 0.5;
    let d2 = p2 - mid;
    let d3 = p3 - mid;

    // Project onto plane perpendicular to edge
    let d2_perp = d2 - dot(d2, edge_dir) * edge_dir;
    let d3_perp = d3 - dot(d3, edge_dir) * edge_dir;

    let d2_len = length(d2_perp);
    let d3_len = length(d3_perp);

    if (d2_len < EPSILON || d3_len < EPSILON) {
        return;
    }

    // Correction magnitude
    let lambda = -C / (w_sum + alpha);
    let stiffness = 0.1; // Reduced stiffness for stability

    // Apply corrections to wing vertices only (simplified)
    let correction2 = safe_normalize(d2_perp) * lambda * stiffness;
    let correction3 = -safe_normalize(d3_perp) * lambda * stiffness;

    // Write back
    positions[i2] = vec4f(p2 + correction2 * w2, 0.0);
    positions[i3] = vec4f(p3 + correction3 * w3, 0.0);

    // Unused bindings referenced to satisfy layout requirements
    _ = prev_positions[0];
    _ = velocities[0];
}
`;

export default BENDING_WGSL;
