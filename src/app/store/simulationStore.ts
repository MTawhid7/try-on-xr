// src/app/store/simulationStore.ts
import { create } from 'zustand';
import type { ISimulationEngine } from '../../adapters/types';
import { WasmAdapter } from '../../adapters/WasmAdapter';
import { AssetLoader } from '../../domain/services/AssetLoader';
import type { SimulationAssets } from '../../domain/types';

interface SimulationState {
    engine: ISimulationEngine | null;
    assets: SimulationAssets | null;
    isLoading: boolean;
    isReady: boolean;
    isRunning: boolean;
    isInteracting: boolean; // NEW: Track interaction state
    error: string | null;

    loadAndInitialize: () => Promise<void>;
    toggleSimulation: () => void;
    step: (dt: number) => void;

    // Interaction
    setInteracting: (active: boolean) => void; // NEW: Action
    grabParticle: (index: number, pos: [number, number, number]) => void;
    moveParticle: (pos: [number, number, number]) => void;
    releaseParticle: () => void;
}

export const useSimulationStore = create<SimulationState>((set, get) => ({
    engine: null,
    assets: null,
    isLoading: false,
    isReady: false,
    isRunning: false,
    isInteracting: false, // Default false
    error: null,

    loadAndInitialize: async () => {
        if (get().isReady || get().isLoading) return;
        set({ isLoading: true, error: null });

        try {
            const loader = new AssetLoader();
            const assets = await loader.loadSceneAssets();

            const adapter = new WasmAdapter();
            await adapter.init(
                assets.garment.vertices,
                assets.garment.indices,
                assets.collider.vertices,
                assets.collider.normals,
                assets.collider.indices
            );

            set({
                engine: adapter,
                assets: assets,
                isReady: true,
                isLoading: false
            });
            console.log("[Store] Simulation Initialized & Ready.");

        } catch (err) {
            console.error(err);
            set({ error: (err as Error).message, isLoading: false });
        }
    },

    toggleSimulation: () => {
        set((state) => ({ isRunning: !state.isRunning }));
    },

    step: (dt: number) => {
        const { engine, isRunning } = get();
        const safeDt = Math.min(dt, 0.05);
        if (engine && isRunning) {
            engine.step(safeDt);
        }
    },

    // Interaction Implementation
    setInteracting: (active) => set({ isInteracting: active }), // NEW

    grabParticle: (index, [x, y, z]) => {
        get().engine?.startInteraction(index, x, y, z);
    },
    moveParticle: ([x, y, z]) => {
        get().engine?.updateInteraction(x, y, z);
    },
    releaseParticle: () => {
        get().engine?.endInteraction();
    }
}));