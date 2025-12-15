'use client';

import { useEffect } from "react";
import type { PricingStrategy } from "@/lib/schema";
import { useStore } from "@/lib/store";

type StoreHydratorProps = {
  activeStrategy: PricingStrategy;
  simulationStrategy: PricingStrategy;
  isSimulating: boolean;
};

export function StoreHydrator({
  activeStrategy,
  simulationStrategy,
  isSimulating,
}: StoreHydratorProps) {
  useEffect(() => {
    useStore.getState().hydrate({
      activeStrategy,
      simulationStrategy,
      isSimulating,
    });
  }, [activeStrategy, simulationStrategy, isSimulating]);

  return null;
}

