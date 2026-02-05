// compute/src/engine/GpuEngine.ts
/**
 * @fileoverview Main GPU physics engine orchestrator.
 *
 * This is the primary entry point for GPU-accelerated physics simulation.
 * It manages shader pipelines, buffer bindings, and the simulation loop.
 */

import { GpuState, type GpuStateConfig } from './GpuState';
import { ShaderCompiler } from '../pipeline/ShaderCompiler';
import { BindGroupManager } from '../pipeline/BindGroupManager';
import { Scheduler, type SimulationPipelines, type SimulationBindGroups, type ConstraintBatches, type CollisionInfo } from '../pipeline/Scheduler';
import { ConstraintGenerator } from '../constraints/ConstraintGenerator';
import { BodyCollider } from '../collision/BodyCollider';
import { INTEGRATOR_WGSL } from '../shaders/integrator.wgsl';
import { DISTANCE_WGSL } from '../shaders/distance.wgsl';
import { BENDING_WGSL } from '../shaders/bending.wgsl';
import { TETHER_WGSL } from '../shaders/tether.wgsl';
import { COLLISION_WGSL } from '../shaders/collision.wgsl';

/**
 * Configuration for the GPU engine.
 */
export interface GpuEngineConfig {
    /** Number of substeps per frame (higher = more stable). */
    readonly substeps: number;
    /** Number of solver iterations per substep. */
    readonly solverIterations: number;
    /** Gravity vector. */
    readonly gravity: [number, number, number];
    /** Global damping factor (0-1). */
    readonly damping: number;
    /** Collision margin. */
    readonly collisionMargin: number;
}

/**
 * Extended state config including collider data.
 */
export interface GpuEngineStateConfig extends GpuStateConfig {
    /** Collider vertex positions (optional). */
    readonly colliderPositions?: Float32Array;
    /** Collider vertex normals (optional). */
    readonly colliderNormals?: Float32Array;
    /** Collider triangle indices (optional). */
    readonly colliderIndices?: Uint32Array;
}

/**
 * Default engine configuration matching the Rust backend.
 */
const DEFAULT_CONFIG: GpuEngineConfig = {
    substeps: 6,
    solverIterations: 12,
    gravity: [0, -9.81, 0],
    damping: 0.985,
    collisionMargin: 0.01
};

/**
 * GPU-accelerated physics engine using WebGPU compute shaders.
 *
 * This class orchestrates the entire GPU physics pipeline:
 * 1. Integration (Verlet)
 * 2. Collision detection and response
 * 3. Constraint solving (Distance, Bending, Tether)
 */
export class GpuEngine {
    /** GPU device reference. */
    private device: GPUDevice;

    /** Engine configuration. */
    private config: GpuEngineConfig;

    /** Simulation state container. */
    private state: GpuState | null = null;

    /** Shader compilation manager. */
    private compiler: ShaderCompiler;

    /** Bind group manager. */
    private bindGroupManager: BindGroupManager;

    /** Body collider for collision detection. */
    private bodyCollider: BodyCollider | null = null;

    /** Compute pass scheduler. */
    private scheduler: Scheduler | null = null;

    /** Whether the engine is ready to simulate. */
    private ready: boolean = false;

    // Compute pipelines
    private pipelines: SimulationPipelines | null = null;

    // Bind groups
    private bindGroups: SimulationBindGroups | null = null;

    // Collision info
    private collisionInfo: CollisionInfo | null = null;

    // Constraint batches (populated during initialization)
    private constraintBatches: ConstraintBatches = {
        distance: [],
        bending: [],
        tether: []
    };

    // Constraint buffers
    private constraintBuffers: GPUBuffer[] = [];

    // Uniform buffers
    private paramsBuffer: GPUBuffer | null = null;

    // Cached initial positions for constraint generation
    private initialPositions: Float32Array | null = null;
    private meshIndices: Uint32Array | null = null;

    /**
     * Creates a new GPU engine instance.
     *
     * @param device - The GPU device to use.
     * @param config - Optional configuration overrides.
     */
    constructor(device: GPUDevice, config: Partial<GpuEngineConfig> = {}) {
        this.device = device;
        this.config = { ...DEFAULT_CONFIG, ...config };
        this.compiler = new ShaderCompiler(device);
        this.bindGroupManager = new BindGroupManager(device);
    }

