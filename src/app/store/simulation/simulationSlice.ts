// src/app/store/simulation/simulationSlice.ts
import type { StateCreator } from 'zustand';
import type { SimulationStore } from './types';

export const createSimulationSlice: StateCreator<SimulationStore, [], [], Partial<SimulationStore>> = (set, get) => ({
    isRunning: false,

    toggleSimulation: () => {
        set((state) => ({ isRunning: !state.isRunning }));
    },

    step: (dt: number) => {
        const { engine, isRunning } = get();
        // Cap dt to prevent explosion on tab switch/lag spikes
        const safeDt = Math.min(dt, 0.05);

        if (engine && isRunning) {
            engine.step(safeDt);
        }
    },
});