import { z } from "zod";

export const DateStringSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD formatted dates");

export const ReservationSchema = z.object({
  id: z.string().min(1, "Reservation id is required"),
  bookedAt: DateStringSchema.optional(),
  checkIn: DateStringSchema,
  checkOut: DateStringSchema,
  rooms: z.number().int().positive().default(1),
  adr: z.number().nonnegative(),
  channel: z.string().optional(),
});

export const CompetitorSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
});

export const CompetitorRateSchema = z.object({
  competitorId: z.string().min(1),
  date: DateStringSchema,
  rate: z.number().nonnegative(),
});

export const DailyStatSchema = z.object({
  date: DateStringSchema,
  roomsSold: z.number().int().nonnegative(),
  roomsAvailable: z.number().int().positive(),
  occupancyPct: z.number().min(0).max(100),
  adr: z.number().nonnegative().optional(),
  revPar: z.number().nonnegative().optional(),
  competitorAverage: z.number().nonnegative().optional(),
});

export const PricingStrategySchema = z
  .preprocess((input) => {
    if (!input || typeof input !== "object") return input;
    const raw = input as Record<string, unknown>;

    if (raw.freedomIndex == null && typeof raw.aggressiveness === "number") {
      // Migrate legacy `aggressiveness` -> `freedomIndex`.
      const { aggressiveness: legacyAggressiveness, ...rest } = raw as Record<
        string,
        unknown
      > & {
        aggressiveness?: unknown;
      };
      return { ...rest, freedomIndex: legacyAggressiveness };
    }

    return input;
  }, z
    .object({
      baseRate: z.number().nonnegative(),
      floor: z.number().nonnegative(),
      ceiling: z.number().nonnegative(),
      freedomIndex: z.number().min(0).max(1).default(1.0),
      smoothingFactor: z.number().min(0).max(1),
      competitorWeights: z.record(z.string(), z.number().nonnegative()),
      strategyDifferential: z.number(),
      overrides: z
        .record(DateStringSchema, z.number().nonnegative())
        .default({}),
    })
    .strict()
    .superRefine((value, ctx) => {
      if (value.floor > value.ceiling) {
        ctx.addIssue({
          code: "custom",
          path: ["floor"],
          message: "floor must be less than or equal to ceiling",
        });
      }
      if (value.baseRate < value.floor) {
        ctx.addIssue({
          code: "custom",
          path: ["baseRate"],
          message: "baseRate should not be below the floor",
        });
      }
      if (value.baseRate > value.ceiling) {
        ctx.addIssue({
          code: "custom",
          path: ["baseRate"],
          message: "baseRate should not exceed the ceiling",
        });
      }
    }));

export const ManualOverrideRangeSchema = z
  .object({
    startDate: DateStringSchema,
    endDate: DateStringSchema,
    price: z.number().nonnegative(),
  })
  .strict();

export const PricingEngineInputSchema = z.object({
  date: DateStringSchema,
  historicalAdr: z.number().nonnegative(),
  occupancyPct: z.number().min(0).max(100),
  competitorRates: z.array(CompetitorRateSchema),
  previousDayPrice: z.number().nonnegative().nullable(),
  nextDayPrice: z.number().nonnegative().nullable(),
  strategy: PricingStrategySchema,
});

export const SmartWeightTraceSchema = z.object({
  competitorId: z.string().min(1),
  rate: z.number().nonnegative(),
  distance: z.number().nonnegative(),
  rawWeight: z.number().nonnegative(),
  normalizedWeight: z.number().nonnegative(),
});

export const MarketAnchorTraceSchema = z.object({
  historicalAdr: z.number().nonnegative(),
  weightedAverage: z.number().nonnegative(),
  strategyDifferential: z.number(),
  smartWeights: z.array(SmartWeightTraceSchema),
  basePrice: z.number().nonnegative(),
});

export const YieldStepTraceSchema = z.object({
  occupancyPct: z.number().min(0).max(100),
  stageBMultiplier: z.number().nonnegative(),
  freedomIndex: z.number().min(0).max(1),
  effectiveMultiplier: z.number().nonnegative(),
  priceAfterMultiplier: z.number().nonnegative(),
});

export const ShoulderSmoothingTraceSchema = z.object({
  smoothingFactor: z.number().min(0).max(1),
  window: z.object({
    previous: z.number().nonnegative().nullable(),
    current: z.number().nonnegative(),
    next: z.number().nonnegative().nullable(),
  }),
  smoothedPrice: z.number().nonnegative(),
  shoulderAdj: z.number(),
});

export const GuardrailTraceSchema = z.object({
  floor: z.number().nonnegative(),
  ceiling: z.number().nonnegative(),
  clampedPrice: z.number().nonnegative(),
  overrideApplied: z.boolean(),
  overrideValue: z.number().nonnegative().nullable(),
  finalPrice: z.number().nonnegative(),
});

export const PricingTraceSchema = z.object({
  marketAnchor: MarketAnchorTraceSchema,
  yieldMultiplier: YieldStepTraceSchema,
  shoulderSmoothing: ShoulderSmoothingTraceSchema,
  guardrails: GuardrailTraceSchema,
});

export const PricePointSchema = z.object({
  date: DateStringSchema,
  anchorPrice: z.number().nonnegative(),
  stage2Price: z.number().nonnegative(),
  smoothedPrice: z.number().nonnegative(),
  clampedPrice: z.number().nonnegative(),
  finalPrice: z.number().nonnegative(),
  trace: PricingTraceSchema,
});

export const HotelConfigSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  timezone: z.string().min(1),
  currency: z.string().min(1),
  roomCount: z.number().int().positive(),
  pricingStrategy: PricingStrategySchema,
});

export const AppStateSchema = z.object({
  hotel: HotelConfigSchema,
  historicalAdr: z.number().nonnegative().default(0),
  reservations: z.array(ReservationSchema).default([]),
  competitorProfiles: z.array(CompetitorSchema).default([]),
  competitorRates: z.array(CompetitorRateSchema).default([]),
  dailyStats: z.array(DailyStatSchema).default([]),
  prices: z.array(PricePointSchema).default([]),
  simulationStartDate: DateStringSchema,
  activeStrategy: PricingStrategySchema,
  simulationStrategy: PricingStrategySchema,
  isSimulating: z.boolean(),
  hasActiveStrategy: z.boolean().default(false),
});

export type DateString = z.infer<typeof DateStringSchema>;
export type Reservation = z.infer<typeof ReservationSchema>;
export type Competitor = z.infer<typeof CompetitorSchema>;
export type CompetitorRate = z.infer<typeof CompetitorRateSchema>;
export type DailyStat = z.infer<typeof DailyStatSchema>;
export type PricingStrategy = z.infer<typeof PricingStrategySchema>;
export type ManualOverrideRange = z.infer<typeof ManualOverrideRangeSchema>;
export type PricingEngineInput = z.infer<typeof PricingEngineInputSchema>;
export type SmartWeightTrace = z.infer<typeof SmartWeightTraceSchema>;
export type MarketAnchorTrace = z.infer<typeof MarketAnchorTraceSchema>;
export type YieldStepTrace = z.infer<typeof YieldStepTraceSchema>;
export type ShoulderSmoothingTrace = z.infer<typeof ShoulderSmoothingTraceSchema>;
export type GuardrailTrace = z.infer<typeof GuardrailTraceSchema>;
export type PricingTrace = z.infer<typeof PricingTraceSchema>;
export type PricePoint = z.infer<typeof PricePointSchema>;
export type HotelConfig = z.infer<typeof HotelConfigSchema>;
export type AppState = z.infer<typeof AppStateSchema>;
