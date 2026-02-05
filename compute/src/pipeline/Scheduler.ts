// compute/src/pipeline/Scheduler.ts
/**
 * @fileoverview Compute pass scheduling and execution.
 *
 * Orchestrates the execution of compute passes in the correct order
 * with proper memory barriers between dependent passes.
 */

import { INTEGRATOR_WORKGROUP_SIZE } from '../shaders/integrator.wgsl';
import { DISTANCE_WORKGROUP_SIZE } from '../shaders/distance.wgsl';
import { BENDING_WORKGROUP_SIZE } from '../shaders/bending.wgsl';
import { TETHER_WORKGROUP_SIZE } from '../shaders/tether.wgsl';
import { COLLISION_WORKGROUP_SIZE } from '../shaders/collision.wgsl';

/**
 * A constraint batch to be processed.
 */
export interface ConstraintBatchInfo {
    readonly bindGroup: GPUBindGroup;
    readonly count: number;
}

/**
 * Collision info for body collision pass.
 */
export interface CollisionInfo {
    readonly bindGroup: GPUBindGroup;
    readonly triangleCount: number;
}

/**
 * All pipelines needed for simulation.
 */
export interface SimulationPipelines {
    readonly integrator: GPUComputePipeline;
    readonly distance: GPUComputePipeline;
    readonly bending: GPUComputePipeline;
    readonly tether: GPUComputePipeline;
    readonly collision?: GPUComputePipeline;
}

/**
 * Bind groups for simulation.
 */
export interface SimulationBindGroups {
    readonly params: GPUBindGroup;
    readonly particles: GPUBindGroup;
}

/**
 * Constraint batches organized by type.
 */
export interface ConstraintBatches {
    readonly distance: ConstraintBatchInfo[];
    readonly bending: ConstraintBatchInfo[];
    readonly tether: ConstraintBatchInfo[];
}

/**
 * Schedules and executes compute passes for physics simulation.
 *
 * The simulation loop executes (matching Rust order):
 * 1. For each substep:
 *    a. Integration (apply gravity, update positions)
 *    b. Collision detection (once per substep, before constraints)
 *    c. For each solver iteration:
 *       - Distance constraints (batched)
 *       - Bending constraints (batched)
 *       - Tether constraints (batched)
 *       - Collision response (once per iteration)
 */
export class Scheduler {
    private particleCount: number;
    private substeps: number;
    private iterations: number;

    /**
     * Creates a new scheduler.
     *
     * @param particleCount - Number of particles.
     * @param substeps - Number of substeps per frame.
     * @param iterations - Solver iterations per substep.
     */
    constructor(particleCount: number, substeps: number, iterations: number) {
        this.particleCount = particleCount;
        this.substeps = substeps;
        this.iterations = iterations;
    }

    /**
     * Encodes all compute passes for one simulation step.
     *
     * @param encoder - Command encoder.
     * @param pipelines - All compute pipelines.
     * @param bindGroups - Core bind groups.
     * @param constraints - Constraint batches.
     * @param collision - Optional collision info.
     */
    encodeSimulationStep(
        encoder: GPUCommandEncoder,
        pipelines: SimulationPipelines,
        bindGroups: SimulationBindGroups,
        constraints: ConstraintBatches,
        collision?: CollisionInfo
    ): void {
        const integratorDispatch = Math.ceil(this.particleCount / INTEGRATOR_WORKGROUP_SIZE);
        const collisionDispatch = Math.ceil(this.particleCount / COLLISION_WORKGROUP_SIZE);

        for (let substep = 0; substep < this.substeps; substep++) {
            // 1. Integration pass (apply gravity, update positions)
            this.encodeIntegratorPass(
                encoder,
                pipelines.integrator,
                bindGroups,
                integratorDispatch
            );

            // 2. Constraint solving iterations
            for (let iter = 0; iter < this.iterations; iter++) {
                // Distance constraints (all batches)
                for (const batch of constraints.distance) {
                    this.encodeConstraintPass(
                        encoder,
                        pipelines.distance,
                        bindGroups,
                        batch,
                        DISTANCE_WORKGROUP_SIZE
                    );
                }

                // Bending constraints (all batches)
                for (const batch of constraints.bending) {
                    this.encodeConstraintPass(
                        encoder,
                        pipelines.bending,
                        bindGroups,
                        batch,
                        BENDING_WORKGROUP_SIZE
                    );
                }

                // Tether constraints (all batches)
                for (const batch of constraints.tether) {
                    this.encodeConstraintPass(
                        encoder,
                        pipelines.tether,
                        bindGroups,
                        batch,
                        TETHER_WORKGROUP_SIZE
                    );
                }

                // 3. Body collision response (Interleaved with constraints)
                // Rust behavior: collisions are resolved INSIDE the solver loop
                if (collision && pipelines.collision) {
                    this.encodeCollisionPass(
                        encoder,
                        pipelines.collision,
                        bindGroups,
                        collision,
                        collisionDispatch
                    );
                }
            }
        }
    }

    /**
     * Encodes the integrator pass.
     */
    private encodeIntegratorPass(
        encoder: GPUCommandEncoder,
        pipeline: GPUComputePipeline,
        bindGroups: SimulationBindGroups,
        dispatchCount: number
    ): void {
        const pass = encoder.beginComputePass({ label: 'integrator' });
        pass.setPipeline(pipeline);
        pass.setBindGroup(0, bindGroups.params);
        pass.setBindGroup(1, bindGroups.particles);
        pass.dispatchWorkgroups(dispatchCount);
        pass.end();
    }

    /**
     * Encodes a constraint solving pass.
     */
    private encodeConstraintPass(
        encoder: GPUCommandEncoder,
        pipeline: GPUComputePipeline,
        bindGroups: SimulationBindGroups,
        batch: ConstraintBatchInfo,
        workgroupSize: number
    ): void {
        if (batch.count === 0) {
            return;
        }

        const dispatchCount = Math.ceil(batch.count / workgroupSize);

        const pass = encoder.beginComputePass({ label: 'constraint' });
        pass.setPipeline(pipeline);
        pass.setBindGroup(0, bindGroups.params);
        pass.setBindGroup(1, bindGroups.particles);
        pass.setBindGroup(2, batch.bindGroup);
        pass.dispatchWorkgroups(dispatchCount);
        pass.end();
    }

    /**
     * Encodes the body collision pass.
     */
    private encodeCollisionPass(
        encoder: GPUCommandEncoder,
        pipeline: GPUComputePipeline,
        bindGroups: SimulationBindGroups,
        collision: CollisionInfo,
        dispatchCount: number
    ): void {
        const pass = encoder.beginComputePass({ label: 'body_collision' });
        pass.setPipeline(pipeline);
        pass.setBindGroup(0, bindGroups.params);
        pass.setBindGroup(1, bindGroups.particles);
        pass.setBindGroup(2, collision.bindGroup);
        pass.dispatchWorkgroups(dispatchCount);
        pass.end();
    }

    /**
     * Updates the scheduler configuration.
     */
    configure(particleCount: number, substeps: number, iterations: number): void {
        this.particleCount = particleCount;
        this.substeps = substeps;
        this.iterations = iterations;
    }
}
