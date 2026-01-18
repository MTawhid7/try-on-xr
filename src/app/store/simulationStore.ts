// src/app/store/simulationStore.ts
import { create } from 'zustand';
import type { ISimulationEngine } from '../../adapters/types';
import { WasmAdapter } from '../../adapters/WasmAdapter';
import { AssetLoader } from '../../domain/services/AssetLoader';
import { GarmentGrading } from '../../domain/services/GarmentGrading';
import type { SimulationAssets, ShirtSize } from '../../domain/types';

interface SimulationState {
    engine: ISimulationEngine | null;
    assets: SimulationAssets | null;

    shirtSize: ShirtSize;
    isLoading: boolean;
    isReady: boolean;
    isRunning: boolean;
    isInteracting: boolean;
    error: string | null;

    loadAndInitialize: () => Promise<void>;
    setShirtSize: (size: ShirtSize) => void;
    toggleSimulation: () => void;
    step: (dt: number) => void;

    setInteracting: (active: boolean) => void;
    grabParticle: (index: number, pos: [number, number, number]) => void;
    moveParticle: (pos: [number, number, number]) => void;
    releaseParticle: () => void;
}

export const useSimulationStore = create<SimulationState>((set, get) => ({
    engine: null,
    assets: null,
    shirtSize: 'L', // UPDATED: Default to L (Base Mesh)
    isLoading: false,
    isReady: false,
    isRunning: false,
    isInteracting: false,
    error: null,

    loadAndInitialize: async () => {
        if (get().isLoading) return;
        set({ isLoading: true, error: null });

        try {
            let assets = get().assets;
            if (!assets) {
                const loader = new AssetLoader();
                assets = await loader.loadSceneAssets();
                set({ assets });
            }

            const currentSize = get().shirtSize;
            console.log(`[Store] Applying Grading: ${currentSize}`);

            const scaledGarmentVerts = GarmentGrading.applyGrading(
                assets.garment.vertices,
                currentSize
            );

            const oldEngine = get().engine;
            if (oldEngine) {
                oldEngine.dispose();
            }

            const adapter = new WasmAdapter();
            await adapter.init(
                scaledGarmentVerts,
                assets.garment.indices,
                assets.garment.uvs,
                assets.collider.vertices,
                assets.collider.normals,
                assets.collider.indices
            );

            set({
                engine: adapter,
                isReady: true,
                isLoading: false
            });
            console.log("[Store] Simulation Initialized.");

        } catch (err) {
            console.error(err);
            set({ error: (err as Error).message, isLoading: false });
        }
    },

    setShirtSize: (size: ShirtSize) => {
        const current = get().shirtSize;
        if (current === size) return;

        // FIX: pause simulation and mark not ready
        set({ shirtSize: size, isReady: false, isRunning: false });

        setTimeout(() => {
            get().loadAndInitialize();
        }, 10);
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

    setInteracting: (active) => set({ isInteracting: active }),

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