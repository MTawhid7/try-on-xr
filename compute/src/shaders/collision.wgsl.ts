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
// Body Collision Shader (Spatial Hash Accelerated)
// ============================================

struct Triangle {
    v0: vec4f,  // xyz = vertex, w = margin
    v1: vec4f,  // xyz = vertex
    v2: vec4f,  // xyz = vertex
    normal: vec4f,  // xyz = normal
}

struct GridParams {
    minAndSize: vec4f, // xyz = min, w = algoCellSize
    dimAndPad: vec4u,  // xyz = dim, w = padding
}

struct GridCell {
    offset: u32,
    count: u32,
    pad1: u32,
    pad2: u32,
}

@group(0) @binding(0) var<uniform> params: SimParams;

@group(1) @binding(0) var<storage, read_write> positions: array<vec4f>;
@group(1) @binding(1) var<storage, read_write> prev_positions: array<vec4f>;
@group(1) @binding(2) var<storage, read_write> velocities: array<vec4f>;
@group(1) @binding(3) var<storage, read> inverse_masses: array<vec4f>;

@group(2) @binding(0) var<storage, read> triangles: array<Triangle>;
@group(2) @binding(1) var<uniform> triangle_count: u32;
// New Spatial Hash Bindings
@group(2) @binding(2) var<uniform> grid_params: GridParams;
@group(2) @binding(3) var<storage, read> grid_cells: array<GridCell>;
@group(2) @binding(4) var<storage, read> triangle_refs: array<u32>;

const FRICTION: f32 = 0.8;

// ... (Keep helper functions match Rust geometry.rs) ...
// Robust Closest Point on Triangle
fn closest_point_on_triangle_robust(p: vec3f, v0: vec3f, v1: vec3f, v2: vec3f) -> vec3f {
    let ab = v1 - v0;
    let ac = v2 - v0;
    let ap = p - v0;

    let d1 = dot(ab, ap);
    let d2 = dot(ac, ap);

    if (d1 <= 0.0 && d2 <= 0.0) { return v0; }

    let bp = p - v1;
    let d3 = dot(ab, bp);
    let d4 = dot(ac, bp);

    if (d3 >= 0.0 && d4 <= d3) { return v1; }

    let vc = d1 * d4 - d3 * d2;
    if (vc <= 0.0 && d1 >= 0.0 && d3 <= 0.0) {
        let v_bary = d1 / (d1 - d3);
        return v0 + ab * v_bary;
    }

    let cp = p - v2;
    let d5 = dot(ab, cp);
    let d6 = dot(ac, cp);

    if (d6 >= 0.0 && d5 <= d6) { return v2; }

    let vb = d5 * d2 - d1 * d6;
    if (vb <= 0.0 && d2 >= 0.0 && d6 <= 0.0) {
        let w = d2 / (d2 - d6);
        return v0 + ac * w;
    }

    let va = d3 * d6 - d5 * d4;
    if (va <= 0.0 && (d4 - d3) >= 0.0 && (d5 - d6) >= 0.0) {
        let w = (d4 - d3) / ((d4 - d3) + (d5 - d6));
        return v1 + (v2 - v1) * w;
    }

    let denom = 1.0 / (va + vb + vc);
    if (abs(va + vb + vc) < 1e-9) { return v0; } // Degenerate triangle check
    let v_bary = vb * denom;
    let w_bary = vc * denom;
    return v0 + ab * v_bary + ac * w_bary;
}

fn intersect_segment(p1: vec3f, p2: vec3f, v0: vec3f, v1: vec3f, v2: vec3f) -> vec4f {
    let epsilon = 1e-7;
    let edge1 = v1 - v0;
    let edge2 = v2 - v0;
    let ray_vec = p2 - p1;
    let h = cross(ray_vec, edge2);
    let a = dot(edge1, h);

    if (a > -epsilon && a < epsilon) { return vec4f(0.0, 0.0, 0.0, -1.0); }

    let f = 1.0 / a;
    let s = p1 - v0;
    let u = f * dot(s, h);

    if (u < 0.0 || u > 1.0) { return vec4f(0.0, 0.0, 0.0, -1.0); }

    let q = cross(s, edge1);
    let v = f * dot(ray_vec, q);

    if (v < 0.0 || u + v > 1.0) { return vec4f(0.0, 0.0, 0.0, -1.0); }

    let t = f * dot(edge2, q);

    if (t > epsilon && t <= 1.0) { return vec4f(p1 + ray_vec * t, t); }
    return vec4f(0.0, 0.0, 0.0, -1.0);
}

