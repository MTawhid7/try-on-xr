// src/core/interfaces/IPhysicsEngine.ts
/**
 * @fileoverview Physics engine interface contract.
 *
 * This interface decouples the React application from specific physics
 * implementations (WASM/CPU or WebGPU). All adapters must implement this
 * contract to ensure consistent behavior across backends.
 */

/**
 * Available physics backend types.
 */
export type PhysicsBackend = 'wasm' | 'webgpu';

/**
 * The contract for Physics Engine Adapters.
 *
 * Implementations include:
 * - `WasmAdapter`: CPU-based simulation via Rust/WASM
 * - `GpuAdapter`: GPU-accelerated simulation via WebGPU (Phase 4)
 */
export interface IPhysicsEngine {
    /**
     * Identifies the backend implementation.
     * Used for capability checks and debugging.
     */
    readonly backend: PhysicsBackend;

    /**
     * Initializes the physics engine with the necessary geometry data.
     *
     * @param garmentVerts - Flat array of garment vertex positions [x,y,z,...].
     * @param garmentIndices - Triangle indices for the garment mesh.
     * @param garmentUVs - UV coordinates for anisotropic material properties.
     * @param colliderVerts - Flat array of collider vertex positions.
     * @param colliderNormals - Flat array of collider vertex normals.
     * @param colliderIndices - Triangle indices for the collider mesh.
     * @param scaleFactor - Scale factor for unit conversion.
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
     * Returns a view into the memory buffer representing the computed vertex normals.
     * Normals are computed after physics step for performance.
     */
    getNormals(): any;

    /**
     * Frees any unmanaged resources (e.g., WASM memory, GPU buffers).
     */
    dispose(): void;

    // --- Interaction Methods ---

    /**
     * Begins a user interaction (drag) at a specific vertex index.
     * @param index - The index of the vertex being grabbed.
     * @param x - The x coordinate of the drag target.
     * @param y - The y coordinate of the drag target.
     * @param z - The z coordinate of the drag target.
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