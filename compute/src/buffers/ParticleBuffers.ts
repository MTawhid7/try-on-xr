// compute/src/buffers/ParticleBuffers.ts
/**
 * @fileoverview Specialized buffer management for particle data.
 *
 * Handles the allocation and organization of particle-related GPU buffers
 * with proper vec4 alignment for optimal GPU performance.
 */

import { BufferManager } from './BufferManager';

/**
 * Configuration for particle buffer initialization.
 */
export interface ParticleBufferConfig {
    /** Number of particles. */
    readonly particleCount: number;
    /** Initial positions (vec3 layout, will be converted to vec4). */
    readonly positions: Float32Array;
    /** Inverse mass values (scalar, will be converted to vec4). */
    readonly inverseMasses: Float32Array;
}

/**
 * Buffer labels used for particle data.
 */
export const PARTICLE_BUFFER_LABELS = {
    POSITION: 'particle_position',
    PREV_POSITION: 'particle_prevPosition',
    VELOCITY: 'particle_velocity',
    INVERSE_MASS: 'particle_inverseMass',
    NORMAL: 'particle_normal'
} as const;

/**
 * Manages particle-specific GPU buffers.
 *
 * Ensures all particle data is properly aligned (vec4, 16 bytes per element)
 * for optimal GPU access patterns.
 */
export class ParticleBuffers {
    private manager: BufferManager;
    private particleCount: number = 0;

    /**
     * Creates a new ParticleBuffers instance.
     *
     * @param manager - The buffer manager to use for allocation.
     */
    constructor(manager: BufferManager) {
        this.manager = manager;
    }

    /**
     * Initializes all particle buffers with the provided data.
     *
     * @param config - Particle configuration with initial data.
     */
    initialize(config: ParticleBufferConfig): void {
        const { particleCount, positions, inverseMasses } = config;
        this.particleCount = particleCount;

        // Convert vec3 positions to vec4 layout
        const positions4 = this.vec3ToVec4(positions);

        // Create position buffers
        this.manager.allocateFloat32(
            PARTICLE_BUFFER_LABELS.POSITION,
            positions4,
            'storage-readwrite'
        );

        this.manager.allocateFloat32(
            PARTICLE_BUFFER_LABELS.PREV_POSITION,
            new Float32Array(positions4), // Copy for Verlet
            'storage-readwrite'
        );

        // Velocity buffer (initialized to zero)
        this.manager.allocateFloat32(
            PARTICLE_BUFFER_LABELS.VELOCITY,
            new Float32Array(particleCount * 4),
            'storage-readwrite'
        );

        // Inverse mass buffer (scalar to vec4)
        const masses4 = this.scalarToVec4(inverseMasses);
        this.manager.allocateFloat32(
            PARTICLE_BUFFER_LABELS.INVERSE_MASS,
            masses4,
            'storage-read'
        );

        // Normal buffer (computed each frame)
        this.manager.allocateFloat32(
            PARTICLE_BUFFER_LABELS.NORMAL,
            new Float32Array(particleCount * 4),
            'storage-readwrite'
        );

        console.log(`[ParticleBuffers] Initialized ${particleCount} particles`);
    }

    /**
     * Gets the position buffer.
     */
    getPositionBuffer(): GPUBuffer {
        return this.getBuffer(PARTICLE_BUFFER_LABELS.POSITION);
    }

    /**
     * Gets the previous position buffer.
     */
    getPrevPositionBuffer(): GPUBuffer {
        return this.getBuffer(PARTICLE_BUFFER_LABELS.PREV_POSITION);
    }

    /**
     * Gets the velocity buffer.
     */
    getVelocityBuffer(): GPUBuffer {
        return this.getBuffer(PARTICLE_BUFFER_LABELS.VELOCITY);
    }

    /**
     * Gets the inverse mass buffer.
     */
    getInverseMassBuffer(): GPUBuffer {
        return this.getBuffer(PARTICLE_BUFFER_LABELS.INVERSE_MASS);
    }

    /**
     * Gets the normal buffer.
     */
    getNormalBuffer(): GPUBuffer {
        return this.getBuffer(PARTICLE_BUFFER_LABELS.NORMAL);
    }

    /**
     * Gets the particle count.
     */
    getParticleCount(): number {
        return this.particleCount;
    }

    /**
     * Disposes all particle buffers.
     */
    dispose(): void {
        for (const label of Object.values(PARTICLE_BUFFER_LABELS)) {
            this.manager.dispose(label);
        }
        this.particleCount = 0;
    }

    // --- Private Helpers ---

    private getBuffer(label: string): GPUBuffer {
        const buffer = this.manager.get(label);
        if (!buffer) {
            throw new Error(`[ParticleBuffers] Buffer "${label}" not found`);
        }
        return buffer;
    }

    /**
     * Converts vec3 array to vec4 layout.
     * [x,y,z, x,y,z, ...] -> [x,y,z,0, x,y,z,0, ...]
     */
    private vec3ToVec4(vec3: Float32Array): Float32Array {
        const count = vec3.length / 3;
        const vec4 = new Float32Array(count * 4);
        for (let i = 0; i < count; i++) {
            vec4[i * 4 + 0] = vec3[i * 3 + 0];
            vec4[i * 4 + 1] = vec3[i * 3 + 1];
            vec4[i * 4 + 2] = vec3[i * 3 + 2];
            vec4[i * 4 + 3] = 0.0;
        }
        return vec4;
    }

    /**
     * Converts scalar array to vec4 layout.
     * [s, s, ...] -> [s,0,0,0, s,0,0,0, ...]
     */
    private scalarToVec4(scalar: Float32Array): Float32Array {
        const count = scalar.length;
        const vec4 = new Float32Array(count * 4);
        for (let i = 0; i < count; i++) {
            vec4[i * 4 + 0] = scalar[i];
            vec4[i * 4 + 1] = 0.0;
            vec4[i * 4 + 2] = 0.0;
            vec4[i * 4 + 3] = 0.0;
        }
        return vec4;
    }
}
