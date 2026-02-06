// compute/src/constraints/ConstraintGenerator.ts
/**
 * @fileoverview Generates constraints from mesh topology.
 *
 * Creates distance, bending, and tether constraints from mesh indices
 * for upload to GPU buffers.
 */

/**
 * Distance constraint data.
 */
export interface DistanceConstraintData {
    i0: number;
    i1: number;
    restLength: number;
    compliance: number;
}

/**
 * Bending constraint data (dihedral angle).
 */
export interface BendingConstraintData {
    i0: number;
    i1: number;
    i2: number;
    i3: number;
    restAngle: number;
    compliance: number;
}

/**
 * Tether constraint data.
 */
export interface TetherConstraintData {
    anchor: number;
    particle: number;
    maxDistance: number;
    compliance: number;
}

/**
 * Area constraint data.
 */
export interface AreaConstraintData {
    i0: number;
    i1: number;
    i2: number;
    restArea: number;
    compliance: number;
}

/**
 * Configuration for constraint generation.
 */
export interface ConstraintConfig {
    /** Distance constraint stiffness (lower = stiffer). */
    distanceCompliance: number;
    /** Bending constraint stiffness. */
    bendingCompliance: number;
    /** Tether constraint stiffness. */
    tetherCompliance: number;
    /** Area constraint stiffness. */
    areaCompliance: number;
}

const DEFAULT_CONFIG: ConstraintConfig = {
    distanceCompliance: 0.0001,
    bendingCompliance: 0.01,
    tetherCompliance: 0.0, // Rigid (matches Rust)
    areaCompliance: 0.0002 // Matches Rust 2.0e-4
};

/**
 * Generates constraints from mesh topology.
 */
