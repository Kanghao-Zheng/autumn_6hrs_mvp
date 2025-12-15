import {
  generateCompetitorRates,
  parseReservations,
  TOTAL_ROOMS,
  writeCompetitorsFile,
  findSmartViewport,
} from "./data-service";
import { parseISO, isValid } from "date-fns";
import { promises as fs } from "fs";
import path from "path";
import { writeDb } from "./db";
import { AppStateSchema, type AppState } from "./schema";

export async function seed(): Promise<AppState> {
  const { reservations, dailyStats, historicalAdr, minDate, maxDate } =
    await parseReservations(await resolveSeedCsvPath());
  const smartStart = findSmartViewport(reservations);

  const parsedMin = parseISO(minDate);
  const parsedMax = parseISO(maxDate);
  const rangeStart = isValid(parsedMin) ? parsedMin : new Date();
  const rangeEnd = isValid(parsedMax) ? parsedMax : rangeStart;

  const { profiles, rates } = generateCompetitorRates(rangeStart, rangeEnd, 90);

  await writeCompetitorsFile(rates);

  const floor = historicalAdr * 0.6;
  const ceiling = historicalAdr * 2;
  const baseRate = historicalAdr || 150;
  const strategy = {
    baseRate,
    floor,
    ceiling,
    freedomIndex: 0.2,
    smoothingFactor: 0.6,
    competitorWeights: profiles.reduce<Record<string, number>>(
      (acc, comp) => {
        acc[comp.id] = 1 / profiles.length;
        return acc;
      },
      {},
    ),
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
    historicalAdr,
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

  return writeDb(nextState);
}

async function resolveSeedCsvPath(): Promise<string> {
  const dataDir = path.join(process.cwd(), "data");
  const preferred = path.join(dataDir, "reservations.csv");
  const sample = path.join(dataDir, "reservations.sample.csv");

  try {
    await fs.access(preferred);
    return preferred;
  } catch {
    return sample;
  }
}
