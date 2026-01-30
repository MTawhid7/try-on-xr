// src/core/interfaces/IPhysicsEngine.ts
/**
 * The contract for the Physics Engine Adapter.
 * This interface decouples the React application from the specific WASM implementation.
 */
export interface IPhysicsEngine {
    /**
     * Initializes the physics engine with the necessary geometry data.
     */
    init(
        garmentVerts: Float32Array,
        garmentIndices: Uint32Array,
        garmentUVs: Float32Array,
        colliderVerts: Float32Array,
        colliderNormals: Float32Array,
        colliderIndices: Uint32Array,
        scaleFactor: number
    ): Promise<void>;

    /**
     * Advances the simulation by a specific time step.
     * @param dt - Delta time in seconds.
     */
    step(dt: number): void;

    /**
     * Returns a view into the memory buffer representing the current vertex positions.
     *
     * NOTE: The return type is flexible (any) to allow implementations to return
     * optimized rendering objects (like THREE.InterleavedBufferAttribute)
     * instead of raw Float32Arrays, avoiding garbage collection overhead.
     */
    getPositions(): any;

    /**
     * Frees any unmanaged resources (e.g., WASM memory).
     */
    dispose(): void;

    // --- Interaction Methods ---

    /**
     * strict: Begins a user interaction (drag) at a specific vertex index.
     * @param index - The index of the vertex being grabbed.
     * @param x - The x coordinate of the drag content.
     * @param y - The y coordinate of the drag content.
     * @param z - The z coordinate of the drag content.
     */
    startInteraction(index: number, x: number, y: number, z: number): void;

    /**
     * Updates the current interaction target position.
     * @param x - New target x position.
     * @param y - New target y position.
     * @param z - New target z position.
     */
    updateInteraction(x: number, y: number, z: number): void;

    /**
     * Ends the current user interaction, releasing the grabbed vertex.
     */
    endInteraction(): void;
}