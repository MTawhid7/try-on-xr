// compute/src/index.ts
/**
 * @fileoverview Public API for the Vestra WebGPU Compute Engine.
 *
 * This module provides GPU-accelerated physics simulation using WebGPU compute shaders.
 * It serves as the entry point for all compute-related exports.
 *
 * @module @vestra/compute
 */

// Engine
export { GpuEngine } from './engine/GpuEngine';
export type { GpuEngineConfig, GpuEngineStateConfig } from './engine/GpuEngine';
export { GpuState } from './engine/GpuState';
export type { GpuStateConfig } from './engine/GpuState';

// Capability detection
export { GpuCapabilities, checkGpuSupport } from './capabilities/GpuCapabilities';
export type { GpuSupportResult, GpuLimits } from './capabilities/GpuCapabilities';

// Buffer management
export { BufferManager } from './buffers/BufferManager';
export { ParticleBuffers, PARTICLE_BUFFER_LABELS } from './buffers/ParticleBuffers';
export type { BufferUsageType } from './buffers/BufferManager';
export type { ParticleBufferConfig } from './buffers/ParticleBuffers';

// Pipeline management
export { ShaderCompiler, BindGroupManager, Scheduler, BIND_GROUP } from './pipeline';
export type {
    CompilationResult,
    PipelineConfig,
    CompiledPipeline,
    BindGroupLayouts,
    ConstraintBatchInfo,
    SimulationPipelines,
    SimulationBindGroups,
    ConstraintBatches
} from './pipeline';

// Collision
export { BodyCollider } from './collision';
export type { BodyColliderConfig, TriangleData } from './collision';

// Constraints
export { ConstraintGenerator } from './constraints';
export type {
    DistanceConstraintData,
    BendingConstraintData,
    TetherConstraintData,
    ConstraintConfig
} from './constraints';

// Shader sources (for debugging/testing)
export { INTEGRATOR_WGSL, INTEGRATOR_WORKGROUP_SIZE } from './shaders/integrator.wgsl';
export { DISTANCE_WGSL, DISTANCE_WORKGROUP_SIZE } from './shaders/distance.wgsl';
export { BENDING_WGSL, BENDING_WORKGROUP_SIZE } from './shaders/bending.wgsl';
export { TETHER_WGSL, TETHER_WORKGROUP_SIZE } from './shaders/tether.wgsl';
export { COLLISION_WGSL, COLLISION_WORKGROUP_SIZE } from './shaders/collision.wgsl';
export {
    NORMALS_ACCUMULATE_WGSL,
    NORMALS_NORMALIZE_WGSL,
    NORMALS_SIMPLE_WGSL,
    NORMALS_WORKGROUP_SIZE
} from './shaders/normals.wgsl';