export class ConstraintGenerator {
    /**
     * Generates bending constraints (dihedral angle) from mesh topology.
     *
     * @param positions - Vertex positions.
     * @param indices - Triangle indices.
     * @param config - Configuration (uses bendingCompliance).
     * @returns Array of constraint batches.
     */
    /**
     * Generates bending constraints (Cross-Edge Distance) from mesh topology.
     * Matches Rust implementation: creates a distance constraint between proper (wing) vertices of adjacent triangles.
     *
     * @param positions - Vertex positions.
     * @param indices - Triangle indices.
     * @param config - Configuration (uses bendingCompliance).
     * @returns Array of constraint batches (using DistanceConstraint structure).
     */
    static generateColoredBendingConstraints(
        positions: Float32Array,
        indices: Uint32Array,
        config: Partial<ConstraintConfig> = {}
    ): DistanceConstraintData[][] {
        const { bendingCompliance } = { ...DEFAULT_CONFIG, ...config };

        // 1. Find shared edges and adjacent triangles
        const edgeTriangles = new Map<string, number[]>();
        const numTriangles = indices.length / 3;

        for (let t = 0; t < numTriangles; t++) {
            const i0 = indices[t * 3 + 0];
            const i1 = indices[t * 3 + 1];
            const i2 = indices[t * 3 + 2];

            const registerEdge = (a: number, b: number) => {
                const key = a < b ? `${a}_${b}` : `${b}_${a}`;
                if (!edgeTriangles.has(key)) {
                    edgeTriangles.set(key, []);
                }
                edgeTriangles.get(key)!.push(t);
            };

            registerEdge(i0, i1);
            registerEdge(i1, i2);
            registerEdge(i2, i0);
        }

        const constraints: DistanceConstraintData[] = [];

        // Find max particle index for adjacency list
        let maxParticleIndex = 0;
        for (let i = 0; i < indices.length; i++) {
            if (indices[i] > maxParticleIndex) maxParticleIndex = indices[i];
        }
        const particleConstraints: number[][] = Array.from({ length: maxParticleIndex + 1 }, () => []);

        // 2. Build cross-edge constraints
        let constraintIndex = 0;
        for (const [key, tris] of edgeTriangles) {
            if (tris.length !== 2) continue; // Boundary or non-manifold

            const t0 = tris[0];
            const t1 = tris[1];

            const getVerts = (t: number) => [indices[t * 3 + 0], indices[t * 3 + 1], indices[t * 3 + 2]];
            const v0 = getVerts(t0);
            const v1 = getVerts(t1);

            const [e0, e1] = key.split('_').map(Number);

            // Wing vertices: the ones NOT on the shared edge
            const wing0 = v0.find(v => v !== e0 && v !== e1);
            const wing1 = v1.find(v => v !== e0 && v !== e1);

            if (wing0 === undefined || wing1 === undefined) {
                // Degenerate geometry (e.g. duplicate indices)
                continue;
            }

            // Distance Bending: constrain distance between wing0 and wing1
            const i0 = wing0;
            const i1 = wing1;

            // Calculate rest length
            const p0x = positions[i0 * 3 + 0];
            const p0y = positions[i0 * 3 + 1];
            const p0z = positions[i0 * 3 + 2];

            const p1x = positions[i1 * 3 + 0];
            const p1y = positions[i1 * 3 + 1];
            const p1z = positions[i1 * 3 + 2];

            const dx = p1x - p0x;
            const dy = p1y - p0y;
            const dz = p1z - p0z;
            const restLength = Math.sqrt(dx * dx + dy * dy + dz * dz);

            constraints.push({
                i0,
                i1,
                restLength,
                compliance: bendingCompliance
            });

            particleConstraints[i0].push(constraintIndex);
            particleConstraints[i1].push(constraintIndex);
            constraintIndex++;
        }

        // 3. Graph Coloring (Greedy)
        const constraintColors = new Int32Array(constraints.length).fill(-1);
        let maxColor = 0;

        for (let i = 0; i < constraints.length; i++) {
            const c = constraints[i];
            const usedColors = new Set<number>();

            const check = (p: number) => {
                for (const ni of particleConstraints[p]) {
                    if (ni === i) continue;
                    const col = constraintColors[ni];
                    if (col !== -1) usedColors.add(col);
                }
            };

            check(c.i0);
            check(c.i1);

            let color = 0;
            while (usedColors.has(color)) color++;
            constraintColors[i] = color;
            if (color > maxColor) maxColor = color;
        }

        // 4. Batch grouping
        const batches: DistanceConstraintData[][] = Array.from({ length: maxColor + 1 }, () => []);
        for (let i = 0; i < constraints.length; i++) {
            batches[constraintColors[i]].push(constraints[i]);
        }

        console.log(`[ConstraintGenerator] Partitioned ${constraints.length} bending constraints (Distance) into ${batches.length} batches`);
        return batches;
    }

