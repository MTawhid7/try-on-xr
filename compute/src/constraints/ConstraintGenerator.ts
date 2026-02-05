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
 * Configuration for constraint generation.
 */
export interface ConstraintConfig {
    /** Distance constraint stiffness (lower = stiffer). */
    distanceCompliance: number;
    /** Bending constraint stiffness. */
    bendingCompliance: number;
    /** Tether constraint stiffness. */
    tetherCompliance: number;
}

const DEFAULT_CONFIG: ConstraintConfig = {
    distanceCompliance: 0.0001,
    bendingCompliance: 0.01,
    tetherCompliance: 0.001
};

/**
 * Generates constraints from mesh topology.
 */
export class ConstraintGenerator {
    /**
     * Generates distance constraints from mesh edges.
     *
     * @param positions - Vertex positions (vec3).
     * @param indices - Triangle indices.
     * @param config - Constraint configuration.
     * @returns Array of distance constraints.
     */
    static generateDistanceConstraints(
        positions: Float32Array,
        indices: Uint32Array,
        config: Partial<ConstraintConfig> = {}
    ): DistanceConstraintData[] {
        const { distanceCompliance } = { ...DEFAULT_CONFIG, ...config };

        // Collect unique edges using a Set
        const edgeSet = new Set<string>();
        const edges: [number, number][] = [];

        const numTriangles = indices.length / 3;

        for (let t = 0; t < numTriangles; t++) {
            const i0 = indices[t * 3 + 0];
            const i1 = indices[t * 3 + 1];
            const i2 = indices[t * 3 + 2];

            // Add edges (sorted to avoid duplicates)
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

        // Create distance constraints for each edge
        const constraints: DistanceConstraintData[] = [];

        for (const [i0, i1] of edges) {
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

        console.log(`[ConstraintGenerator] Generated ${constraints.length} distance constraints from ${edges.length} edges`);
        return constraints;
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
        const buffer = device.createBuffer({
            label,
            size: 4,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
        });

        const data = new Uint32Array([count]);
        device.queue.writeBuffer(buffer, 0, data);

        return buffer;
    }
}
