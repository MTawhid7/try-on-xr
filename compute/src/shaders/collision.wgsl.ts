// compute/src/shaders/collision.wgsl.ts
/**
 * @fileoverview Body collision compute shader.
 *
 * Implements point-triangle collision detection and response.
 * Each particle is tested against all body triangles (brute force for now,
 * spatial acceleration can be added later).
 */

import { MATH_WGSL } from './common/math.wgsl';
import { TYPES_WGSL } from './common/types.wgsl';

/**
 * Workgroup size for collision shader.
 */
export const COLLISION_WORKGROUP_SIZE = 256;

/**
 * Complete collision shader source.
 */
export const COLLISION_WGSL = /* wgsl */`
${TYPES_WGSL}
${MATH_WGSL}

// ============================================
// Body Collision Shader
// ============================================

// Triangle data: v0 (vec4), v1 (vec4), v2 (vec4), normal (vec4)
// v0.w contains the margin
struct Triangle {
    v0: vec4f,  // xyz = vertex, w = margin
    v1: vec4f,  // xyz = vertex
    v2: vec4f,  // xyz = vertex
    normal: vec4f,  // xyz = normal
}

// Bind group 0: Simulation parameters
@group(0) @binding(0) var<uniform> params: SimParams;

// Bind group 1: Particle data (must match layout: positions, prev_positions, velocities, inverse_masses)
@group(1) @binding(0) var<storage, read_write> positions: array<vec4f>;
@group(1) @binding(1) var<storage, read_write> prev_positions: array<vec4f>;
@group(1) @binding(2) var<storage, read_write> velocities: array<vec4f>;
@group(1) @binding(3) var<storage, read> inverse_masses: array<vec4f>;

// Bind group 2: Body collider data
@group(2) @binding(0) var<storage, read> triangles: array<Triangle>;
@group(2) @binding(1) var<uniform> triangle_count: u32;

// Friction coefficient
const FRICTION: f32 = 0.3;

// Compute closest point on triangle to a point
fn closest_point_on_triangle(p: vec3f, v0: vec3f, v1: vec3f, v2: vec3f) -> vec3f {
    let edge0 = v1 - v0;
    let edge1 = v2 - v0;
    let v0p = p - v0;

    let d00 = dot(edge0, edge0);
    let d01 = dot(edge0, edge1);
    let d11 = dot(edge1, edge1);
    let d20 = dot(v0p, edge0);
    let d21 = dot(v0p, edge1);

    let denom = d00 * d11 - d01 * d01;

    if (abs(denom) < EPSILON) {
        return v0;
    }

    var u = (d11 * d20 - d01 * d21) / denom;
    var v = (d00 * d21 - d01 * d20) / denom;

    // Clamp barycentric coordinates
    u = clamp_value(u, 0.0, 1.0);
    v = clamp_value(v, 0.0, 1.0);

    // Ensure u + v <= 1
    if (u + v > 1.0) {
        let scale = 1.0 / (u + v);
        u *= scale;
        v *= scale;
    }

    return v0 + u * edge0 + v * edge1;
}

@compute @workgroup_size(${COLLISION_WORKGROUP_SIZE})
fn main(@builtin(global_invocation_id) global_id: vec3u) {
    let idx = global_id.x;

    // Bounds check
    if (idx >= params.counts.x) {
        return;
    }

    // Load particle data
    var pos = positions[idx].xyz; // Use var as it will be modified
    let prev = prev_positions[idx].xyz;
    let inv_mass = inverse_masses[idx].x;

    // dt needed for velocity correction? Use config.x
    let dt = params.config.x;

    // Skip pinned particles
    if (inv_mass < EPSILON) {
        return;
    }

    var total_correction = vec3f(0.0, 0.0, 0.0);
    var collision_count = 0u;

    // Test against all triangles
    for (var t = 0u; t < triangle_count; t++) {
        let tri = triangles[t];
        let v0 = tri.v0.xyz;
        let v1 = tri.v1.xyz;
        let v2 = tri.v2.xyz;
        let normal = tri.normal.xyz;
        let margin = tri.v0.w;

        // Find closest point on triangle
        let closest = closest_point_on_triangle(pos, v0, v1, v2);
        let to_particle = pos - closest;
        let dist = length(to_particle);

        // Check if within collision margin
        if (dist < margin && dist > EPSILON) {
            // Compute penetration depth
            let penetration = margin - dist;

            // Direction: push particle along normal or away from closest point
            let push_dir = select(
                to_particle / dist,
                normal,
                dot(to_particle, normal) < 0.0
            );

            // Apply correction
            let correction = push_dir * penetration;
            total_correction += correction;
            collision_count += 1u;
        } else if (dist < EPSILON) {
            // Particle exactly on triangle - push along normal
            total_correction += normal * margin;
            collision_count += 1u;
        }
    }

    // Apply averaged correction
    if (collision_count > 0u) {
        let avg_correction = total_correction / f32(collision_count);
        pos += avg_correction;

        // Apply friction (reduce tangential velocity)
        // This is simplified - proper friction would need velocity data
    }

    positions[idx] = vec4f(pos, 0.0);

    // Unused bindings referenced to satisfy layout requirements
    _ = prev_positions[0];
    _ = velocities[0];
}
`;

export default COLLISION_WGSL;
