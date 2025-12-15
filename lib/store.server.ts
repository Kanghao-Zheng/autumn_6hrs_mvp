"use server";

import { updateDb, readDb } from "./db";
import { type AppState, type DateString, type PricingStrategy } from "./schema";

export async function getAppState(): Promise<AppState> {
  return readDb();
}

export async function setSimulationStrategy(
  strategy: PricingStrategy,
): Promise<AppState> {
  return updateDb((state) => ({
    ...state,
    simulationStrategy: strategy,
    isSimulating: true,
  }));
}

export async function setActiveStrategy(strategy: PricingStrategy): Promise<AppState> {
  return updateDb((state) => ({
    ...state,
    activeStrategy: strategy,
    hasActiveStrategy: true,
    hotel: {
      ...state.hotel,
      pricingStrategy: strategy,
    },
  }));
}

export async function setSimulationStartDate(
  startDate: DateString,
): Promise<AppState> {
  return updateDb((state) => ({
    ...state,
    simulationStartDate: startDate,
  }));
}

export async function setSimulating(isSimulating: boolean): Promise<AppState> {
  return updateDb((state) => ({
    ...state,
    isSimulating,
  }));
}
