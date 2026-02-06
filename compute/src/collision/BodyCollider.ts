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
        console.log(`[BodyCollider] Initializing. Pos: ${positions.length}, Ind: ${indices.length}, Margin: ${margin}`);
        if (positions.length > 0) {
            console.log(`[BodyCollider] P[0]: ${positions[0]}, ${positions[1]}, ${positions[2]}`);
        }
        this.margin = margin;
        this.triangleCount = indices.length / 3;

        // Build triangle data array
        const tempTriangleData: number[] = [];
        const keptIndices: number[] = [];
        let validTriangleCount = 0;

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

            // Check for degeneracy (Area / Edge length)
            const e1x = v1x - v0x;
            const e1y = v1y - v0y;
            const e1z = v1z - v0z;

            const e2x = v2x - v0x;
            const e2y = v2y - v0y;
            const e2z = v2z - v0z;

            // Cross product usually gives normal * 2*area
            const cx = e1y * e2z - e1z * e2y;
            const cy = e1z * e2x - e1x * e2z;
            const cz = e1x * e2y - e1y * e2x;

            const lenSq = cx * cx + cy * cy + cz * cz;

            // Threshold: 1e-12 corresponds to very tiny area
            if (lenSq < 1e-12) {
                console.warn(`[BodyCollider] Skipping degenerate triangle ${i}`);
                continue;
            }

            // Normal Normalization
            const len = Math.sqrt(lenSq);
            // Use face normal for flat triangles to ensure consistency
            const nnx = cx / len;
            const nny = cy / len;
            const nnz = cz / len;

            // Helper to push float
            tempTriangleData.push(
                v0x, v0y, v0z, margin,
                v1x, v1y, v1z, 0,
                v2x, v2y, v2z, 0,
                nnx, nny, nnz, 0
            );

            keptIndices.push(i0, i1, i2);
            validTriangleCount++;
        }

        this.triangleCount = validTriangleCount;
        const triangleData = new Float32Array(tempTriangleData);
        // We must update indices for spatial hash to use the NEW compacted/filtered list?
        // Actually, the spatial hash loop below uses 'indices' which is the ORIGINAL list.
        // We need to use 'keptIndices'.
        const usedIndices = new Uint32Array(keptIndices);

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

        // --- Generate Spatial Hash (Uniform Grid) ---
        // 1. Compute AABB
        let minX = Infinity, minY = Infinity, minZ = Infinity;
        let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;

        // Use valid vertices only
        // Note: positions array is huge/original, but we only care about vertices ref'd by valid triangles.
        // Actually, for AABB, iterating all vertices is fine, or we can iterate keptIndices.
        // Iterating all positions is safer/simpler for AABB.
        for (let i = 0; i < positions.length; i += 3) {
            const x = positions[i];
            const y = positions[i + 1];
            const z = positions[i + 2];
            minX = Math.min(minX, x); minY = Math.min(minY, y); minZ = Math.min(minZ, z);
            maxX = Math.max(maxX, x); maxY = Math.max(maxY, y); maxZ = Math.max(maxZ, z);
        }

        // Add margin to bounds
        const boundsMargin = 0.1;
        this.gridBounds = {
            min: [minX - boundsMargin, minY - boundsMargin, minZ - boundsMargin],
            max: [maxX + boundsMargin, maxY + boundsMargin, maxZ + boundsMargin]
        };

        // 2. Define Grid Params
        // Cell size needs to be large enough to contain triangles, but small enough to prune.
        // A standard edge length in the mesh might be 1-5cm. Let's pick 5cm (0.05).
        this.gridCellSize = 0.05; // 5cm for better granularity

        const gridDimX = Math.ceil((this.gridBounds.max[0] - this.gridBounds.min[0]) / this.gridCellSize);
        const gridDimY = Math.ceil((this.gridBounds.max[1] - this.gridBounds.min[1]) / this.gridCellSize);
        const gridDimZ = Math.ceil((this.gridBounds.max[2] - this.gridBounds.min[2]) / this.gridCellSize);

        this.gridDimensions = [gridDimX, gridDimY, gridDimZ];
        const totalCells = gridDimX * gridDimY * gridDimZ;

        console.log(`[BodyCollider] Spatial Hash: ${gridDimX}x${gridDimY}x${gridDimZ} cells (${totalCells}), Bounds: [${this.gridBounds.min}] to [${this.gridBounds.max}]`);

        if (totalCells > 2000000) {
            console.warn('[BodyCollider] Spatial Hash grid is too large! Check bounds/cell size.');
            // Fallback or clamp needed? For now we proceed but warn.
        }

        // 3. Bucket Triangles
        // We will store a list of triangle indices for each cell.
        // Since a triangle can span multiple cells, we add it to all cells it touches (AABB approximation).

        const cells: number[][] = new Array(totalCells).fill(0).map(() => []);

        // Iterate ONLY the valid triangles
        for (let i = 0; i < this.triangleCount; i++) {
            const i0 = usedIndices[i * 3 + 0];
            const i1 = usedIndices[i * 3 + 1];
            const i2 = usedIndices[i * 3 + 2];

            // Triangle AABB
            const tMinX = Math.min(positions[i0 * 3], positions[i1 * 3], positions[i2 * 3]);
            const tMaxX = Math.max(positions[i0 * 3], positions[i1 * 3], positions[i2 * 3]);
            const tMinY = Math.min(positions[i0 * 3 + 1], positions[i1 * 3 + 1], positions[i2 * 3 + 1]);
            const tMaxY = Math.max(positions[i0 * 3 + 1], positions[i1 * 3 + 1], positions[i2 * 3 + 1]);
            const tMinZ = Math.min(positions[i0 * 3 + 2], positions[i1 * 3 + 2], positions[i2 * 3 + 2]);
            const tMaxZ = Math.max(positions[i0 * 3 + 2], positions[i1 * 3 + 2], positions[i2 * 3 + 2]);

            // Convert range to Cell Coordinates
            const startX = Math.floor((tMinX - this.gridBounds.min[0]) / this.gridCellSize);
            const endX = Math.floor((tMaxX - this.gridBounds.min[0]) / this.gridCellSize);
            const startY = Math.floor((tMinY - this.gridBounds.min[1]) / this.gridCellSize);
            const endY = Math.floor((tMaxY - this.gridBounds.min[1]) / this.gridCellSize);
            const startZ = Math.floor((tMinZ - this.gridBounds.min[2]) / this.gridCellSize);
            const endZ = Math.floor((tMaxZ - this.gridBounds.min[2]) / this.gridCellSize);

            // Clamp to grid
            const cStartX = Math.max(0, Math.min(gridDimX - 1, startX));
            const cEndX = Math.max(0, Math.min(gridDimX - 1, endX));
            const cStartY = Math.max(0, Math.min(gridDimY - 1, startY));
            const cEndY = Math.max(0, Math.min(gridDimY - 1, endY));
            const cStartZ = Math.max(0, Math.min(gridDimZ - 1, startZ));
            const cEndZ = Math.max(0, Math.min(gridDimZ - 1, endZ));

            for (let z = cStartZ; z <= cEndZ; z++) {
                for (let y = cStartY; y <= cEndY; y++) {
                    for (let x = cStartX; x <= cEndX; x++) {
                        const cellIndex = x + y * gridDimX + z * gridDimX * gridDimY;
                        cells[cellIndex].push(i);
                    }
                }
            }
        }

        // 4. Flatten Grid
        // Structure:
        // gridBuffer: [offset (u32), count (u32)] for each cell
        // triangleRefBuffer: [triangleIndex (u32)] packed

        const gridData = new Uint32Array(totalCells * 4); // Use padded vec4u logic? Or just 2 u32?
        // Alignment: Storage buffers prefer 16-byte alignment or similar. Let's use 2 u32s (offset, count).
        // But for random access in WGSL, array<vec2u> is fine (8 bytes).
        // However, standard WGSL struct alignment is often 16 bytes. Let's be safe and use 4 u32s (offset, count, padding, padding).

        const refs: number[] = [];

        let maxTrianglesPerCell = 0;
        let emptyCells = 0;

        for (let i = 0; i < totalCells; i++) {
            const count = cells[i].length;
            const offset = refs.length;

            gridData[i * 4 + 0] = offset;
            gridData[i * 4 + 1] = count;
            gridData[i * 4 + 2] = 0; // padding
            gridData[i * 4 + 3] = 0; // padding

            for (const triIndex of cells[i]) {
                refs.push(triIndex);
            }

            if (count > maxTrianglesPerCell) maxTrianglesPerCell = count;
            if (count === 0) emptyCells++;
        }

        console.log(`[BodyCollider] Grid Stats: Max Tri/Cell = ${maxTrianglesPerCell}, Empty Cells = ${emptyCells}/${totalCells}, Total Refs = ${refs.length}`);

        // Upload Grid Buffer
        this.gridBuffer = this.device.createBuffer({
            label: 'spatial_hash_grid',
            size: gridData.byteLength,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
            mappedAtCreation: true
        });
        new Uint32Array(this.gridBuffer.getMappedRange()).set(gridData);
        this.gridBuffer.unmap();

        // Upload Refs Buffer
        const refData = new Uint32Array(refs);
        this.triangleRefBuffer = this.device.createBuffer({
            label: 'spatial_hash_refs',
            size: Math.max(4, refData.byteLength), // Minimum size
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
            mappedAtCreation: true
        });
        new Uint32Array(this.triangleRefBuffer.getMappedRange()).set(refData);
        this.triangleRefBuffer.unmap();

        // Upload Grid Params Uniform
        // struct GridParams { min: vec3f, cellSize: f32, dim: vec3u, padding: u32 }
        const paramsData = new Float32Array(8); // 32 bytes
        paramsData[0] = this.gridBounds.min[0];
        paramsData[1] = this.gridBounds.min[1];
        paramsData[2] = this.gridBounds.min[2];
        paramsData[3] = this.gridCellSize;
        // Reinterpret for u32 dims
        const paramsDataU32 = new Uint32Array(paramsData.buffer);
        paramsDataU32[4] = this.gridDimensions[0];
        paramsDataU32[5] = this.gridDimensions[1];
        paramsDataU32[6] = this.gridDimensions[2];
        paramsDataU32[7] = 0; // padding

        this.gridParamsBuffer = this.device.createBuffer({
            label: 'spatial_hash_params',
            size: paramsData.byteLength,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
            mappedAtCreation: true
        });
        new Float32Array(this.gridParamsBuffer.getMappedRange()).set(paramsData);
        this.gridParamsBuffer.unmap();

        console.log(`[BodyCollider] Initialized with ${this.triangleCount} triangles`);
    }

    // --- Spatial Hash Properties ---
    private gridBounds = { min: [0, 0, 0], max: [0, 0, 0] };
    private gridCellSize = 0.1;
    private gridDimensions = [0, 0, 0];

    private gridBuffer: GPUBuffer | null = null;       // [offset, count, pad, pad] per cell
    private triangleRefBuffer: GPUBuffer | null = null; // [triIndex, triIndex...] packed
    private gridParamsBuffer: GPUBuffer | null = null; // uniform params

    getGridBuffer(): GPUBuffer { return this.gridBuffer!; }
    getTriangleRefBuffer(): GPUBuffer { return this.triangleRefBuffer!; }
    getGridParamsBuffer(): GPUBuffer { return this.gridParamsBuffer!; }

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
        this.gridBuffer?.destroy();
        this.triangleRefBuffer?.destroy();
        this.gridParamsBuffer?.destroy();

        this.triangleBuffer = null;
        this.triangleCountBuffer = null;
        this.gridBuffer = null;
        this.triangleRefBuffer = null;
        this.gridParamsBuffer = null;
        this.triangleCount = 0;
        console.log('[BodyCollider] Disposed');
    }
}
