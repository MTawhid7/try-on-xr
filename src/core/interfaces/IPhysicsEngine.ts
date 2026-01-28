// src/core/interfaces/IPhysicsEngine.ts
/**
 * The contract for the Physics Engine Adapter.
 * This interface decouples the React application from the specific WASM implementation.
 */
export interface IPhysicsEngine {
    /**
     * Initializes the physics engine with the necessary geometry data.
     *
     * @param garmentVerts - Flattened vertex positions of the cloth [x,y,z...]
     * @param garmentIndices - Triangle indices of the cloth
     * @param garmentUVs - Flattened UV coordinates [u,v...] (Required for Anisotropy)
     * @param colliderVerts - Flattened vertex positions of the body collider
     * @param colliderNormals - Flattened normals of the body collider
     * @param colliderIndices - Triangle indices of the body collider
     * @param scaleFactor - The sizing scale factor (e.g., 1.0 for M, 1.1 for L) used to tune stiffness
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
     * WARNING: This view is typically Zero-Copy (a direct view into WASM memory).
     * It may become invalid if the underlying memory is resized.
     * Consumers should not hold references to this array across frames.
     */
    getPositions(): Float32Array;

    /**
     * Frees any unmanaged resources (e.g., WASM memory).
     */
    dispose(): void;

    // --- Interaction Methods ---

    /**
     * Initiates a grab interaction on a specific particle.
     * @param index - The index of the vertex being grabbed.
     * @param x - World X coordinate.
     * @param y - World Y coordinate.
     * @param z - World Z coordinate.
     */
    startInteraction(index: number, x: number, y: number, z: number): void;

    /**
     * Updates the target position of the currently grabbed particle.
     */
    updateInteraction(x: number, y: number, z: number): void;

    /**
     * Releases the currently grabbed particle.
     */
    endInteraction(): void;
}