// Helper to get grid index
fn get_grid_index(p: vec3f) -> i32 {
    let rel = p - grid_params.minAndSize.xyz;
    if (rel.x < 0.0 || rel.y < 0.0 || rel.z < 0.0) { return -1; }

    let cellSize = grid_params.minAndSize.w;
    let x = u32(floor(rel.x / cellSize));
    let y = u32(floor(rel.y / cellSize));
    let z = u32(floor(rel.z / cellSize));

    let dim = grid_params.dimAndPad.xyz;
    if (x >= dim.x || y >= dim.y || z >= dim.z) { return -1; }

    return i32(x + y * dim.x + z * dim.x * dim.y);
}

@compute @workgroup_size(${COLLISION_WORKGROUP_SIZE})
fn main(@builtin(global_invocation_id) global_id: vec3u) {
    let idx = global_id.x;
    if (idx >= params.counts.x) { return; }

    var pos = positions[idx].xyz;
    let prev = prev_positions[idx].xyz;
    let inv_mass = inverse_masses[idx].x;

    if (inv_mass < EPSILON) { return; }

    var best_t = 2.0;
    var min_dist_sq = 1e9;
    var best_normal = vec3f(0.0);
    var best_surface_point = vec3f(0.0);
    var has_hit = false;
    var is_ccd = false;

    // Spatial Hash Traversal (3x3x3 Neighborhood)
    // Compute central cell coordinates
    let cellSize = grid_params.minAndSize.w;
    let rel = pos - grid_params.minAndSize.xyz;
    let cx = i32(floor(rel.x / cellSize));
    let cy = i32(floor(rel.y / cellSize));
    let cz = i32(floor(rel.z / cellSize));

    let dim = grid_params.dimAndPad.xyz;
    let dimx = i32(dim.x);
    let dimy = i32(dim.y);
    let dimz = i32(dim.z);

    // Use loop margins from uniform config or Triangle.w?
    // Triangle.w contains the margin.
    // NOTE: Triangles are static, margin shouldn't change per frame ideally unless uploaded.
    // For now we trust tri.v0.w as the source of truth for margin.

    // Iterate neighbors
    for (var z = cz - 1; z <= cz + 1; z++) {
        if (z < 0 || z >= dimz) { continue; }
        for (var y = cy - 1; y <= cy + 1; y++) {
            if (y < 0 || y >= dimy) { continue; }
            for (var x = cx - 1; x <= cx + 1; x++) {
                if (x < 0 || x >= dimx) { continue; }

                let cell_idx = u32(x + y * dimx + z * dimx * dimy);
                let cell = grid_cells[cell_idx];

                if (cell.count == 0u) { continue; }

                // Iterate triangles in this cell
                for (var i = 0u; i < cell.count; i++) {
                    let tri_idx = triangle_refs[cell.offset + i];
                    let tri = triangles[tri_idx];

                    let v0 = tri.v0.xyz;
                    let v1 = tri.v1.xyz;
                    let v2 = tri.v2.xyz;
                    let margin = tri.v0.w;

                    // 1. Continuous (CCD) Check
                    let ccd = intersect_segment(prev, pos, v0, v1, v2);
                    if (ccd.w >= 0.0) {
                        let t_val = ccd.w;
                        if (t_val < best_t) {
                            best_t = t_val;
                            best_surface_point = ccd.xyz;
                            let tri_normal = tri.normal.xyz;
                            let vel_dir = pos - prev;
                            best_normal = select(-tri_normal, tri_normal, dot(tri_normal, vel_dir) < 0.0);
                            has_hit = true;
                            is_ccd = true;
                        }
                    }

                    // 2. Discrete Check (with Deep Penetration Recovery)
                    if (!is_ccd) {
                        let closest = closest_point_on_triangle_robust(pos, v0, v1, v2);
                        let diff = pos - closest;
                        let dist_sq = dot(diff, diff);

                        // DETECTION RADIUS:
                        // Use a larger radius (e.g. 0.2m) to catch particles "deep" inside the body.
                        // Rust uses 0.05, but for "fitting" large penetrations we need more.
                        let detection_radius = 0.2;

                        if (dist_sq < detection_radius * detection_radius) {
                            if (dist_sq < min_dist_sq) {
                                let dist = sqrt(dist_sq);
                                let tri_normal = tri.normal.xyz;

                                // Check orientation: Are we inside or outside?
                                // If dot(diff, tri_normal) < 0, the vector from surface to point opposes normal -> INSIDE.
                                // However, 'diff' is (pos - closest).

                                // Ideally 'diff' aligns with 'tri_normal' if outside.

                                let is_inside = dot(diff, tri_normal) < 0.0;

                                // Handling Deep Penetration:
                                // If inside, we MUST push out along the normal.
                                // If outside, we only push if we are within the small 'margin'.

                                if (is_inside) {
                                    // INSIDE: Always resolve.
                                    min_dist_sq = dist_sq; // Track this as the "deepest" valid interaction?
                                    // Actually, for inside, the "closest" surface might be far, but we want the one that pushes us out MOST?
                                    // Or just the closest surface point.
                                    best_surface_point = closest;

                                    // Important: For inside, the normal should be the triangle normal (push OUT).
                                    // Using 'diff' would push deeper IN.

                                    best_normal = tri_normal;
                                    has_hit = true;

                                } else {
                                    // OUTSIDE: Standard collision.
                                    // Only resolve if touching the skin (margin).
                                    if (dist_sq < margin * margin) {
                                        min_dist_sq = dist_sq;
                                        best_surface_point = closest;
                                        if (dist > EPSILON) {
                                            best_normal = diff / dist;
                                        } else {
                                            best_normal = tri_normal;
                                        }
                                        has_hit = true;
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    if (has_hit) {
        // We found a collision.
        // 1. Apply Position Correction (Projection)
        // We want to project exactly to surface + margin?
        // Rust does: projection < thickness => penetration = thickness - projection.
        // Here we have best_surface_point and best_normal.
        // The penetration depth is margin - dist (for discrete) or similar.

        // Simplified Pushout to Surface + Margin
        // We use 0.01 (1cm) to match GpuEngine config and prevent visual clipping.
        let margin = 0.01;

        // Apply Position Projection
        let new_pos = best_surface_point + best_normal * margin;

        // Update Position
        positions[idx] = vec4f(new_pos, 0.0);

        // 2. Apply Friction (Velocity Modification)
        // Calculate current velocity based on projected position
        let velocity = new_pos - prev;

        // Decompose velocity
        let v_normal_mag = dot(velocity, best_normal);
        let v_normal = best_normal * v_normal_mag;
        let v_tangent = velocity - v_normal;
        let v_tangent_len = length(v_tangent);

        var friction_factor = 0.0;
        let penetration = margin; // Approximate penetration magnitude for friction calc

        let dynamic_friction = params.config.z; // From config (0.5 default)
        let static_friction = dynamic_friction + 0.1; // Slightly sticky

        if (v_tangent_len > 1e-9) {
            if (v_tangent_len < penetration * static_friction) {
                friction_factor = 1.0; // Static friction (stop completely)
            } else {
                let max_slide = penetration * dynamic_friction;
                friction_factor = max_slide / v_tangent_len;
                if (friction_factor > 1.0) { friction_factor = 1.0; }
            }
        }

        // Apply friction to tangent component
        let new_v_tangent = v_tangent * (1.0 - friction_factor);

        // Kill normal component (inelastic collision) if moving inwards
        // If v_normal_mag > 0 (moving out), keep it? Rust: if vn_mag < 0.0 { ZERO } else { vn }
        var new_v_normal = vec3f(0.0);
        if (v_normal_mag > 0.0) {
            new_v_normal = v_normal;
        }

        let total_velocity = new_v_normal + new_v_tangent;

        // Update Prev Position to reflect new velocity
        // prev = pos - velocity
        prev_positions[idx] = vec4f(new_pos - total_velocity, 0.0);
    }
}
`;

export default COLLISION_WGSL;
