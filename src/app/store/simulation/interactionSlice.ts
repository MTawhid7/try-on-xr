// src/app/store/simulation/interactionSlice.ts
import type { StateCreator } from 'zustand';
import type { SimulationStore } from './types';

export const createInteractionSlice: StateCreator<SimulationStore, [], [], Partial<SimulationStore>> = (set, get) => ({
    isInteracting: false,

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
});