// src/app/store/simulation/useSimulationStore.ts
import { create } from 'zustand';
import type { SimulationStore } from './types';
import { createLifecycleSlice } from './lifecycleSlice';
import { createSimulationSlice } from './simulationSlice';
import { createInteractionSlice } from './interactionSlice';

export const useSimulationStore = create<SimulationStore>()((...a) => ({
    ...createLifecycleSlice(...a),
    ...createSimulationSlice(...a),
    ...createInteractionSlice(...a),
} as SimulationStore)); // FIX: Explicit cast to satisfy TS