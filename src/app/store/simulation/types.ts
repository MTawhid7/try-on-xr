// src/app/store/simulation/types.ts
import type { ISimulationEngine } from '../../../adapters/types';
import type { SimulationAssets, ShirtSize } from '../../../domain/types';

export interface SimulationState {
    // Data
    engine: ISimulationEngine | null;
    assets: SimulationAssets | null;
    scaledVertices: Float32Array | null;
    shirtSize: ShirtSize;
    isLoading: boolean;
    isReady: boolean;
    isRunning: boolean;
    isInteracting: boolean;
    error: string | null;
}

export interface SimulationActions {
    // Lifecycle
    loadAndInitialize: () => Promise<void>;
    setShirtSize: (size: ShirtSize) => void;

    // Simulation Loop
    toggleSimulation: () => void;
    step: (dt: number) => void;

    // Interaction
    setInteracting: (active: boolean) => void;
    grabParticle: (index: number, pos: [number, number, number]) => void;
    moveParticle: (pos: [number, number, number]) => void;
    releaseParticle: () => void;
}

export type SimulationStore = SimulationState & SimulationActions;