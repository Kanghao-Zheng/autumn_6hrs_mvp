import {
  type CompetitorRate,
  type PricingEngineInput,
  type PricingTrace,
} from "./schema";

type Stage2Input = Omit<
  PricingEngineInput,
  "date" | "previousDayPrice" | "nextDayPrice"
>;

function computeSmartWeights(competitorRates: CompetitorRate[], historicalAdr: number) {
  if (competitorRates.length === 0) {
    return {
      weightedAverage: historicalAdr,
      breakdown: [] as Array<{
        competitorId: string;
        rate: number;
        distance: number;
        rawWeight: number;
        normalizedWeight: number;
      }>,
    };
  }

  const raw = competitorRates.map((rate) => {
    const distance = Math.abs(rate.rate - historicalAdr);
    const rawWeight = 1 / (distance + 1);
    return {
      competitorId: rate.competitorId,
      rate: rate.rate,
      distance,
      rawWeight,
    };
  });

  const totalRaw = raw.reduce((sum, row) => sum + row.rawWeight, 0);
  const safeTotal = totalRaw > 0 ? totalRaw : 1;

  const breakdown = raw.map((row) => ({
    ...row,
    normalizedWeight: row.rawWeight / safeTotal,
  }));

  const weightedAverage = breakdown.reduce(
    (sum, row) => sum + row.rate * row.normalizedWeight,
    0,
  );

  return { weightedAverage, breakdown };
}

function getStageBMultiplier(occupancyPct: number) {
  if (occupancyPct > 90) return 1.45;
  if (occupancyPct > 80) return 1.2;
  if (occupancyPct > 70) return 1.1;
  if (occupancyPct < 30) return 0.85;
  return 1.0;
}

function smoothShoulder(current: number, previous: number | null, next: number | null) {
  if (previous == null || next == null) {
    return { smoothedPrice: current, shoulderAdj: 0 };
  }

  const smoothedPrice = previous * 0.2 + current * 0.6 + next * 0.2;
  return { smoothedPrice, shoulderAdj: smoothedPrice - current };
}

function calculateStage2(input: Stage2Input) {
  const { occupancyPct, competitorRates, strategy, historicalAdr } = input;

  // Stage A: Market Anchor (Inverse Distance Weighting vs Historical ADR)
  const { weightedAverage: weightedFromCompetitors, breakdown } = computeSmartWeights(
    competitorRates,
    historicalAdr,
  );

  const weightedAverage =
    competitorRates.length > 0 ? weightedFromCompetitors : strategy.baseRate;

  const basePrice = weightedAverage + strategy.strategyDifferential;
  const marketAnchor: PricingTrace["marketAnchor"] = {
    historicalAdr,
    weightedAverage,
    strategyDifferential: strategy.strategyDifferential,
    smartWeights: breakdown.map((row) => ({
      competitorId: row.competitorId,
      rate: row.rate,
      distance: row.distance,
      rawWeight: row.rawWeight,
      normalizedWeight: row.normalizedWeight,
    })),
    basePrice,
  };

  // Stage B: Yield Multiplier (Hockey Stick)
  const stageBMultiplier = getStageBMultiplier(occupancyPct);

  // Stage C: AI Freedom Index (Intensity) applied before smoothing
  const freedomIndex = Math.max(0, Math.min(1, strategy.freedomIndex ?? 1.0));
  const effectiveMultiplier = 1 + (stageBMultiplier - 1) * freedomIndex;
  const priceAfterMultiplier = basePrice * effectiveMultiplier;

  const yieldMultiplier: PricingTrace["yieldMultiplier"] = {
    occupancyPct,
    stageBMultiplier,
    freedomIndex,
    effectiveMultiplier,
    priceAfterMultiplier,
  };

  return { marketAnchor, yieldMultiplier, stage2Price: priceAfterMultiplier };
}

export function calculateStage2Price(input: Stage2Input) {
  return calculateStage2(input).stage2Price;
}

export function calculatePrice(input: PricingEngineInput): PricingTrace {
  const { date, strategy } = input;
  const { marketAnchor, yieldMultiplier, stage2Price } = calculateStage2(input);

  // Stage 3: Shoulder Smoothing (Adjacency) applied to Stage 2 price
  const { smoothedPrice, shoulderAdj } = smoothShoulder(
    stage2Price,
    input.previousDayPrice,
    input.nextDayPrice,
  );

  const shoulderSmoothing: PricingTrace["shoulderSmoothing"] = {
    smoothingFactor: strategy.smoothingFactor,
    window: {
      previous: input.previousDayPrice,
      current: stage2Price,
      next: input.nextDayPrice,
    },
    smoothedPrice,
    shoulderAdj,
  };

  // Stage 4: Guardrails & Overrides (Clamps First, Overrides Last)
  const clampedPrice = Math.max(strategy.floor, Math.min(strategy.ceiling, smoothedPrice));

  const overrideValue = strategy.overrides?.[date];
  const preRoundedFinal = overrideValue != null ? overrideValue : clampedPrice;
  const roundedFinal = Math.round(preRoundedFinal);

  const floorInt = Math.ceil(strategy.floor);
  const ceilingInt = Math.floor(strategy.ceiling);
  const safeCeilingInt = ceilingInt >= floorInt ? ceilingInt : floorInt;

  const finalPrice =
    overrideValue != null
      ? roundedFinal
      : Math.max(floorInt, Math.min(safeCeilingInt, roundedFinal));

  const guardrails: PricingTrace["guardrails"] = {
    floor: strategy.floor,
    ceiling: strategy.ceiling,
    clampedPrice,
    overrideApplied: overrideValue != null,
    overrideValue: overrideValue ?? null,
    finalPrice,
  };

  return {
    marketAnchor,
    yieldMultiplier,
    shoulderSmoothing,
    guardrails,
  };
}

