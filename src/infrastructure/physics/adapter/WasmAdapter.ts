// src/infrastructure/physics/adapter/WasmAdapter.ts

import { init, PhysicsEngine, type InitOutput } from '../wasm';
import type { IPhysicsEngine } from '../../../core/interfaces/IPhysicsEngine';
import {
    COLLIDER_INFLATION,
    COLLIDER_SMOOTHING_ITERATIONS
} from '../../../core/constants/SimulationConstants';

export class WasmAdapter implements IPhysicsEngine {
    private engine: PhysicsEngine | null = null;
    private wasmMemory: WebAssembly.Memory | null = null;
    private positionView: Float32Array | null = null;
    private vertexCount: number = 0;

    /**
     * Initializes the WASM module and the Physics Engine instance.
     */
    async init(
        garmentVerts: Float32Array,
        garmentIndices: Uint32Array,
        garmentUVs: Float32Array,
        colliderVerts: Float32Array,
        colliderNormals: Float32Array,
        colliderIndices: Uint32Array,
        scaleFactor: number
    ): Promise<void> {
        // 1. Initialize the WASM binary
        const wasm: InitOutput = await init();
        this.wasmMemory = wasm.memory;

        // 2. Instantiate the Physics Engine
        // We pass the configuration constants here, ensuring the Rust side
        // uses the same tuning values as the TS side.
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
        console.log(`[WasmAdapter] Initialized. Vertices: ${this.vertexCount}, Scale Factor: ${scaleFactor.toFixed(3)}`);
    }

    step(dt: number): void {
        if (!this.engine) return;
        this.engine.step(dt);
    }

    getPositions(): Float32Array {
        if (!this.engine || !this.wasmMemory) {
            throw new Error("Engine not initialized");
        }

        // Zero-Copy Access:
        // 1. Get the memory address (pointer) from Rust
        const ptr = this.engine.get_positions_ptr();

        // 2. Create a view into the WASM memory buffer.
        // CRITICAL: We recreate this view every frame because if WASM memory grows
        // (reallocates), the old buffer becomes "detached" and invalid.
        this.positionView = new Float32Array(
            this.wasmMemory.buffer,
            ptr,
            this.vertexCount * 3
        );

        return this.positionView;
    }

    dispose(): void {
        if (this.engine) {
            this.engine.free(); // Explicitly free Rust memory
            this.engine = null;
            this.wasmMemory = null;
            this.positionView = null;
        }
    }

    // --- Interaction Methods ---

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