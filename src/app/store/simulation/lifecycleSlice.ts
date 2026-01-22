// src/app/store/simulation/lifecycleSlice.ts
import type { StateCreator } from 'zustand';
import type { SimulationStore } from './types';
import { AssetLoader } from '../../../domain/services/asset_loader';
import { GarmentGrading } from '../../../domain/services/GarmentGrading';
import { WasmAdapter } from '../../../adapters/WasmAdapter';

export const createLifecycleSlice: StateCreator<SimulationStore, [], [], Partial<SimulationStore>> = (set, get) => ({
    engine: null,
    assets: null,
    scaledVertices: null,
    shirtSize: 'L',
    isLoading: false,
    isReady: false,
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

            // FIX: Ensure assets is not null before proceeding
            if (!assets) {
                throw new Error("Failed to load assets");
            }

            const currentSize = get().shirtSize;
            console.log(`[Store] Applying Grading: ${currentSize}`);

            const scaledGarmentVerts = GarmentGrading.applyGrading(
                assets.garment.vertices,
                currentSize
            );

            set({ scaledVertices: scaledGarmentVerts });

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

    setShirtSize: (size) => {
        const current = get().shirtSize;
        if (current === size) return;

        set({ shirtSize: size, isReady: false, isRunning: false });

        setTimeout(() => {
            get().loadAndInitialize();
        }, 10);
    },
});