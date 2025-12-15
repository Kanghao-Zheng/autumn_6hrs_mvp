import { calculatePrice, calculateStage2Price } from "./pricing-engine";
import { getDailyStats } from "./data-service";
import { readDb } from "./db";
import {
  type PricePoint,
  type PricingStrategy,
  type PricingTrace,
} from "./schema";

function computeCalendar(
  stats: Awaited<ReturnType<typeof getDailyStats>>,
  strategy: PricingStrategy,
  historicalAdr: number,
): PricePoint[] {
  const stage2Prices = stats.map((day) =>
    calculateStage2Price({
      historicalAdr,
      occupancyPct: day.occupancyPct,
      competitorRates: day.competitorRates,
      strategy,
    }),
  );

  return stats.map((day, idx) => {
    const previousDayPrice = idx === 0 ? null : stage2Prices[idx - 1];
    const nextDayPrice =
      idx === stage2Prices.length - 1 ? null : stage2Prices[idx + 1];

    const trace: PricingTrace = calculatePrice({
      date: day.date,
      historicalAdr,
      occupancyPct: day.occupancyPct,
      competitorRates: day.competitorRates,
      previousDayPrice,
      nextDayPrice,
      strategy,
    });

    return {
      date: day.date,
      anchorPrice: trace.marketAnchor.basePrice,
      stage2Price: trace.yieldMultiplier.priceAfterMultiplier,
      smoothedPrice: trace.shoulderSmoothing.smoothedPrice,
      clampedPrice: trace.guardrails.clampedPrice,
      finalPrice: trace.guardrails.finalPrice,
      trace,
    };
  });
}

export async function generatePricingCalendar(
  startDate: Date | string,
  days: number,
  strategyOverride?: PricingStrategy,
): Promise<PricePoint[]> {
  const state = await readDb();
  const stats = await getDailyStats(startDate, days);
  const strategy =
    strategyOverride ??
    state.activeStrategy ??
    state.hotel.pricingStrategy;

  const historicalAdr =
    typeof state.historicalAdr === "number" && state.historicalAdr > 0
      ? state.historicalAdr
      : strategy.baseRate;

  return computeCalendar(stats, strategy, historicalAdr);
}

export async function generatePricingCalendarsForState(
  startDate: Date | string,
  days: number,
) {
  const state = await readDb();
  const stats = await getDailyStats(startDate, days);
  const activeStrategy = state.activeStrategy ?? state.hotel.pricingStrategy;
  const simulationStrategy =
    state.simulationStrategy ?? state.activeStrategy ?? state.hotel.pricingStrategy;

  const historicalAdr =
    typeof state.historicalAdr === "number" && state.historicalAdr > 0
      ? state.historicalAdr
      : activeStrategy.baseRate;

  return {
    stats,
    active: computeCalendar(stats, activeStrategy, historicalAdr),
    simulation: computeCalendar(stats, simulationStrategy, historicalAdr),
    isSimulating: state.isSimulating,
  };
}
