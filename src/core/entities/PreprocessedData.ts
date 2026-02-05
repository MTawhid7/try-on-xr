// src/core/entities/PreprocessedData.ts
/**
 * @fileoverview Types for preprocessed GPU simulation data.
 *
 * These types represent the output of Rust preprocessing that is consumed
 * by the GPU engine for efficient constraint solving.
 */

/**
 * A batch of constraints that can be solved in parallel.
 *
 * Constraints in the same batch are guaranteed to not share vertices,
 * enabling conflict-free parallel updates.
 */
export interface ConstraintBatch {
    /**
     * Indices defining the constraint topology.
     * - Distance: pairs [i0, i1, i0, i1, ...]
     * - Bending: quads [i0, i1, i2, i3, ...]
     * - Tether: pairs [anchor, particle, ...]
     */
    readonly indices: Uint32Array;

    /**
     * Rest values for each constraint.
     * - Distance: rest lengths
     * - Bending: rest angles
     * - Tether: max distances
     */
    readonly restValues: Float32Array;

    /**
     * Compliance values for each constraint.
     * Higher compliance = softer constraint.
     */
    readonly compliances: Float32Array;

    /** Number of constraints in this batch. */
    readonly count: number;
}

/**
 * Pre-computed constraint batches organized by type.
 */
export interface ConstraintBatches {
    /** Distance (edge) constraints, batched by graph coloring. */
    readonly distance: ConstraintBatch[];

    /** Bending (dihedral) constraints, batched by graph coloring. */
    readonly bending: ConstraintBatch[];

    /** Tether (long-range) constraints for limiting stretch. */
    readonly tether: ConstraintBatch[];
}

/**
 * Configuration for spatial hashing.
 */
export interface SpatialHashConfig {
    /** Size of each hash cell. */
    readonly cellSize: number;

    /** Grid dimensions [x, y, z]. */
    readonly gridDimensions: [number, number, number];

    /** Origin offset for the grid. */
    readonly origin: [number, number, number];
}

/**
 * Complete preprocessed data for GPU simulation.
 *
 * This data is computed once during initialization by the Rust backend
 * and consumed by the GPU engine for efficient constraint solving.
 */
export interface PreprocessedData {
    /** Graph-colored constraint batches. */
    readonly constraintBatches: ConstraintBatches;

    /**
     * Topology exclusion masks for self-collision.
     * Each vertex has a bitmask indicating N-ring neighbors to exclude.
     */
    readonly exclusionMasks?: Uint32Array;

    /** Pre-computed spatial hash configuration. */
    readonly spatialConfig?: SpatialHashConfig;
}

/**
 * Validation result for preprocessed data.
 */
export interface PreprocessedDataValidation {
    readonly valid: boolean;
    readonly errors: string[];
}

/**
 * Validates preprocessed data for consistency.
 *
 * @param data - The data to validate.
 * @param particleCount - Expected number of particles.
 * @returns Validation result with any errors.
 */
export function validatePreprocessedData(
    data: PreprocessedData,
    particleCount: number
): PreprocessedDataValidation {
    const errors: string[] = [];

    // Validate constraint batches exist
    if (!data.constraintBatches) {
        errors.push('Missing constraintBatches');
        return { valid: false, errors };
    }

    // Validate distance constraints
    for (let i = 0; i < data.constraintBatches.distance.length; i++) {
        const batch = data.constraintBatches.distance[i];
        validateBatch(batch, 'distance', i, particleCount, 2, errors);
    }

    // Validate bending constraints
    for (let i = 0; i < data.constraintBatches.bending.length; i++) {
        const batch = data.constraintBatches.bending[i];
        validateBatch(batch, 'bending', i, particleCount, 4, errors);
    }

    // Validate tether constraints
    for (let i = 0; i < data.constraintBatches.tether.length; i++) {
        const batch = data.constraintBatches.tether[i];
        validateBatch(batch, 'tether', i, particleCount, 2, errors);
    }

    return { valid: errors.length === 0, errors };
}

/**
 * Validates a single constraint batch.
 */
function validateBatch(
    batch: ConstraintBatch,
    type: string,
    index: number,
    particleCount: number,
    indicesPerConstraint: number,
    errors: string[]
): void {
    // Check array lengths
    const expectedIndices = batch.count * indicesPerConstraint;
    if (batch.indices.length !== expectedIndices) {
        errors.push(
            `${type}[${index}]: indices length mismatch. ` +
            `Expected ${expectedIndices}, got ${batch.indices.length}`
        );
    }

    if (batch.restValues.length !== batch.count) {
        errors.push(
            `${type}[${index}]: restValues length mismatch. ` +
            `Expected ${batch.count}, got ${batch.restValues.length}`
        );
    }

    if (batch.compliances.length !== batch.count) {
        errors.push(
            `${type}[${index}]: compliances length mismatch. ` +
            `Expected ${batch.count}, got ${batch.compliances.length}`
        );
    }

    // Check index bounds
    for (let j = 0; j < batch.indices.length; j++) {
        if (batch.indices[j] >= particleCount) {
            errors.push(
                `${type}[${index}]: index out of bounds at position ${j}. ` +
                `Value ${batch.indices[j]} >= ${particleCount}`
            );
            break; // Only report first out-of-bounds
        }
    }
}
