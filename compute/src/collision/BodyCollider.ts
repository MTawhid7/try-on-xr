// compute/src/collision/BodyCollider.ts
/**
 * @fileoverview Static body collider management for GPU collision.
 *
 * Manages the upload and storage of static collider geometry (mannequin)
 * for GPU-based collision detection.
 */

/**
 * Configuration for body collider initialization.
 */
export interface BodyColliderConfig {
    /** Vertex positions (flat array: x, y, z, ...). */
    readonly positions: Float32Array;
    /** Vertex normals (flat array: nx, ny, nz, ...). */
    readonly normals: Float32Array;
    /** Triangle indices. */
    readonly indices: Uint32Array;
    /** Collision margin/inflation. */
    readonly margin: number;
}

/**
 * Triangle data for GPU collision (packed struct).
 */
export interface TriangleData {
    /** Vertices of the triangle. */
    v0: [number, number, number];
    v1: [number, number, number];
    v2: [number, number, number];
    /** Pre-computed normal. */
    normal: [number, number, number];
}

/**
 * Manages static body collider data for GPU collision detection.
 *
 * The collider data is uploaded once and remains static during simulation.
 * Each triangle is packed into a GPU-friendly format with pre-computed normals.
 */
export class BodyCollider {
    private device: GPUDevice;
    private triangleCount: number = 0;
    private margin: number = 0;

    // GPU Buffers
    private triangleBuffer: GPUBuffer | null = null;
    private triangleCountBuffer: GPUBuffer | null = null;

    /**
     * Creates a new BodyCollider.
     *
     * @param device - GPU device for buffer creation.
     */
    constructor(device: GPUDevice) {
        this.device = device;
    }

    /**
     * Initializes the collider with geometry data.
     *
     * @param config - Collider configuration.
     */
    initialize(config: BodyColliderConfig): void {
        const { positions, normals, indices, margin } = config;
        this.margin = margin;
        this.triangleCount = indices.length / 3;

        // Build triangle data array
        // Each triangle: v0 (vec4), v1 (vec4), v2 (vec4), normal (vec4) = 64 bytes
        const triangleData = new Float32Array(this.triangleCount * 16);

        for (let i = 0; i < this.triangleCount; i++) {
            const i0 = indices[i * 3 + 0];
            const i1 = indices[i * 3 + 1];
            const i2 = indices[i * 3 + 2];

            // Vertex positions
            const v0x = positions[i0 * 3 + 0];
            const v0y = positions[i0 * 3 + 1];
            const v0z = positions[i0 * 3 + 2];

            const v1x = positions[i1 * 3 + 0];
            const v1y = positions[i1 * 3 + 1];
            const v1z = positions[i1 * 3 + 2];

            const v2x = positions[i2 * 3 + 0];
            const v2y = positions[i2 * 3 + 1];
            const v2z = positions[i2 * 3 + 2];

            // Average normal from vertices
            const nx = (normals[i0 * 3 + 0] + normals[i1 * 3 + 0] + normals[i2 * 3 + 0]) / 3;
            const ny = (normals[i0 * 3 + 1] + normals[i1 * 3 + 1] + normals[i2 * 3 + 1]) / 3;
            const nz = (normals[i0 * 3 + 2] + normals[i1 * 3 + 2] + normals[i2 * 3 + 2]) / 3;

            // Normalize
            const len = Math.sqrt(nx * nx + ny * ny + nz * nz);
            const nnx = len > 0 ? nx / len : 0;
            const nny = len > 0 ? ny / len : 0;
            const nnz = len > 0 ? nz / len : 1;

            // Pack into buffer: v0.xyz, margin, v1.xyz, 0, v2.xyz, 0, n.xyz, 0
            const offset = i * 16;
            triangleData[offset + 0] = v0x;
            triangleData[offset + 1] = v0y;
            triangleData[offset + 2] = v0z;
            triangleData[offset + 3] = margin;

            triangleData[offset + 4] = v1x;
            triangleData[offset + 5] = v1y;
            triangleData[offset + 6] = v1z;
            triangleData[offset + 7] = 0;

            triangleData[offset + 8] = v2x;
            triangleData[offset + 9] = v2y;
            triangleData[offset + 10] = v2z;
            triangleData[offset + 11] = 0;

            triangleData[offset + 12] = nnx;
            triangleData[offset + 13] = nny;
            triangleData[offset + 14] = nnz;
            triangleData[offset + 15] = 0;
        }

        // Create triangle buffer
        this.triangleBuffer = this.device.createBuffer({
            label: 'body_triangles',
            size: triangleData.byteLength,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
            mappedAtCreation: true
        });
        new Float32Array(this.triangleBuffer.getMappedRange()).set(triangleData);
        this.triangleBuffer.unmap();

        // Create count buffer
        const countData = new Uint32Array([this.triangleCount]);
        this.triangleCountBuffer = this.device.createBuffer({
            label: 'body_triangle_count',
            size: 4,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
            mappedAtCreation: true
        });
        new Uint32Array(this.triangleCountBuffer.getMappedRange()).set(countData);
        this.triangleCountBuffer.unmap();

        console.log(`[BodyCollider] Initialized with ${this.triangleCount} triangles`);
    }

    /**
     * Gets the triangle buffer for binding.
     */
    getTriangleBuffer(): GPUBuffer {
        if (!this.triangleBuffer) {
            throw new Error('[BodyCollider] Not initialized');
        }
        return this.triangleBuffer;
    }

    /**
     * Gets the triangle count buffer for binding.
     */
    getTriangleCountBuffer(): GPUBuffer {
        if (!this.triangleCountBuffer) {
            throw new Error('[BodyCollider] Not initialized');
        }
        return this.triangleCountBuffer;
    }

    /**
     * Gets the number of triangles.
     */
    getTriangleCount(): number {
        return this.triangleCount;
    }

    /**
     * Gets the collision margin.
     */
    getMargin(): number {
        return this.margin;
    }

    /**
     * Disposes GPU resources.
     */
    dispose(): void {
        this.triangleBuffer?.destroy();
        this.triangleCountBuffer?.destroy();
        this.triangleBuffer = null;
        this.triangleCountBuffer = null;
        this.triangleCount = 0;
        console.log('[BodyCollider] Disposed');
    }
}