    /**
     * Generates distance constraints from mesh edges.
     *
     * @param positions - Vertex positions (vec3).
     * @param indices - Triangle indices.
     * @param config - Constraint configuration.
     * @returns Array of distance constraints.
     */
    /**
     * Generates distance constraints from mesh edges, partitioned by color.
     * Constraints in the same batch (color) are guaranteed not to share particles.
     *
     * @param positions - Vertex positions (vec3).
     * @param indices - Triangle indices.
     * @param config - Constraint configuration.
     * @returns Array of constraint batches ( DistanceConstraintData[][] ).
     */
    static generateColoredDistanceConstraints(
        positions: Float32Array,
        indices: Uint32Array,
        config: Partial<ConstraintConfig> = {}
    ): DistanceConstraintData[][] {
        const { distanceCompliance } = { ...DEFAULT_CONFIG, ...config };

        // Collect unique edges
        const edgeSet = new Set<string>();
        const edges: [number, number][] = [];
        const numTriangles = indices.length / 3;

        for (let t = 0; t < numTriangles; t++) {
            const i0 = indices[t * 3 + 0];
            const i1 = indices[t * 3 + 1];
            const i2 = indices[t * 3 + 2];

            const addEdge = (a: number, b: number) => {
                const key = a < b ? `${a}_${b}` : `${b}_${a}`;
                if (!edgeSet.has(key)) {
                    edgeSet.add(key);
                    edges.push(a < b ? [a, b] : [b, a]);
                }
            };

            addEdge(i0, i1);
            addEdge(i1, i2);
            addEdge(i2, i0);
        }

        // --- Graph Coloring ---
        // 1. Build adjacency (particle -> edge indices)
        // We need to know which constraint indices are attached to each particle.
        // Since we are iterating edges, we can build this dynamically or ahead of time.
        // Using a Map for sparse particles, or array if indices are dense.
        // Assuming dense 0..N particle indices from the look of the mesh data.

        // Find max particle index to size the array
        let maxParticleIndex = 0;
        for (let i = 0; i < indices.length; i++) {
            if (indices[i] > maxParticleIndex) maxParticleIndex = indices[i];
        }

        // particleConstraints[p] = [edgeIndex1, edgeIndex2, ...]
        const particleConstraints: number[][] = Array.from({ length: maxParticleIndex + 1 }, () => []);

        const constraints: DistanceConstraintData[] = [];

        // Build constraints and adjacency list
        for (let i = 0; i < edges.length; i++) {
            const [i0, i1] = edges[i];

            if (!particleConstraints[i0] || !particleConstraints[i1]) {
                console.warn(`[ConstraintGenerator] Invalid edge indices: ${i0}, ${i1} (max: ${maxParticleIndex})`);
                continue;
            }

            particleConstraints[i0].push(i);
            particleConstraints[i1].push(i);

            // Compute rest length
            const p0x = positions[i0 * 3 + 0];
            const p0y = positions[i0 * 3 + 1];
            const p0z = positions[i0 * 3 + 2];

            const p1x = positions[i1 * 3 + 0];
            const p1y = positions[i1 * 3 + 1];
            const p1z = positions[i1 * 3 + 2];

            const dx = p1x - p0x;
            const dy = p1y - p0y;
            const dz = p1z - p0z;
            const restLength = Math.sqrt(dx * dx + dy * dy + dz * dz);

            constraints.push({
                i0,
                i1,
                restLength,
                compliance: distanceCompliance
            });
        }

        // 2. Greedy Coloring
        // assign color to each constraint such that no sharing neighbors have same color.
        const constraintColors = new Int32Array(constraints.length).fill(-1);
        let maxColor = 0;

        for (let i = 0; i < constraints.length; i++) {
            const c = constraints[i];

            // Find colors used by neighbors (constraints sharing i0 or i1)
            // We only care about neighbors that already have a color assigned (since we process in order)
            // Wait - if we assume static graph, "neighbor" is symmetric.
            // If I pick color 0, my future neighbor cannot pick color 0.
            // If I look at all neighbors, I can pick the lowest one not used by ANY neighbor (past or future).
            // But usually for greedy coloring, sequential is fine:
            // "Assign the smallest color not used by already-colored neighbors."
            // But wait, if neighbor J (index > I) is not colored yet, I ignore it.
            // Then when J is processed, it sees I have color 0, so it picks color 1.
            // This works.

            const usedColors = new Set<number>();
            const checkNeighbors = (particleIdx: number) => {
                const neighbors = particleConstraints[particleIdx];
                for (const ni of neighbors) {
                    if (ni === i) continue; // self
                    const neighborColor = constraintColors[ni];
                    if (neighborColor !== -1) {
                        usedColors.add(neighborColor);
                    }
                }
            };

            checkNeighbors(c.i0);
            checkNeighbors(c.i1);

            // Pick lowest unused color
            let color = 0;
            while (usedColors.has(color)) {
                color++;
            }

            constraintColors[i] = color;
            if (color > maxColor) maxColor = color;
        }

        // 3. Group by color
        const batches: DistanceConstraintData[][] = Array.from({ length: maxColor + 1 }, () => []);
        for (let i = 0; i < constraints.length; i++) {
            batches[constraintColors[i]].push(constraints[i]);
        }

        console.log(`[ConstraintGenerator] Partitioned ${constraints.length} constraints into ${batches.length} colors/batches`);
        return batches;
    }

