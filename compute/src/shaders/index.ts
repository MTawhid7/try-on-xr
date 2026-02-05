// compute/src/shaders/index.ts
/**
 * @fileoverview Shader module exports.
 *
 * Re-exports all WGSL shaders for easy importing.
 */

// Common utilities
export { MATH_WGSL } from './common/math.wgsl';
export { TYPES_WGSL } from './common/types.wgsl';

// Core shaders
export { INTEGRATOR_WGSL, INTEGRATOR_WORKGROUP_SIZE } from './integrator.wgsl';
export { DISTANCE_WGSL, DISTANCE_WORKGROUP_SIZE } from './distance.wgsl';
export { BENDING_WGSL, BENDING_WORKGROUP_SIZE } from './bending.wgsl';
export { TETHER_WGSL, TETHER_WORKGROUP_SIZE } from './tether.wgsl';

// Collision shaders
export { COLLISION_WGSL, COLLISION_WORKGROUP_SIZE } from './collision.wgsl';

// Normal computation shaders
export {
    NORMALS_ACCUMULATE_WGSL,
    NORMALS_NORMALIZE_WGSL,
    NORMALS_SIMPLE_WGSL,
    NORMALS_WORKGROUP_SIZE
} from './normals.wgsl';
