"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { setActiveStrategy, setSimulationStrategy, setSimulating } from "./store.server";
import {
  AppStateSchema,
  ManualOverrideRangeSchema,
  type ManualOverrideRange,
  type PricingStrategy,
} from "./schema";
import { seed } from "./seed";
import {
  UploadedReservationRowSchema,
  generateCompetitorRates,
  findSmartViewport,
  ingestReservationRows,
  TOTAL_ROOMS,
} from "./data-service";
import { addDays, differenceInCalendarDays, format, isValid, parseISO } from "date-fns";
import { readDb, writeDb } from "./db";

export async function applyStrategyChange(
  newConfig: PricingStrategy,
): Promise<{ message: string }> {
  await setActiveStrategy(newConfig);
  await setSimulationStrategy(newConfig);
  await setSimulating(false);
  revalidatePath("/");
  return { message: "Strategy updated and dashboard refreshed." };
}

export async function resetDB(): Promise<{ message: string }> {
  const defaultStrategy: PricingStrategy = {
    baseRate: 150,
    floor: 80,
    ceiling: 450,
    freedomIndex: 1.0,
    smoothingFactor: 0.6,
    competitorWeights: {},
    strategyDifferential: 0,
    overrides: {},
  };

  const nextState = AppStateSchema.parse({
    hotel: {
      id: "autumn-hotel",
      name: "Autumn Hotel",
      timezone: "UTC",
      currency: "USD",
      roomCount: TOTAL_ROOMS,
      pricingStrategy: defaultStrategy,
    },
    historicalAdr: 0,
    reservations: [],
    competitorProfiles: [],
    competitorRates: [],
    dailyStats: [],
    prices: [],
    simulationStartDate: "2025-01-01",
    activeStrategy: defaultStrategy,
    simulationStrategy: defaultStrategy,
    isSimulating: false,
    hasActiveStrategy: false,
  });

  await writeDb(nextState);
  revalidatePath("/");
  return { message: "System reset to factory settings." };
}

export async function seedDemoData(): Promise<{ message: string }> {
  await seed();
  revalidatePath("/");
  return { message: "Demo data loaded." };
}

export async function seedFromUpload(
  rows: unknown,
): Promise<{ message: string; reservationCount: number }> {
  const parsedRows = z.array(UploadedReservationRowSchema).parse(rows);

  const { reservations, dailyStats, historicalAdr, minDate, maxDate } =
    ingestReservationRows(parsedRows, TOTAL_ROOMS);
  if (reservations.length === 0) {
    throw new Error("Could not parse CSV format. Please check delimiters.");
  }

  const smartStart = findSmartViewport(reservations);

  const parsedMin = parseISO(minDate);
  const parsedMax = parseISO(maxDate);
  const rangeStart = isValid(parsedMin) ? parsedMin : new Date();
  const rangeEnd = isValid(parsedMax) ? parsedMax : rangeStart;

  const { profiles, rates } = generateCompetitorRates(rangeStart, rangeEnd, 90);

  const baseRate = historicalAdr > 0 ? historicalAdr : 150;
  const floor = baseRate * 0.6;
  const ceiling = baseRate * 2.5;

  const strategy: PricingStrategy = {
    baseRate,
    floor,
    ceiling,
    freedomIndex: 1.0,
    smoothingFactor: 0.6,
    competitorWeights: profiles.reduce<Record<string, number>>((acc, comp) => {
      acc[comp.id] = 1 / profiles.length;
      return acc;
    }, {}),
    strategyDifferential: 0,
    overrides: {},
  };

  const nextState = AppStateSchema.parse({
    hotel: {
      id: "autumn-hotel",
      name: "Autumn Hotel",
      timezone: "UTC",
      currency: "USD",
      roomCount: TOTAL_ROOMS,
      pricingStrategy: strategy,
    },
    historicalAdr: baseRate,
    reservations,
    competitorProfiles: profiles,
    competitorRates: rates,
    dailyStats,
    prices: [],
    simulationStartDate: smartStart,
    activeStrategy: strategy,
    simulationStrategy: strategy,
    isSimulating: false,
    hasActiveStrategy: false,
  });

  await writeDb(nextState);
  revalidatePath("/");

  return { message: "Upload ingested successfully.", reservationCount: reservations.length };
}

export async function setManualOverrideRange(
  input: unknown,
): Promise<{ message: string; overrideCount: number }> {
  const parsed = ManualOverrideRangeSchema.parse(input) satisfies ManualOverrideRange;

  const start = parseISO(parsed.startDate);
  const end = parseISO(parsed.endDate);
  if (!isValid(start) || !isValid(end)) {
    throw new Error("Invalid date range.");
  }
  if (end < start) {
    throw new Error("endDate must be on or after startDate.");
  }

  const roundedPrice = Math.round(parsed.price);
  const daysInclusive = Math.max(0, differenceInCalendarDays(end, start));

  const state = await readDb();
  const baseStrategy = state.activeStrategy ?? state.hotel.pricingStrategy;
  const overrides: Record<string, number> = {
    ...(baseStrategy.overrides ?? {}),
  };

  for (let i = 0; i <= daysInclusive; i += 1) {
    const day = addDays(start, i);
    const date = format(day, "yyyy-MM-dd");
    overrides[date] = roundedPrice;
  }

  const updatedStrategy: PricingStrategy = {
    ...baseStrategy,
    overrides,
  };

  await setActiveStrategy(updatedStrategy);
  await setSimulationStrategy(updatedStrategy);
  await setSimulating(false);
  revalidatePath("/");

  return {
    message: "Manual override applied.",
    overrideCount: daysInclusive + 1,
  };
}
