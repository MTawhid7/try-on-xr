// src/adapters/types.ts
export interface ISimulationEngine {
    init(
        garmentVerts: Float32Array,
        garmentIndices: Uint32Array,
        garmentUVs: Float32Array,
        colliderVerts: Float32Array,
        colliderNormals: Float32Array,
        colliderIndices: Uint32Array,
        scaleFactor: number // NEW
    ): Promise<void>;

    /**
     * Advance the simulation by dt seconds.
     */
    step(dt: number): void;

    /**
     * Returns a view into the WASM memory representing the current vertex positions.
     * NOTE: This view is zero-copy and valid only until the next WASM memory allocation.
     */
    getPositions(): Float32Array;

    /**
     * Clean up WASM resources.
     */
    dispose(): void;

    startInteraction(index: number, x: number, y: number, z: number): void;
    updateInteraction(x: number, y: number, z: number): void;
    endInteraction(): void;
}