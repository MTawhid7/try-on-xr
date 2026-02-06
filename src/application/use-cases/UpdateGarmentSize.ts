// src/application/use-cases/UpdateGarmentSize.ts
/**
 * @fileoverview Garment size update use case.
 *
 * Handles size changes during an active session by re-applying grading
 * and re-initializing the physics engine.
 */

import * as THREE from 'three';
import { GradingPipeline } from '../pipelines/GradingPipeline';
import { engineFactory } from '../../infrastructure/physics/factory/EngineFactory';
import type { IPhysicsEngine, PhysicsBackend } from '../../core/interfaces/IPhysicsEngine';
import type { SimulationAssets } from '../../core/entities/Assets';
import type { ShirtSize } from '../../core/entities/Garment';

export interface UpdateResult {
    engine: IPhysicsEngine;
    scaledVertices: Float32Array;
    backend: PhysicsBackend;
}

export interface UpdateConfig {
    /** Prefer GPU backend. Default: true */
    preferGpu?: boolean;
    /** Called when falling back to CPU. */
    onFallback?: (reason: string) => void;
}

/**
 * Use Case: Updates the garment size during an active session.
 * Re-runs the grading pipeline and re-initializes the physics engine with the new mesh data.
 */
export class UpdateGarmentSize {
    /**
     * Resizes the garment and re-initializes the physics engine.
     *
     * @param assets - The loaded simulation assets.
     * @param newSize - The new size to apply.
     * @param oldEngine - The current engine instance (to be disposed).
     * @param config - Optional configuration for engine selection.
     */
    async execute(
        assets: SimulationAssets<THREE.BufferGeometry>,
        newSize: ShirtSize,
        oldEngine: IPhysicsEngine | null,
        config: UpdateConfig = {}
    ): Promise<UpdateResult> {
        const { preferGpu = true, onFallback } = config;

        // 1. Dispose the old engine to free memory
        if (oldEngine) {
            oldEngine.dispose();
        }

        // 2. Apply Grading
        const { vertices: scaledGarmentVerts, normals: scaledGarmentNormals, scaleFactor } = GradingPipeline.execute(
            assets.garment,
            newSize
        );

        // 3. Create Physics Engine using factory
        const creationResult = await engineFactory.createEngine({
            preferGpu,
            onFallback
        });

        // 4. Initialize the engine with new geometry
        await creationResult.engine.init(
            scaledGarmentVerts,
            scaledGarmentNormals,
            assets.garment.indices,
            assets.garment.uvs,
            assets.collider.vertices,
            assets.collider.normals,
            assets.collider.indices,
            scaleFactor
        );

        console.log(`[UpdateGarmentSize] Using ${creationResult.backend} backend`);

        return {
            engine: creationResult.engine,
            scaledVertices: scaledGarmentVerts,
            backend: creationResult.backend
        };
    }
}