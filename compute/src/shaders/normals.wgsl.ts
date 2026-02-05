// compute/src/shaders/normals.wgsl.ts
/**
 * @fileoverview Vertex normal computation shader.
 *
 * Computes per-vertex normals by averaging face normals of adjacent triangles.
 * This is a two-pass algorithm:
 * 1. Reset normals to zero
 * 2. For each triangle, add face normal to each vertex
 * 3. Normalize the accumulated normals
 *
 * For simplicity, we combine steps 1-2 and do normalization in a second pass.
 */

import { MATH_WGSL } from './common/math.wgsl';
import { TYPES_WGSL } from './common/types.wgsl';

/**
 * Workgroup size for normal computation.
 */
export const NORMALS_WORKGROUP_SIZE = 256;

/**
 * Normal accumulation shader (per-triangle contribution).
 * This adds face normal to each vertex of each triangle.
 * Uses atomic operations for thread-safe accumulation.
 */
export const NORMALS_ACCUMULATE_WGSL = /* wgsl */`
${TYPES_WGSL}
${MATH_WGSL}

// ============================================
// Normal Accumulation Shader
// ============================================

// Bind group 0: Simulation parameters
@group(0) @binding(0) var<uniform> params: SimParams;

// Bind group 1: Particle positions and normals
@group(1) @binding(0) var<storage, read> positions: array<vec4f>;
@group(1) @binding(1) var<storage, read_write> normals: array<atomic<i32>>;

// Bind group 2: Triangle indices
@group(2) @binding(0) var<storage, read> indices: array<u32>;
@group(2) @binding(1) var<uniform> triangle_count: u32;

// Scale factor for fixed-point atomic accumulation
const NORMAL_SCALE: f32 = 10000.0;

@compute @workgroup_size(${NORMALS_WORKGROUP_SIZE})
fn main(@builtin(global_invocation_id) global_id: vec3u) {
    let tri_idx = global_id.x;

    if (tri_idx >= triangle_count) {
        return;
    }

    // Get triangle indices
    let i0 = indices[tri_idx * 3 + 0];
    let i1 = indices[tri_idx * 3 + 1];
    let i2 = indices[tri_idx * 3 + 2];

    // Get positions
    let p0 = positions[i0].xyz;
    let p1 = positions[i1].xyz;
    let p2 = positions[i2].xyz;

    // Compute face normal (not normalized - area weighted)
    let edge1 = p1 - p0;
    let edge2 = p2 - p0;
    let face_normal = cross(edge1, edge2);

    // Convert to fixed-point for atomic accumulation
    let nx = i32(face_normal.x * NORMAL_SCALE);
    let ny = i32(face_normal.y * NORMAL_SCALE);
    let nz = i32(face_normal.z * NORMAL_SCALE);

    // Add to each vertex (atomic)
    atomicAdd(&normals[i0 * 4 + 0], nx);
    atomicAdd(&normals[i0 * 4 + 1], ny);
    atomicAdd(&normals[i0 * 4 + 2], nz);

    atomicAdd(&normals[i1 * 4 + 0], nx);
    atomicAdd(&normals[i1 * 4 + 1], ny);
    atomicAdd(&normals[i1 * 4 + 2], nz);

    atomicAdd(&normals[i2 * 4 + 0], nx);
    atomicAdd(&normals[i2 * 4 + 1], ny);
    atomicAdd(&normals[i2 * 4 + 2], nz);
}
`;

/**
 * Normal normalization shader (converts accumulated normals to unit vectors).
 */
export const NORMALS_NORMALIZE_WGSL = /* wgsl */`
${TYPES_WGSL}
${MATH_WGSL}

// ============================================
// Normal Normalization Shader
// ============================================

@group(0) @binding(0) var<uniform> params: SimParams;
@group(1) @binding(0) var<storage, read_write> normals: array<vec4f>;

const NORMAL_SCALE: f32 = 10000.0;

@compute @workgroup_size(${NORMALS_WORKGROUP_SIZE})
fn main(@builtin(global_invocation_id) global_id: vec3u) {
    let idx = global_id.x;

    if (idx >= params.particle_count) {
        return;
    }

    // Load accumulated normal (stored as int, need to cast)
    let raw = normals[idx];
    let accumulated = vec3f(raw.x, raw.y, raw.z) / NORMAL_SCALE;

    // Normalize
    let normalized = safe_normalize(accumulated);

    // Store normalized result
    normals[idx] = vec4f(normalized, 0.0);
}
`;

/**
 * Simple normal computation (single pass, no atomics).
 * This is less accurate but simpler and avoids atomic operations.
 */
export const NORMALS_SIMPLE_WGSL = /* wgsl */`
${TYPES_WGSL}
${MATH_WGSL}

// ============================================
// Simple Normal Computation (Per-Vertex)
// ============================================

// Bind group 0: Simulation parameters
@group(0) @binding(0) var<uniform> params: SimParams;

// Bind group 1: Particle data
@group(1) @binding(0) var<storage, read> positions: array<vec4f>;
@group(1) @binding(1) var<storage, read_write> normals: array<vec4f>;

// Bind group 2: Mesh topology
@group(2) @binding(0) var<storage, read> indices: array<u32>;
@group(2) @binding(1) var<uniform> triangle_count: u32;
@group(2) @binding(2) var<storage, read> vertex_triangle_offsets: array<u32>;
@group(2) @binding(3) var<storage, read> vertex_triangles: array<u32>;

@compute @workgroup_size(${NORMALS_WORKGROUP_SIZE})
fn main(@builtin(global_invocation_id) global_id: vec3u) {
    let vertex_idx = global_id.x;

    if (vertex_idx >= params.particle_count) {
        return;
    }

    // Get range of triangles for this vertex
    let start = vertex_triangle_offsets[vertex_idx];
    let end = vertex_triangle_offsets[vertex_idx + 1];

    var accumulated_normal = vec3f(0.0, 0.0, 0.0);

    // Sum face normals from adjacent triangles
    for (var t = start; t < end; t++) {
        let tri_idx = vertex_triangles[t];

        let i0 = indices[tri_idx * 3 + 0];
        let i1 = indices[tri_idx * 3 + 1];
        let i2 = indices[tri_idx * 3 + 2];

        let p0 = positions[i0].xyz;
        let p1 = positions[i1].xyz;
        let p2 = positions[i2].xyz;

        let edge1 = p1 - p0;
        let edge2 = p2 - p0;
        let face_normal = cross(edge1, edge2);

        accumulated_normal += face_normal;
    }

    // Normalize and store
    normals[vertex_idx] = vec4f(safe_normalize(accumulated_normal), 0.0);
}
`;

export default NORMALS_SIMPLE_WGSL;
