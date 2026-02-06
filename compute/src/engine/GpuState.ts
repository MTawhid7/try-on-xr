// compute/src/engine/GpuState.ts
/**
 * @fileoverview GPU simulation state container.
 *
 * Manages the GPU-side state including particle positions, velocities,
 * and constraint data. Provides methods for initialization and readback.
 */

/**
 * Configuration for initializing GPU state.
 */
export interface GpuStateConfig {
    /** Number of particles (vertices) to simulate. */
    readonly particleCount: number;
    /** Initial particle positions (flat array: x, y, z, x, y, z, ...). */
    readonly initialPositions: Float32Array;
    /** Initial particle normals (flat array, optional). */
    readonly initialNormals?: Float32Array;
    /** Inverse mass values (0 = pinned, > 0 = mobile). */
    readonly inverseMasses: Float32Array;
    /** Triangle indices for the mesh. */
    readonly indices: Uint32Array;
}

/**
 * State container for GPU-based physics simulation.
 *
 * Encapsulates all GPU buffers and provides lifecycle management.
 * This class is responsible for buffer creation, initialization,
 * and cleanup—but NOT for the simulation logic itself.
 */
export class GpuState {
    /** Number of particles in the simulation. */
    readonly particleCount: number;

    /** GPU device reference. */
    private device: GPUDevice;

    /** Whether the state has been initialized. */
    private initialized: boolean = false;

    // GPU Buffers
    private positionBuffer: GPUBuffer | null = null;
    private prevPositionBuffer: GPUBuffer | null = null;
    private velocityBuffer: GPUBuffer | null = null;
    private inverseMassBuffer: GPUBuffer | null = null;
    private normalBuffer: GPUBuffer | null = null;

    // Double buffering for async readback
    private readbackBuffers: GPUBuffer[] = [];
    private currentReadbackIndex: number = 0;
    private mapPromises: Promise<void>[] = [];

    /**
     * Creates a new GpuState instance.
     *
     * @param device - The GPU device to use for buffer creation.
     * @param config - Configuration for the simulation state.
     */
    constructor(device: GPUDevice, config: GpuStateConfig) {
        this.device = device;
        this.particleCount = config.particleCount;
    }

    /**
     * Initializes GPU buffers with the provided data.
     *
     * @param config - Configuration containing initial data.
     */
    async initialize(config: GpuStateConfig): Promise<void> {
        if (this.initialized) {
            throw new Error('[GpuState] Already initialized. Call dispose() first.');
        }

        const { particleCount, initialPositions, inverseMasses } = config;

        // Validate input
        if (initialPositions.length !== particleCount * 3) {
            throw new Error(
                `[GpuState] Position array length mismatch. ` +
                `Expected ${particleCount * 3}, got ${initialPositions.length}`
            );
        }

        // Convert to vec4 layout (16-byte aligned)
        const positions4 = this.toVec4Layout(initialPositions);
        const prevPositions4 = new Float32Array(positions4); // Copy for Verlet

        // Create GPU buffers
        this.positionBuffer = this.createStorageBuffer(positions4, 'position');
        this.prevPositionBuffer = this.createStorageBuffer(prevPositions4, 'prevPosition');
        this.velocityBuffer = this.createStorageBuffer(
            new Float32Array(particleCount * 4),
            'velocity'
        );
        const invMassData = this.toVec4LayoutScalar(inverseMasses);

        // Debug: Check if particles are pinned
        let pinnedCount = 0;
        let mobileCount = 0;
        for (let i = 0; i < Math.min(particleCount, 10); i++) {
            console.log(`[GpuState] Particle ${i} invMass: input=${inverseMasses[i]}, buffer=${invMassData[i * 4]}`);
        }
        for (let i = 0; i < particleCount; i++) {
            if (inverseMasses[i] === 0) pinnedCount++;
            else mobileCount++;
        }
        console.log(`[GpuState] Mass stats: ${mobileCount} mobile, ${pinnedCount} pinned`);

        this.inverseMassBuffer = this.createStorageBuffer(
            invMassData,
            'inverseMass'
        );
        this.normalBuffer = this.createStorageBuffer(
            new Float32Array(particleCount * 4),
            'normal'
        );

        // Create TWO readback buffers for pipelining (Zero-Copy Readback effectively)
        const readbackSize = particleCount * 4 * Float32Array.BYTES_PER_ELEMENT;
        this.readbackBuffers = [
            this.device.createBuffer({
                label: 'readback_0',
                size: readbackSize,
                usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ
            }),
            this.device.createBuffer({
                label: 'readback_1',
                size: readbackSize,
                usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ
            })
        ];

        this.currentReadbackIndex = 0;
        this.mapPromises = [Promise.resolve(), Promise.resolve()];

        this.initialized = true;
        console.log(`[GpuState] Initialized with ${particleCount} particles`);
    }

    /**
     * Gets the position buffer for binding.
     */
    getPositionBuffer(): GPUBuffer {
        this.ensureInitialized();
        return this.positionBuffer!;
    }

    /**
     * Gets the previous position buffer for binding.
     */
    getPrevPositionBuffer(): GPUBuffer {
        this.ensureInitialized();
        return this.prevPositionBuffer!;
    }

