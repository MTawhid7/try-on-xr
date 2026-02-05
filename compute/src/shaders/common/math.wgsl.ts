// compute/src/shaders/common/math.wgsl.ts
/**
 * @fileoverview Common math utilities for WGSL shaders.
 *
 * Provides vector math operations and constants used across all shaders.
 * Uses TypeScript template literals for shader composition.
 */

export const MATH_WGSL = /* wgsl */`
// ============================================
// Common Math Utilities
// ============================================

// Small epsilon to prevent division by zero
const EPSILON: f32 = 1e-7;

// Compute the squared length of a vec3
fn length_sq(v: vec3f) -> f32 {
    return dot(v, v);
}

// Safe normalization that handles zero vectors
fn safe_normalize(v: vec3f) -> vec3f {
    let len_sq = length_sq(v);
    if (len_sq < EPSILON) {
        return vec3f(0.0, 0.0, 0.0);
    }
    return v * inverseSqrt(len_sq);
}

// Clamp a value between min and max
fn clamp_value(x: f32, min_val: f32, max_val: f32) -> f32 {
    return max(min_val, min(max_val, x));
}

// Linear interpolation
fn lerp(a: f32, b: f32, t: f32) -> f32 {
    return a + (b - a) * t;
}

// Linear interpolation for vec3
fn lerp3(a: vec3f, b: vec3f, t: f32) -> vec3f {
    return a + (b - a) * t;
}
`;

export default MATH_WGSL;