    /**
     * Generates flattened distance constraints.
     * NOTE: This returns a single array, which is UNSAFE for parallel execution
     * without atomics if constraints share particles.
     */
    static generateDistanceConstraints(
        positions: Float32Array,
        indices: Uint32Array,
        config: Partial<ConstraintConfig> = {}
    ): DistanceConstraintData[] {
        const batches = this.generateColoredDistanceConstraints(positions, indices, config);
        return batches.flat();
    }

    /**
     * Packs distance constraints into a GPU buffer format.
     * Layout per constraint: i0 (u32), i1 (u32), rest_length (f32), compliance (f32)
     *
     * @param constraints - Distance constraint data.
     * @returns Packed buffer as Float32Array.
     */
    static packDistanceConstraints(constraints: DistanceConstraintData[]): Float32Array {
        // 4 floats per constraint (i0, i1, rest_length, compliance)
        const buffer = new Float32Array(constraints.length * 4);

        for (let i = 0; i < constraints.length; i++) {
            const c = constraints[i];
            const offset = i * 4;

            // Pack indices as floats (they'll be reinterpreted as u32 in shader)
            buffer[offset + 0] = c.i0;
            buffer[offset + 1] = c.i1;
            buffer[offset + 2] = c.restLength;
            buffer[offset + 3] = c.compliance;
        }

        return buffer;
    }

    /**
     * Creates a view as Uint32Array for the first two elements (indices).
     */
    static createConstraintBuffer(
        device: GPUDevice,
        constraints: DistanceConstraintData[],
        label: string = 'distance_constraints'
    ): { buffer: GPUBuffer; count: number } {
        // Layout: [i0: u32, i1: u32, rest_length: f32, compliance: f32]
        const byteSize = constraints.length * 16; // 4 * sizeof(u32/f32)
        const data = new ArrayBuffer(byteSize);
        const u32View = new Uint32Array(data);
        const f32View = new Float32Array(data);

        for (let i = 0; i < constraints.length; i++) {
            const c = constraints[i];
            const offset = i * 4;

            u32View[offset + 0] = c.i0;
            u32View[offset + 1] = c.i1;
            f32View[offset + 2] = c.restLength;
            f32View[offset + 3] = c.compliance;
        }

        const buffer = device.createBuffer({
            label,
            size: Math.max(byteSize, 16), // Minimum 16 bytes
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
        });

        device.queue.writeBuffer(buffer, 0, data);

        return { buffer, count: constraints.length };
    }

    /**
     * Creates a uniform buffer containing the constraint count.
     */
    static createCountBuffer(device: GPUDevice, count: number, label: string = 'constraint_count'): GPUBuffer {
        // Uniform buffers must be at least 16 bytes in WebGPU
        const buffer = device.createBuffer({
            label,
            size: 16,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
        });

        const data = new Uint32Array([count, 0, 0, 0]); // Pad to 16 bytes
        device.queue.writeBuffer(buffer, 0, data);

        return buffer;
    }

    /**
     * Creates Bending Constraint Buffer.
     * Layout: i0, i1, i2, i3 (u32), rest_angle, compliance, pad, pad (f32) -> 32 bytes
     */
    static createBendingConstraintBuffer(
        device: GPUDevice,
        constraints: BendingConstraintData[],
        label: string = 'bending_constraints'
    ): { buffer: GPUBuffer; count: number } {
        // 8 floats/uints per constraint (32 bytes)
        const byteSize = constraints.length * 32;
        const data = new ArrayBuffer(byteSize);
        const u32View = new Uint32Array(data);
        const f32View = new Float32Array(data);

        for (let i = 0; i < constraints.length; i++) {
            const c = constraints[i];
            const offset = i * 8;

            u32View[offset + 0] = c.i0;
            u32View[offset + 1] = c.i1;
            u32View[offset + 2] = c.i2;
            u32View[offset + 3] = c.i3;
            f32View[offset + 4] = c.restAngle;
            f32View[offset + 5] = c.compliance;
            f32View[offset + 6] = 0.0; // padding
            f32View[offset + 7] = 0.0; // padding
        }

        const buffer = device.createBuffer({
            label,
            size: Math.max(byteSize, 16),
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
        });

        device.queue.writeBuffer(buffer, 0, data);
        return { buffer, count: constraints.length };
    }

