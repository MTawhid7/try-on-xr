// src/infrastructure/physics/adapter/GpuAdapter.ts
/**
 * @fileoverview WebGPU physics engine adapter.
 *
 * Implements IPhysicsEngine interface using the WebGPU compute engine.
 * Provides the bridge between Three.js rendering and GPU physics simulation.
 */

import * as THREE from 'three';
import type { IPhysicsEngine, PhysicsBackend } from '../../../core/interfaces/IPhysicsEngine';
import { GpuEngine, type GpuEngineConfig, type GpuEngineStateConfig } from '../../../../compute/src';

/**
 * Configuration for GpuAdapter initialization.
 */
export interface GpuAdapterConfig extends Partial<GpuEngineConfig> {
    /** GPU device instance. */
    device: GPUDevice;
}

/**
 * WebGPU-based physics engine adapter.
 *
 * Implements the IPhysicsEngine interface for seamless integration
 * with the existing application architecture.
 */
export class GpuAdapter implements IPhysicsEngine {
    /** Backend identifier. */
    readonly backend: PhysicsBackend = 'webgpu';

    /** GPU device reference. */
    private device: GPUDevice;

    /** Internal GPU engine. */
    private engine: GpuEngine | null = null;

    /** Vertex count for rendering. */
    private vertexCount: number = 0;

    /** Cached position buffer for Three.js. */
    private cachedPositionAttribute: THREE.BufferAttribute | null = null;
    private cachedNormalAttribute: THREE.BufferAttribute | null = null;

    /** CPU-side position array for readback. */
    private cpuPositions: Float32Array | null = null;

    /** Whether async readback is pending. */
    private readbackPending: boolean = false;

    /**
     * Creates a new GpuAdapter.
     *
     * @param config - Adapter configuration with GPU device.
     */
    constructor(config: GpuAdapterConfig) {
        this.device = config.device;
        this.engine = new GpuEngine(this.device, config);
    }

    /**
     * Initializes the GPU physics engine with geometry data.
     */
    async init(
        garmentVerts: Float32Array,
        garmentNormals: Float32Array,
        garmentIndices: Uint32Array,
        _garmentUVs: Float32Array,
        colliderVerts: Float32Array,
        colliderNormals: Float32Array,
        colliderIndices: Uint32Array,
        scaleFactor: number
    ): Promise<void> {
        this.vertexCount = garmentVerts.length / 3;

        // Compute inverse masses (simple: 1.0 for all, 0.0 for pinned)
        // TODO: Get pinned vertices from preprocessing
        const inverseMasses = new Float32Array(this.vertexCount);
        for (let i = 0; i < this.vertexCount; i++) {
            inverseMasses[i] = 1.0; // All mobile for now
        }

        // Initialize GPU state with collider data
        const stateConfig: GpuEngineStateConfig = {
            particleCount: this.vertexCount,
            initialPositions: garmentVerts,
            initialNormals: garmentNormals,
            inverseMasses,
            indices: garmentIndices,
            // Pass collider data to engine
            colliderPositions: colliderVerts,
            colliderNormals: colliderNormals,
            colliderIndices: colliderIndices,
            scaleFactor
        };

        await this.engine!.initialize(stateConfig);

        console.log(`[GpuAdapter] Body collider: ${colliderVerts.length / 3} vertices, ${colliderIndices.length / 3} triangles`);
        console.log(`[GpuAdapter] Initialized with ${this.vertexCount} vertices, scaleFactor=${scaleFactor}`);

        // Allocate CPU-side array for readback
        this.cpuPositions = new Float32Array(this.vertexCount * 3);

        // Create initial buffer attributes for Three.js
        this.cachedPositionAttribute = new THREE.BufferAttribute(
            new Float32Array(garmentVerts),
            3
        );
        this.cachedNormalAttribute = new THREE.BufferAttribute(
            new Float32Array(this.vertexCount * 3),
            3
        );

        console.log(`[GpuAdapter] Initialized with ${this.vertexCount} vertices`);

        // Debug: Check for duplicate vertices (unwelded mesh)
        const uniquePos = new Set();
        for (let i = 0; i < this.vertexCount; i++) {
            const x = garmentVerts[i * 3].toFixed(4);
            const y = garmentVerts[i * 3 + 1].toFixed(4);
            const z = garmentVerts[i * 3 + 2].toFixed(4);
            uniquePos.add(`${x},${y},${z}`);
        }
        console.log(`[GpuAdapter] Connectivity Check: ${uniquePos.size} unique positions out of ${this.vertexCount} vertices. Ratio: ${(uniquePos.size / this.vertexCount).toFixed(2)}`);
    }

