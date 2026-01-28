// src/presentation/state/types.ts

import * as THREE from 'three';
import type { IPhysicsEngine } from '../../core/interfaces/IPhysicsEngine';
import type { SimulationAssets } from '../../core/entities/Assets';
import type { ShirtSize } from '../../core/entities/Garment';

export interface SimulationState {
    // --- Data ---
    engine: IPhysicsEngine | null;
    assets: SimulationAssets<THREE.BufferGeometry> | null;
    scaledVertices: Float32Array | null;
    shirtSize: ShirtSize;

    // --- Flags ---
    isLoading: boolean;
    isReady: boolean;
    isRunning: boolean;
    isInteracting: boolean;
    error: string | null;
}

export interface SimulationActions {
    // --- Lifecycle ---
    /** Loads assets and initializes the engine */
    loadAndInitialize: () => Promise<void>;

    /** Changes the shirt size and re-initializes the engine */
    setShirtSize: (size: ShirtSize) => void;

    // --- Simulation Loop ---
    toggleSimulation: () => void;
    step: (dt: number) => void;

    // --- Interaction ---
    setInteracting: (active: boolean) => void;
    grabParticle: (index: number, pos: [number, number, number]) => void;
    moveParticle: (pos: [number, number, number]) => void;
    releaseParticle: () => void;
}

export type SimulationStore = SimulationState & SimulationActions;