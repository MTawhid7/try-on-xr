// src/adapters/WasmAdapter.ts
import init, { PhysicsEngine, type InitOutput } from '../physics-pkg/garment_physics';
import type { ISimulationEngine } from './types';

export class WasmAdapter implements ISimulationEngine {
    private engine: PhysicsEngine | null = null;
    private wasmMemory: WebAssembly.Memory | null = null;
    private positionView: Float32Array | null = null;
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
            0,     // collider_smoothing (Disabled for accuracy)
            0.002, // collider_inflation (2mm Buffer - The Goldilocks Value)
            scaleFactor
        );

        this.vertexCount = garmentVerts.length / 3;
        console.log(`[WasmAdapter] Initialized with Scale Factor: ${scaleFactor.toFixed(3)}`);
    }

    step(dt: number): void {
        if (!this.engine) return;
        this.engine.step(dt);
    }

    getPositions(): Float32Array {
        if (!this.engine || !this.wasmMemory) {
            throw new Error("Engine not initialized");
        }

        // Zero-Copy Magic:
        // 1. Get the memory address (pointer) from Rust
        const ptr = this.engine.get_positions_ptr();

        // 2. Create a view into the WASM memory buffer
        // Note: We recreate this view every frame because if WASM memory grows (reallocates),
        // the old buffer becomes "detached" and invalid.
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