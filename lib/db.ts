"use server";

import { promises as fs } from "fs";
import path from "path";
import { AppStateSchema, type AppState } from "./schema";

const DB_PATH = path.join(process.cwd(), "db.json");

const DEFAULT_STRATEGY = {
  baseRate: 150,
  floor: 80,
  ceiling: 450,
  freedomIndex: 1,
  smoothingFactor: 0.6,
  competitorWeights: {},
  strategyDifferential: 0,
  overrides: {},
};

const DEFAULT_STATE: AppState = AppStateSchema.parse({
  hotel: {
    id: "autumn-hotel",
    name: "Autumn Hotel",
    timezone: "UTC",
    currency: "USD",
    roomCount: 15,
    pricingStrategy: DEFAULT_STRATEGY,
  },
  reservations: [],
  competitorProfiles: [],
  competitorRates: [],
  dailyStats: [],
  prices: [],
  simulationStartDate: "2025-01-01",
  activeStrategy: DEFAULT_STRATEGY,
  simulationStrategy: DEFAULT_STRATEGY,
  isSimulating: false,
});

async function readRawDb(): Promise<AppState> {
  try {
    const raw = await fs.readFile(DB_PATH, "utf-8");
    return AppStateSchema.parse(JSON.parse(raw));
  } catch (error: unknown) {
    const typedError = error as NodeJS.ErrnoException;
    if (typedError?.code === "ENOENT") {
      await writeDb(DEFAULT_STATE);
      return DEFAULT_STATE;
    }
    if (error instanceof SyntaxError) {
      await writeDb(DEFAULT_STATE);
      return DEFAULT_STATE;
    }
    throw error;
  }
}

export async function readDb(): Promise<AppState> {
  return readRawDb();
}

export async function writeDb(nextState: AppState): Promise<AppState> {
  const parsed = AppStateSchema.parse(nextState);
  await fs.writeFile(DB_PATH, JSON.stringify(parsed, null, 2), "utf-8");
  return parsed;
}

export async function updateDb(
  updater: (current: AppState) => AppState | Promise<AppState>,
): Promise<AppState> {
  const current = await readRawDb();
  const next = await updater(current);
  return writeDb(next);
}
