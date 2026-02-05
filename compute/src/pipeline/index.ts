// compute/src/pipeline/index.ts
/**
 * @fileoverview Pipeline module exports.
 */

export { ShaderCompiler } from './ShaderCompiler';
export type { CompilationResult, PipelineConfig, CompiledPipeline } from './ShaderCompiler';

export { BindGroupManager, BIND_GROUP } from './BindGroupManager';
export type { BindGroupLayouts } from './BindGroupManager';

export { Scheduler } from './Scheduler';
export type {
    ConstraintBatchInfo,
    SimulationPipelines,
    SimulationBindGroups,
    ConstraintBatches
} from './Scheduler';