    /**
     * Generates Tether Constraints (Long Range Attachments).
     * Connects each particle to a "safe" anchor point (e.g. initial position) or distant neighbor.
     * Simple implementation: Connect to initial position with a max distance allowance.
     * This acts as a safety against infinite falling/stretching.
     */
    /**
     * Generates tether constraints (Vertical and Horizontal) to prevent excessive stretching.
     * Matches Rust implementation:
     * 1. Vertical: Buckets into (X,Z) columns, connects Top-Bottom.
     * 2. Horizontal: Buckets into Z rows, connects Left-Right.
     */
    static generateColoredTetherConstraints(
        positions: Float32Array,
        normals: Float32Array,
        config: Partial<ConstraintConfig> = {}
    ): TetherConstraintData[][] {
        const { tetherCompliance } = { ...DEFAULT_CONFIG, ...config };

        const constraints: TetherConstraintData[] = [];
        const count = positions.length / 3;

        // --- Vertical Tethers ---
        // Bucket into (X, Z) columns
        const cellSize = 0.03;
        const columns = new Map<string, number[]>();

        for (let i = 0; i < count; i++) {
            const x = positions[i * 3 + 0];
            const z = positions[i * 3 + 2];

            const cx = Math.floor(x / cellSize);
            const cz = Math.floor(z / cellSize);
            const key = `${cx}_${cz}`;

            if (!columns.has(key)) columns.set(key, []);
            columns.get(key)!.push(i);
        }

        for (const indices of columns.values()) {
            if (indices.length < 2) continue;

            // Sort by Y descending
            indices.sort((a, b) => positions[b * 3 + 1] - positions[a * 3 + 1]);

            const topIdx = indices[0];
            const topNx = normals[topIdx * 3 + 0];
            const topNy = normals[topIdx * 3 + 1];
            const topNz = normals[topIdx * 3 + 2];

            // Try connecting to bottom-most valid particle
            for (let k = indices.length - 1; k >= 0; k--) {
                const bottomIdx = indices[k];
                if (topIdx === bottomIdx) continue;

                const botNx = normals[bottomIdx * 3 + 0];
                const botNy = normals[bottomIdx * 3 + 1];
                const botNz = normals[bottomIdx * 3 + 2];

                // Check normal alignment (dot > 0.8)
                const dot = topNx * botNx + topNy * botNy + topNz * botNz;
                if (dot > 0.8) {
                    const dx = positions[topIdx * 3 + 0] - positions[bottomIdx * 3 + 0];
                    const dy = positions[topIdx * 3 + 1] - positions[bottomIdx * 3 + 1];
                    const dz = positions[topIdx * 3 + 2] - positions[bottomIdx * 3 + 2];
                    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

                    if (dist > 0.10) {
                        constraints.push({
                            anchor: topIdx,
                            particle: bottomIdx,
                            maxDistance: dist,
                            compliance: tetherCompliance
                        });
                        break; // Only one per column
                    }
                }
            }
        }

        // --- Horizontal Tethers ---
        // Filter shoulders, bucket into Z rows
        let maxY = -Infinity;
        for (let i = 0; i < count; i++) {
            if (positions[i * 3 + 1] > maxY) maxY = positions[i * 3 + 1];
        }
        const shoulderThreshold = maxY - 0.15;
        const zCellSize = 0.04;
        const rows = new Map<number, number[]>();

        for (let i = 0; i < count; i++) {
            const y = positions[i * 3 + 1];
            if (y < shoulderThreshold) {
                const z = positions[i * 3 + 2];
                const cz = Math.floor(z / zCellSize);
                if (!rows.has(cz)) rows.set(cz, []);
                rows.get(cz)!.push(i);
            }
        }

        for (const indices of rows.values()) {
            if (indices.length < 2) continue;

            // Sort by X
            indices.sort((a, b) => positions[a * 3 + 0] - positions[b * 3 + 0]);

            // Connect symmetric pairs
            const steps = Math.floor(indices.length / 2);
            for (let k = 0; k < steps; k++) {
                const left = indices[k];
                const right = indices[indices.length - 1 - k];

                const dx = positions[left * 3 + 0] - positions[right * 3 + 0];
                const dy = positions[left * 3 + 1] - positions[right * 3 + 1];
                const dz = positions[left * 3 + 2] - positions[right * 3 + 2];
                const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

                if (dist > 0.15) {
                    const n1x = normals[left * 3 + 0];
                    const n1y = normals[left * 3 + 1];
                    const n1z = normals[left * 3 + 2];

                    const n2x = normals[right * 3 + 0];
                    const n2y = normals[right * 3 + 1];
                    const n2z = normals[right * 3 + 2];

                    const dot = n1x * n2x + n1y * n2y + n1z * n2z;
                    if (dot > 0.5) {
                        constraints.push({
                            anchor: left,
                            particle: right,
                            maxDistance: dist,
                            compliance: tetherCompliance
                        });
                    }
                }
            }
        }

        // --- Graph Coloring ---
        const particleConstraints: number[][] = Array.from({ length: count }, () => []);
        for (let i = 0; i < constraints.length; i++) {
            particleConstraints[constraints[i].anchor].push(i);
            particleConstraints[constraints[i].particle].push(i);
        }

        const constraintColors = new Int32Array(constraints.length).fill(-1);
        let maxColor = 0;

        for (let i = 0; i < constraints.length; i++) {
            const c = constraints[i];
            const usedColors = new Set<number>();

            const check = (p: number) => {
                for (const ni of particleConstraints[p]) {
                    if (ni === i) continue;
                    const col = constraintColors[ni];
                    if (col !== -1) usedColors.add(col);
                }
            };
            check(c.anchor);
            check(c.particle);

            let color = 0;
            while (usedColors.has(color)) color++;
            constraintColors[i] = color;
            if (color > maxColor) maxColor = color;
        }

        const batches: TetherConstraintData[][] = Array.from({ length: maxColor + 1 }, () => []);
        for (let i = 0; i < constraints.length; i++) {
            batches[constraintColors[i]].push(constraints[i]);
        }

        console.log(`[ConstraintGenerator] Partitioned ${constraints.length} tether constraints into ${batches.length} batches`);
        return batches;
    }

