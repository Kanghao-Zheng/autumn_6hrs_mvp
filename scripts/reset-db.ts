import { promises as fs } from "fs";
import path from "path";
import { AppStateSchema } from "../lib/schema";

async function main() {
  const defaultStrategy = {
    baseRate: 150,
    floor: 80,
    ceiling: 450,
    freedomIndex: 1.0,
    smoothingFactor: 0.6,
    competitorWeights: {},
    strategyDifferential: 0,
    overrides: {},
  };

  const state = AppStateSchema.parse({
    hotel: {
      id: "autumn-hotel",
      name: "Autumn Hotel",
      timezone: "UTC",
      currency: "USD",
      roomCount: 15,
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

  const dbPath = path.join(process.cwd(), "db.json");
  await fs.writeFile(dbPath, JSON.stringify(state, null, 2), "utf-8");
  // eslint-disable-next-line no-console
  console.log(`Reset db.json to empty baseline: ${dbPath}`);
}

main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error(error);
  process.exitCode = 1;
});