    /**
     * Advances the simulation by dt seconds.
     */
    step(dt: number): void {
        if (!this.engine) {
            return;
        }

        // Debug: log dt on first few frames
        if (this.frameCount === undefined) {
            this.frameCount = 0;
        }
        if (this.frameCount < 60) {

        }
        this.frameCount++;

        // Run GPU simulation step
        this.engine.step(dt);

        // Schedule async readback for next frame
        if (!this.readbackPending) {
            this.scheduleReadback();
        }
    }

    private frameCount: number | undefined;

    /**
     * Returns the current vertex positions.
     */
    getPositions(): THREE.BufferAttribute | null {
        return this.cachedPositionAttribute;
    }

    /**
     * Returns the current vertex normals.
     */
    getNormals(): THREE.BufferAttribute | null {
        return this.cachedNormalAttribute;
    }

    /**
     * Disposes GPU resources.
     */
    dispose(): void {
        this.engine?.dispose();
        this.engine = null;
        this.cachedPositionAttribute = null;
        this.cachedNormalAttribute = null;
        this.cpuPositions = null;
        console.log('[GpuAdapter] Disposed');
    }

    // --- Interaction Methods ---

    /**
     * Begins a user interaction.
     */
    startInteraction(index: number, x: number, y: number, z: number): void {
        // TODO: Implement GPU-side mouse constraint
        console.log(`[GpuAdapter] startInteraction: ${index} at (${x}, ${y}, ${z})`);
    }

    /**
     * Updates the interaction target.
     */
    updateInteraction(x: number, y: number, z: number): void {
        // TODO: Update GPU-side mouse constraint
        console.log(`[GpuAdapter] updateInteraction: (${x}, ${y}, ${z})`);
    }

    /**
     * Ends the current interaction.
     */
    endInteraction(): void {
        // TODO: Clear GPU-side mouse constraint
        console.log('[GpuAdapter] endInteraction');
    }

    // --- Private Methods ---

    /**
     * Schedules an async readback of GPU data.
     */
    private async scheduleReadback(): Promise<void> {
        if (!this.engine || !this.cpuPositions) {
            return;
        }

        this.readbackPending = true;

        try {
            // Read positions from GPU
            const positions4 = await this.engine.readPositions();

            // Debug: Track position of first particle
            if (this.lastY === undefined) {
                this.lastY = positions4[1]; // Y of first particle
            }
            const currentY = positions4[1];
            const delta = currentY - this.lastY;
            if (Math.abs(delta) > 0.0001) {
                console.log(`[GpuAdapter] Particle[0].y changed: ${this.lastY.toFixed(4)} -> ${currentY.toFixed(4)} (delta=${delta.toFixed(6)})`);
                this.lastY = currentY;
            }

            // Convert vec4 to vec3 for Three.js
            for (let i = 0; i < this.vertexCount; i++) {
                this.cpuPositions[i * 3 + 0] = positions4[i * 4 + 0];
                this.cpuPositions[i * 3 + 1] = positions4[i * 4 + 1];
                this.cpuPositions[i * 3 + 2] = positions4[i * 4 + 2];
            }

            // Update Three.js buffer
            if (this.cachedPositionAttribute) {
                this.cachedPositionAttribute.array.set(this.cpuPositions);
                this.cachedPositionAttribute.needsUpdate = true;
            }
        } catch (error) {
            console.error('[GpuAdapter] Readback failed:', error);
        } finally {
            this.readbackPending = false;
        }
    }

    private lastY: number | undefined;
}