    /**
     * Creates Tether Constraint Buffer.
     * Layout: anchor(u32), particle(u32), max_distance(f32), compliance(f32) -> 16 bytes
     */
    static createTetherConstraintBuffer(
        device: GPUDevice,
        constraints: TetherConstraintData[],
        label: string = 'tether_constraints'
    ): { buffer: GPUBuffer; count: number } {
        const byteSize = constraints.length * 16;
        const data = new ArrayBuffer(byteSize);
        const u32View = new Uint32Array(data);
        const f32View = new Float32Array(data);

        for (let i = 0; i < constraints.length; i++) {
            const c = constraints[i];
            const offset = i * 4;
            u32View[offset + 0] = c.anchor;
            u32View[offset + 1] = c.particle;
            f32View[offset + 2] = c.maxDistance;
            f32View[offset + 3] = c.compliance;
        }

        const buffer = device.createBuffer({
            label,
            size: Math.max(byteSize, 16),
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
        });

        device.queue.writeBuffer(buffer, 0, data);
        return { buffer, count: constraints.length };
    }



    /**
     * Generates area constraints for every triangle.
     * Uses graph coloring to allow parallel solving.
     */
    static generateColoredAreaConstraints(
        positions: Float32Array,
        indices: Uint32Array,
        config: Partial<ConstraintConfig> = {}
    ): AreaConstraintData[][] {
        const { areaCompliance } = { ...DEFAULT_CONFIG, ...config };

        const numTriangles = indices.length / 3;
        const constraints: AreaConstraintData[] = [];
        const particleConstraints: number[][] = Array.from({ length: positions.length / 3 }, () => []);

        // 1. Generate constraints
        for (let t = 0; t < numTriangles; t++) {
            const i0 = indices[t * 3 + 0];
            const i1 = indices[t * 3 + 1];
            const i2 = indices[t * 3 + 2];

            const p0x = positions[i0 * 3 + 0];
            const p0y = positions[i0 * 3 + 1];
            const p0z = positions[i0 * 3 + 2];

            const p1x = positions[i1 * 3 + 0];
            const p1y = positions[i1 * 3 + 1];
            const p1z = positions[i1 * 3 + 2];

            const p2x = positions[i2 * 3 + 0];
            const p2y = positions[i2 * 3 + 1];
            const p2z = positions[i2 * 3 + 2];

            // Cross product: (p1-p0) x (p2-p0)
            const uX = p1x - p0x;
            const uY = p1y - p0y;
            const uZ = p1z - p0z;

            const vX = p2x - p0x;
            const vY = p2y - p0y;
            const vZ = p2z - p0z;

            const cX = uY * vZ - uZ * vY;
            const cY = uZ * vX - uX * vZ;
            const cZ = uX * vY - uY * vX;

            const area = 0.5 * Math.sqrt(cX * cX + cY * cY + cZ * cZ);

            if (area > 1e-6) {
                const idx = constraints.length;
                constraints.push({
                    i0, i1, i2,
                    restArea: area,
                    compliance: areaCompliance
                });

                particleConstraints[i0].push(idx);
                particleConstraints[i1].push(idx);
                particleConstraints[i2].push(idx);
            }
        }

        // 2. Greedy Coloring
        const constraintColors = new Int32Array(constraints.length).fill(-1);
        let maxColor = 0;

        for (let i = 0; i < constraints.length; i++) {
            const c = constraints[i];
            const usedColors = new Set<number>();

            const check = (p: number) => {
                for (const ni of particleConstraints[p]) {
                    if (ni === i) continue;
                    const col = constraintColors[ni];
                    if (col !== -1) usedColors.add(col);
                }
            };

            check(c.i0);
            check(c.i1);
            check(c.i2);

            let color = 0;
            while (usedColors.has(color)) color++;
            constraintColors[i] = color;
            if (color > maxColor) maxColor = color;
        }

        // 3. Batching
        const batches: AreaConstraintData[][] = Array.from({ length: maxColor + 1 }, () => []);
        for (let i = 0; i < constraints.length; i++) {
            batches[constraintColors[i]].push(constraints[i]);
        }

        console.log(`[ConstraintGenerator] Partitioned ${constraints.length} area constraints into ${batches.length} batches`);
        return batches;
    }

