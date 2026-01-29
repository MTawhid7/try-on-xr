// src/infrastructure/physics/adapter/WasmAdapter.ts

import * as THREE from 'three';
import { init, PhysicsEngine, type InitOutput } from '../wasm';
import type { IPhysicsEngine } from '../../../core/interfaces/IPhysicsEngine';
import {
    COLLIDER_INFLATION,
    COLLIDER_SMOOTHING_ITERATIONS
} from '../../../core/constants/SimulationConstants';

export class WasmAdapter implements IPhysicsEngine {
    private engine: PhysicsEngine | null = null;
    private wasmMemory: WebAssembly.Memory | null = null;

    // CACHE: Store the attribute to avoid GC pressure
    private cachedPositionAttribute: THREE.InterleavedBufferAttribute | null = null;
    private vertexCount: number = 0;

    async init(
        garmentVerts: Float32Array,
        garmentIndices: Uint32Array,
        garmentUVs: Float32Array,
        colliderVerts: Float32Array,
        colliderNormals: Float32Array,
        colliderIndices: Uint32Array,
        scaleFactor: number
    ): Promise<void> {
        const wasm: InitOutput = await init();
        this.wasmMemory = wasm.memory;

        this.engine = new PhysicsEngine(
            garmentVerts,
            garmentIndices,
            garmentUVs,
            colliderVerts,
            colliderNormals,
            colliderIndices,
            COLLIDER_SMOOTHING_ITERATIONS,
            COLLIDER_INFLATION,
            scaleFactor
        );

        this.vertexCount = garmentVerts.length / 3;

        // Reset cache on init
        this.cachedPositionAttribute = null;

        console.log(`[WasmAdapter] Initialized. Vertices: ${this.vertexCount} (Aligned Vec4)`);
    }

    step(dt: number): void {
        if (!this.engine) return;
        this.engine.step(dt);
    }

    getPositions(): THREE.BufferAttribute | THREE.InterleavedBufferAttribute {
        if (!this.engine || !this.wasmMemory) {
            throw new Error("Engine not initialized");
        }

        const ptr = this.engine.get_positions_ptr();

        // OPTIMIZATION: Check if we have a valid cached attribute
        if (this.cachedPositionAttribute) {
            const currentBuffer = this.cachedPositionAttribute.data.array.buffer;

            // Check if WASM memory has resized (detached buffer)
            if (currentBuffer.byteLength > 0) {
                // The buffer is still valid.
                // Since it is a view into WASM memory, the data is already updated.
                // We just need to flag it for upload to GPU.
                this.cachedPositionAttribute.data.needsUpdate = true;
                return this.cachedPositionAttribute;
            } else {
                console.warn("[WasmAdapter] WASM Memory resized. Recreating views.");
            }
        }

        // If we are here, either it's the first frame OR memory resized.
        // We must create a new view.

        // 1. Create view into WASM memory (Zero-Copy)
        const rawArray = new Float32Array(
            this.wasmMemory.buffer,
            ptr,
            this.vertexCount * 4
        );

        // 2. Create InterleavedBuffer (Stride = 4)
        const interleaved = new THREE.InterleavedBuffer(rawArray, 4);

        // 3. Create Attribute and Cache it
        this.cachedPositionAttribute = new THREE.InterleavedBufferAttribute(interleaved, 3, 0);

        return this.cachedPositionAttribute;
    }

    dispose(): void {
        if (this.engine) {
            this.engine.free();
            this.engine = null;
            this.wasmMemory = null;
            this.cachedPositionAttribute = null;
        }
    }

    startInteraction(index: number, x: number, y: number, z: number): void {
        this.engine?.set_interaction(index, x, y, z);
    }

    updateInteraction(x: number, y: number, z: number): void {
        this.engine?.update_interaction(x, y, z);
    }

    endInteraction(): void {
        this.engine?.end_interaction();
    }
}