// src/presentation/state/types.ts
/**
 * @fileoverview Simulation store type definitions.
 *
 * Defines the state shape and actions for the simulation store.
 */

import * as THREE from 'three';
import type { IPhysicsEngine, PhysicsBackend } from '../../core/interfaces/IPhysicsEngine';
import type { SimulationAssets } from '../../core/entities/Assets';
import type { ShirtSize } from '../../core/entities/Garment';

/**
 * The single source of truth for the application state.
 * Combines Data, Flags, and Actions into one cohesive Store interface.
 */
export interface SimulationState {
    // --- Data ---
    engine: IPhysicsEngine | null;
    assets: SimulationAssets<THREE.BufferGeometry> | null;
    scaledVertices: Float32Array | null;
    shirtSize: ShirtSize;
    /** The currently active physics backend. */
    backend: PhysicsBackend | null;

    // --- Flags ---
    isLoading: boolean;
    isReady: boolean;
    isRunning: boolean;
    isInteracting: boolean;
    error: string | null;
    fps: number;
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

    /** Updates the current FPS */
    setFps: (fps: number) => void;
}

export type SimulationStore = SimulationState & SimulationActions;