    /**
     * Initializes the engine with geometry data.
     *
     * @param stateConfig - Configuration for the simulation state.
     */
    async initialize(stateConfig: GpuEngineStateConfig): Promise<void> {
        if (this.ready) {
            throw new Error('[GpuEngine] Already initialized. Call dispose() first.');
        }

        console.log('[GpuEngine] Initializing...');

        // Cache positions and indices for constraint generation
        this.initialPositions = stateConfig.initialPositions;
        this.meshIndices = stateConfig.indices;

        // Initialize state
        this.state = new GpuState(this.device, stateConfig);
        await this.state.initialize(stateConfig);

        // Create bind group layouts
        this.bindGroupManager.createLayouts();

        // Create uniform buffer for simulation parameters
        this.paramsBuffer = this.createParamsBuffer();

        // Initialize body collider if data is provided
        if (stateConfig.colliderPositions && stateConfig.colliderNormals && stateConfig.colliderIndices) {
            this.bodyCollider = new BodyCollider(this.device);
            this.bodyCollider.initialize({
                positions: stateConfig.colliderPositions,
                normals: stateConfig.colliderNormals,
                indices: stateConfig.colliderIndices,
                margin: this.config.collisionMargin
            });
        }

        // Compile shaders and create pipelines
        await this.compilePipelines();

        // Create bind groups
        this.createBindGroups();

        // Generate and upload constraints
        this.generateConstraints();

        // Create scheduler
        this.scheduler = new Scheduler(
            stateConfig.particleCount,
            this.config.substeps,
            this.config.solverIterations
        );

        this.ready = true;
        console.log('[GpuEngine] Initialized and ready');
    }

    /**
     * Advances the simulation by dt seconds.
     *
     * @param dt - Time step in seconds.
     */
    step(dt: number): void {
        if (!this.ready || !this.scheduler || !this.pipelines || !this.bindGroups) {
            console.warn('[GpuEngine] Not initialized, skipping step');
            return;
        }

        const sdt = dt / this.config.substeps;

        // Update params buffer with current timestep
        this.updateParamsBuffer(sdt);

        // Create command encoder
        const commandEncoder = this.device.createCommandEncoder({
            label: 'physics_step'
        });

        // Encode all simulation passes
        this.scheduler.encodeSimulationStep(
            commandEncoder,
            this.pipelines,
            this.bindGroups,
            this.constraintBatches,
            this.collisionInfo ?? undefined
        );

        // Submit commands
        this.device.queue.submit([commandEncoder.finish()]);
    }

    /**
     * Gets the current particle count.
     */
    getParticleCount(): number {
        return this.state?.particleCount ?? 0;
    }

    /**
     * Gets the position buffer for rendering.
     */
    getPositionBuffer(): GPUBuffer | null {
        return this.state?.getPositionBuffer() ?? null;
    }

    /**
     * Gets the normal buffer for rendering.
     */
    getNormalBuffer(): GPUBuffer | null {
        return this.state?.getNormalBuffer() ?? null;
    }

    /**
     * Reads positions back to CPU (async operation).
     */
    async readPositions(): Promise<Float32Array> {
        if (!this.state) {
            throw new Error('[GpuEngine] Not initialized');
        }
        return this.state.readPositions();
    }

    /**
     * Disposes all GPU resources.
     */
    dispose(): void {
        this.state?.dispose();
        this.bodyCollider?.dispose();
        this.paramsBuffer?.destroy();
        this.compiler.clearCache();

        // Destroy constraint buffers
        for (const buffer of this.constraintBuffers) {
            buffer.destroy();
        }
        this.constraintBuffers = [];

        this.state = null;
        this.bodyCollider = null;
        this.paramsBuffer = null;
        this.pipelines = null;
        this.bindGroups = null;
        this.collisionInfo = null;
        this.scheduler = null;
        this.constraintBatches = { distance: [], bending: [], tether: [] };
        this.initialPositions = null;
        this.meshIndices = null;

        this.ready = false;
        console.log('[GpuEngine] Disposed');
    }

    // --- Private Methods ---

    /**
     * Creates the simulation parameters uniform buffer.
     * Uses STRICT vec4 alignment for all fields to match WGSL layout.
     *
     * Layout (48 bytes):
     *   0-16:  config (vec4f: x=dt, y=damping, z=unused, w=unused)
     *   16-32: gravity (vec4f: xyz=gravity, w=unused)
     *   32-48: counts (vec4u: x=count, y=substep, z=iter, w=unused)
     */
    private createParamsBuffer(): GPUBuffer {
        const data = new ArrayBuffer(48);
        const view = new DataView(data);

        // config (vec4f) at offset 0
        view.setFloat32(0, 0.0, true); // dt
        view.setFloat32(4, this.config.damping, true); // damping
        view.setFloat32(8, 0.0, true); // unused
        view.setFloat32(12, 0.0, true); // unused

        // gravity (vec4f) at offset 16
        view.setFloat32(16, this.config.gravity[0], true);
        view.setFloat32(20, this.config.gravity[1], true);
        view.setFloat32(24, this.config.gravity[2], true);
        view.setFloat32(28, 0.0, true); // unused

        // counts (vec4u) at offset 32
        view.setUint32(32, 0, true); // particle_count
        view.setUint32(36, 0, true); // substep
        view.setUint32(40, 0, true); // iteration
        view.setUint32(44, 0, true); // unused

        const buffer = this.device.createBuffer({
            label: 'simulationParams',
            size: 48,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC
        });

        this.device.queue.writeBuffer(buffer, 0, data);

        return buffer;
    }

