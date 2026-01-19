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

    // NEW: Store the clean, scaled T-Pose separately from the raw assets
    scaledVertices: Float32Array | null;

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
    scaledVertices: null, // Init
    shirtSize: 'L',
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

            // Generate the scaled vertices from the ORIGINAL assets
            // This creates a new array, leaving assets.garment.vertices untouched.
            const scaledGarmentVerts = GarmentGrading.applyGrading(
                assets.garment.vertices,
                currentSize
            );

            // Save this "Clean T-Pose" to the store for the Visual Mesh to use
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

    setShirtSize: (size: ShirtSize) => {
        const current = get().shirtSize;
        if (current === size) return;

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