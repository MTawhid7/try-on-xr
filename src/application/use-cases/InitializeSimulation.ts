// src/application/use-cases/InitializeSimulation.ts
/**
 * @fileoverview Simulation initialization use case.
 *
 * Orchestrates asset loading, sizing/grading, and physics engine creation.
 * Uses EngineFactory for automatic GPU detection and fallback.
 */

import * as THREE from 'three';
import { AssetPreparationPipeline } from '../pipelines/AssetPreparationPipeline';
import { GradingPipeline } from '../pipelines/GradingPipeline';
import { engineFactory, type EngineCreationResult } from '../../infrastructure/physics/factory/EngineFactory';
import type { IPhysicsEngine, PhysicsBackend } from '../../core/interfaces/IPhysicsEngine';
import type { SimulationAssets } from '../../core/entities/Assets';
import type { ShirtSize } from '../../core/entities/Garment';

export interface InitializationResult {
    engine: IPhysicsEngine;
    assets: SimulationAssets<THREE.BufferGeometry>;
    scaledVertices: Float32Array;
    backend: PhysicsBackend;
    fallbackReason?: string;
}

export interface InitializationConfig {
    /** Prefer GPU backend. Default: true */
    preferGpu?: boolean;
    /** Called when falling back to CPU. */
    onFallback?: (reason: string) => void;
    /** Called when GPU is ready. */
    onGpuReady?: () => void;
}

/**
 * Use Case: Initializes the entire simulation environment.
 * Orchestrates asset loading, initial grading (sizing), and physics engine initialization.
 */
export class InitializeSimulation {
    private assetPipeline: AssetPreparationPipeline;

    constructor() {
        this.assetPipeline = new AssetPreparationPipeline();
    }

    /**
     * Orchestrates the full initialization flow.
     *
     * @param currentAssets - Existing assets (if already loaded) to avoid reloading.
     * @param size - The shirt size to apply.
     * @param config - Optional configuration for engine selection.
     */
    async execute(
        currentAssets: SimulationAssets<THREE.BufferGeometry> | null,
        size: ShirtSize,
        config: InitializationConfig = {}
    ): Promise<InitializationResult> {
        const { preferGpu = true, onFallback, onGpuReady } = config;

        // 1. Load Assets (if needed)
        let assets = currentAssets;
        if (!assets) {
            assets = await this.assetPipeline.execute();
        }

        // 2. Apply Grading (Sizing)
        // This transforms the base mesh vertices to match the requested size.
        const { vertices: scaledGarmentVerts, normals: scaledGarmentNormals, scaleFactor } = GradingPipeline.execute(
            assets.garment,
            size
        );

        // 3. Create Physics Engine using factory
        const creationResult: EngineCreationResult = await engineFactory.createEngine({
            preferGpu,
            onFallback,
            onGpuReady
        });

        // 4. Initialize the engine with geometry
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

        console.log(`[InitializeSimulation] Using ${creationResult.backend} backend`);

        return {
            engine: creationResult.engine,
            assets,
            scaledVertices: scaledGarmentVerts,
            backend: creationResult.backend,
            fallbackReason: creationResult.fallbackReason
        };
    }
}