    /**
     * Updates the params buffer with current timestep.
     * Matches strict vec4 layout.
     */
    private updateParamsBuffer(dt: number): void {
        const data = new ArrayBuffer(48);
        const view = new DataView(data);

        // config at offset 0
        view.setFloat32(0, dt, true);
        view.setFloat32(4, this.config.damping, true);
        view.setFloat32(8, 0.0, true);
        view.setFloat32(12, 0.0, true);

        // gravity at offset 16
        view.setFloat32(16, this.config.gravity[0], true);
        view.setFloat32(20, this.config.gravity[1], true);
        view.setFloat32(24, this.config.gravity[2], true);
        view.setFloat32(28, 0.0, true);

        // counts at offset 32
        view.setUint32(32, this.state?.particleCount ?? 0, true); // particle_count
        view.setUint32(36, 0, true); // substep
        view.setUint32(40, 0, true); // iteration
        view.setUint32(44, 0, true); // unused

        this.device.queue.writeBuffer(this.paramsBuffer!, 0, data);
    }

    /**
     * Compiles all compute shader pipelines.
     */
    private async compilePipelines(): Promise<void> {
        const layouts = this.bindGroupManager.getLayouts();

        // Create pipeline configurations
        const configs = [
            {
                label: 'integrator',
                shaderSource: INTEGRATOR_WGSL,
                entryPoint: 'main',
                bindGroupLayouts: [layouts.params, layouts.particles]
            },
            {
                label: 'distance',
                shaderSource: DISTANCE_WGSL,
                entryPoint: 'main',
                bindGroupLayouts: [layouts.params, layouts.particles, layouts.distanceConstraints]
            },
            {
                label: 'bending',
                shaderSource: BENDING_WGSL,
                entryPoint: 'main',
                bindGroupLayouts: [layouts.params, layouts.particles, layouts.bendingConstraints]
            },
            {
                label: 'tether',
                shaderSource: TETHER_WGSL,
                entryPoint: 'main',
                bindGroupLayouts: [layouts.params, layouts.particles, layouts.tetherConstraints]
            }
        ];

        // Add collision pipeline if collider is present
        if (this.bodyCollider) {
            configs.push({
                label: 'collision',
                shaderSource: COLLISION_WGSL,
                entryPoint: 'main',
                bindGroupLayouts: [layouts.params, layouts.particles, layouts.bodyCollision]
            });
        }

        // Compile all pipelines
        const results = await this.compiler.createPipelines(configs);

        this.pipelines = {
            integrator: results[0].pipeline,
            distance: results[1].pipeline,
            bending: results[2].pipeline,
            tether: results[3].pipeline,
            collision: this.bodyCollider ? results[4].pipeline : undefined
        };

        console.log('[GpuEngine] All pipelines compiled');
    }

    /**
     * Creates bind groups for all pipelines.
     */
    private createBindGroups(): void {
        if (!this.state || !this.paramsBuffer) {
            throw new Error('[GpuEngine] State or params buffer not initialized');
        }

        const paramsGroup = this.bindGroupManager.createParamsBindGroup(this.paramsBuffer);

        const particlesGroup = this.bindGroupManager.createParticlesBindGroup(
            this.state.getPositionBuffer(),
            this.state.getPrevPositionBuffer(),
            this.state.getVelocityBuffer(),
            this.state.getInverseMassBuffer()
        );

        this.bindGroups = {
            params: paramsGroup,
            particles: particlesGroup
        };

        // Create collision bind group if collider is present
        if (this.bodyCollider) {
            const collisionBindGroup = this.bindGroupManager.createCollisionBindGroup(
                this.bodyCollider.getTriangleBuffer(),
                this.bodyCollider.getTriangleCountBuffer()
            );

            this.collisionInfo = {
                bindGroup: collisionBindGroup,
                triangleCount: this.bodyCollider.getTriangleCount()
            };

            console.log(`[GpuEngine] Collision bind group created with ${this.collisionInfo.triangleCount} triangles`);
        }

        console.log('[GpuEngine] Bind groups created');
    }

    /**
     * Generates constraints from mesh topology and uploads to GPU.
     */
    private generateConstraints(): void {
        if (!this.initialPositions || !this.meshIndices) {
            console.warn('[GpuEngine] No mesh data for constraint generation');
            return;
        }

        // Generate distance constraints from edges
        const distanceConstraints = ConstraintGenerator.generateDistanceConstraints(
            this.initialPositions,
            this.meshIndices,
            { distanceCompliance: 0.0001 }
        );

        if (distanceConstraints.length === 0) {
            console.warn('[GpuEngine] No distance constraints generated');
            return;
        }

        // Create GPU buffer for distance constraints
        const { buffer: constraintBuffer, count } = ConstraintGenerator.createConstraintBuffer(
            this.device,
            distanceConstraints,
            'distance_constraints'
        );
        this.constraintBuffers.push(constraintBuffer);

        // Create count buffer
        const countBuffer = ConstraintGenerator.createCountBuffer(
            this.device,
            count,
            'distance_count'
        );
        this.constraintBuffers.push(countBuffer);

        // Create bind group for this batch
        const bindGroup = this.bindGroupManager.createConstraintBindGroup(
            'distance',
            constraintBuffer,
            countBuffer
        );

        // Add to constraint batches
        this.constraintBatches.distance.push({
            bindGroup,
            count
        });

        console.log(`[GpuEngine] Created ${count} distance constraints`);
    }
}
