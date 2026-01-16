// src/adapters/types.ts
export interface ISimulationEngine {
    /**
     * Initialize the physics engine with mesh data.
     * @param garmentVerts Flat array of garment vertex positions [x, y, z, ...]
     * @param garmentIndices Flat array of garment triangle indices [i0, i1, i2, ...]
     * @param colliderVerts Flat array of mannequin vertex positions
     * @param colliderNormals Flat array of mannequin vertex normals (for smooth collision)
     * @param colliderIndices Flat array of mannequin triangle indices
     */
    init(
        garmentVerts: Float32Array,
        garmentIndices: Uint32Array,
        colliderVerts: Float32Array,
        colliderNormals: Float32Array,
        colliderIndices: Uint32Array
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