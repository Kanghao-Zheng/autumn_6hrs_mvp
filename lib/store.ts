"use client";

import { create } from "zustand";
import type { PricingStrategy } from "./schema";

type StrategyStoreState = {
  activeStrategy: PricingStrategy | null;
  simulationStrategy: PricingStrategy | null;
  isSimulating: boolean;

  hydrate: (payload: {
    activeStrategy: PricingStrategy;
    simulationStrategy?: PricingStrategy;
    isSimulating?: boolean;
  }) => void;

  setActiveStrategy: (strategy: PricingStrategy) => void;
  setSimulationStrategy: (strategy: PricingStrategy) => void;
  patchSimulationStrategy: (patch: Partial<PricingStrategy>) => void;
  resetSimulation: () => void;
};

export const useStore = create<StrategyStoreState>((set, get) => ({
  activeStrategy: null,
  simulationStrategy: null,
  isSimulating: false,

  hydrate: ({ activeStrategy, simulationStrategy, isSimulating }) =>
    set({
      activeStrategy,
      simulationStrategy: simulationStrategy ?? activeStrategy,
      isSimulating: isSimulating ?? false,
    }),

  setActiveStrategy: (strategy) =>
    set({
      activeStrategy: strategy,
      simulationStrategy: strategy,
      isSimulating: false,
    }),

  setSimulationStrategy: (strategy) =>
    set({
      simulationStrategy: strategy,
      isSimulating: true,
    }),

  patchSimulationStrategy: (patch) =>
    set((state) => {
      const base = state.simulationStrategy ?? state.activeStrategy;
      if (!base) return state;
      return {
        simulationStrategy: { ...base, ...patch },
        isSimulating: true,
      };
    }),

  resetSimulation: () => {
    const strategy = get().activeStrategy;
    if (!strategy) return;
    set({
      simulationStrategy: strategy,
      isSimulating: false,
    });
  },
}));