    /**
     * Creates Area Constraint Buffer.
     * Layout: i0, i1, i2, pad (u32), restArea, compliance, pad, pad (f32) -> 32 bytes
     */
    static createAreaConstraintBuffer(
        device: GPUDevice,
        constraints: AreaConstraintData[],
        label: string = 'area_constraints'
    ): { buffer: GPUBuffer; count: number } {
        const byteSize = constraints.length * 32;
        const data = new ArrayBuffer(byteSize);
        const u32View = new Uint32Array(data);
        const f32View = new Float32Array(data);

        for (let i = 0; i < constraints.length; i++) {
            const c = constraints[i];
            const offset = i * 8; // 8 * 4 bytes = 32 bytes

            u32View[offset + 0] = c.i0;
            u32View[offset + 1] = c.i1;
            u32View[offset + 2] = c.i2;
            u32View[offset + 3] = 0; // pad

            f32View[offset + 4] = c.restArea;
            f32View[offset + 5] = c.compliance;
            f32View[offset + 6] = 0.0; // pad
            f32View[offset + 7] = 0.0; // pad
        }

        const buffer = device.createBuffer({
            label,
            size: Math.max(byteSize, 16),
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
        });

        device.queue.writeBuffer(buffer, 0, data);
        return { buffer, count: constraints.length };
    }
}