    /**
     * Gets the velocity buffer for binding.
     */
    getVelocityBuffer(): GPUBuffer {
        this.ensureInitialized();
        return this.velocityBuffer!;
    }

    /**
     * Gets the inverse mass buffer for binding.
     */
    getInverseMassBuffer(): GPUBuffer {
        this.ensureInitialized();
        return this.inverseMassBuffer!;
    }

    /**
     * Gets the normal buffer for binding.
     */
    getNormalBuffer(): GPUBuffer {
        this.ensureInitialized();
        return this.normalBuffer!;
    }

    /**
     * Reads positions back to CPU memory using Double Buffering to prevent stalls.
     * This introduces 1 frame of latency but allows the GPU and CPU to run in parallel.
     *
     * @returns Float32Array containing positions in vec4 layout.
     */
    async readPositions(): Promise<Float32Array> {
        this.ensureInitialized();

        const writeIndex = this.currentReadbackIndex % 2;
        const readIndex = (this.currentReadbackIndex + 1) % 2;

        const writeBuffer = this.readbackBuffers[writeIndex];
        const readBuffer = this.readbackBuffers[readIndex];

        // 1. Schedule copy for CURRENT frame
        const commandEncoder = this.device.createCommandEncoder();
        commandEncoder.copyBufferToBuffer(
            this.positionBuffer!,
            0,
            writeBuffer,
            0,
            this.particleCount * 4 * Float32Array.BYTES_PER_ELEMENT
        );
        this.device.queue.submit([commandEncoder.finish()]);

        // 2. Schedule async map for this write buffer
        this.mapPromises[writeIndex] = writeBuffer.mapAsync(GPUMapMode.READ);

        // 3. Process PREVIOUS frame
        // If we haven't wrapped around yet (first 1 frames), we just return 0s or initial pos equivalent
        // to avoid waiting on an unmapped buffer.
        let result: Float32Array;

        if (this.currentReadbackIndex < 1) {
            // First frame: Return empty or initial (simplest is just create new)
            // We return a zeroed array of correct size, or simpler, reuse the logic later but don't wait?
            // Actually, simplest is to just return a temp array for the very first frame.
            result = new Float32Array(this.particleCount * 4);
        } else {
            // Wait for the PREVIOUS buffer to be ready (should be fast/instant)
            try {
                await this.mapPromises[readIndex];

                // Read data
                const range = readBuffer.getMappedRange();
                result = new Float32Array(range.slice(0)); // Copy is necessary
                readBuffer.unmap();
            } catch (e: any) {
                if (e.name === 'AbortError' || e.message?.includes('destroyed')) {
                    // Buffer destroyed during wait (resize happened) - ignore
                    result = new Float32Array(this.particleCount * 4);
                } else {
                    throw e;
                }
            }
        }

        this.currentReadbackIndex++;
        return result;
    }

    /**
     * Disposes all GPU resources.
     */
    dispose(): void {
        this.positionBuffer?.destroy();
        this.prevPositionBuffer?.destroy();
        this.velocityBuffer?.destroy();
        this.inverseMassBuffer?.destroy();
        this.normalBuffer?.destroy();

        this.readbackBuffers.forEach(b => b.destroy());
        this.readbackBuffers = [];

        this.positionBuffer = null;
        this.prevPositionBuffer = null;
        this.velocityBuffer = null;
        this.inverseMassBuffer = null;
        this.normalBuffer = null;

        this.initialized = false;
        console.log('[GpuState] Disposed');
    }

    // --- Private Helpers ---

    /**
     * Creates a storage buffer with optional initial data.
     */
    private createStorageBuffer(data: Float32Array, label: string): GPUBuffer {
        const buffer = this.device.createBuffer({
            label,
            size: data.byteLength,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST,
            mappedAtCreation: true
        });
        new Float32Array(buffer.getMappedRange()).set(data);
        buffer.unmap();
        return buffer;
    }

    /**
     * Converts vec3 array to vec4 layout (16-byte aligned).
     */
    private toVec4Layout(vec3Array: Float32Array): Float32Array {
        const count = vec3Array.length / 3;
        const vec4Array = new Float32Array(count * 4);
        for (let i = 0; i < count; i++) {
            vec4Array[i * 4 + 0] = vec3Array[i * 3 + 0];
            vec4Array[i * 4 + 1] = vec3Array[i * 3 + 1];
            vec4Array[i * 4 + 2] = vec3Array[i * 3 + 2];
            vec4Array[i * 4 + 3] = 0.0; // Padding
        }
        return vec4Array;
    }

    /**
     * Converts scalar array to vec4 layout (value in x, padding in yzw).
     */
    private toVec4LayoutScalar(scalarArray: Float32Array): Float32Array {
        const count = scalarArray.length;
        const vec4Array = new Float32Array(count * 4);
        for (let i = 0; i < count; i++) {
            vec4Array[i * 4 + 0] = scalarArray[i];
            vec4Array[i * 4 + 1] = 0.0;
            vec4Array[i * 4 + 2] = 0.0;
            vec4Array[i * 4 + 3] = 0.0;
        }
        return vec4Array;
    }

    /**
     * Throws if not initialized.
     */
    private ensureInitialized(): void {
        if (!this.initialized) {
            throw new Error('[GpuState] Not initialized. Call initialize() first.');
        }
    }
}
