import { createAI, getMutableAIState, streamUI } from "ai/rsc";
import { openai } from "@ai-sdk/openai";
import { z } from "zod";
import { addDays, isValid, parseISO } from "date-fns";
import { readDb } from "@/lib/db";
import { setManualOverrideRange } from "@/lib/actions";
import { calculatePrice, calculateStage2Price } from "@/lib/pricing-engine";
import { getDailyStats } from "@/lib/data-service";
import { generatePricingCalendar } from "@/lib/pricing-service";
import { PriceBreakdownCard } from "@/components/ai/PriceBreakdownCard";
import { StrategyDiffCard } from "@/components/ai/StrategyDiffCard";
import { ThinkingBlock } from "@/components/ai/ThinkingBlock";
import { ManualOverrideCard } from "@/components/ai/ManualOverrideCard";
import { ManualOverrideRangeSchema, type PricingStrategy } from "@/lib/schema";

export type AIMessage = {
  role: "user" | "assistant" | "system" | "function";
  content: string;
  id?: string;
  name?: string;
};

export type UIMessage = { id: number; display: React.ReactNode };

const SYSTEM_PROMPT = `
You are Autumn, the AI Revenue Manager. You operate a Neuro-Symbolic Pricing Engine.

CONTEXT:
You have read/write access to the hotel's "Pricing Strategy".
You do NOT set prices directly. You adjust the parameters.

YOUR COGNITIVE ARCHITECTURE (Streaming Checklist):
Before calling any tool, you MUST stream a checklist using this exact format:
STEP: Analyzing the user's intent
STEP: Checking occupancy trends
STEP: Comparing competitor rates
STEP: Selecting the best strategy knobs
STEP: Preparing the tool call

Rules:
- Each step must be on its own line starting with "STEP:"
- Keep it concise (3-6 steps)
- After the checklist, call the appropriate tool.

TOOL USAGE RULES:
1. propose_strategy: Use this to change outcomes.
2. price_explainer: Use this when asked "Why".
3. set_manual_override: Use this when the user asks to set a hard price for a specific date.

FREEDOM INDEX RULE:
- Do not attempt to change the Freedom Index. That is a user-only setting.

INTERACTION LOOP:
- If the user says they approved: reply with a short confirmation and ask what to optimize next.
- If the user says they rejected: ask a single clarifying question and do not call tools yet.

TONE:
- Professional and concise.
- Avoid filler like "I have successfully...". Prefer short confirmations.

OUTPUT FORMAT:
- Do not output raw JSON. Use the provided UI tools.
`;

function average(values: number[]): number | null {
  const filtered = values.filter((value) => Number.isFinite(value));
  if (filtered.length === 0) return null;
  const sum = filtered.reduce((acc, value) => acc + value, 0);
  return sum / filtered.length;
}

async function buildStrategyMetrics(args: {
  startDate: string;
  strategy: PricingStrategy;
  proposed: PricingStrategy;
}) {
  const days = 30;
  const stats = await getDailyStats(args.startDate, days);

  const historicalTotals = stats.reduce(
    (acc, day) => {
      if (typeof day.adr !== "number" || !Number.isFinite(day.adr)) return acc;
      if (day.roomsSold <= 0) return acc;
      acc.revenue += day.adr * day.roomsSold;
      acc.roomsSold += day.roomsSold;
      return acc;
    },
    { revenue: 0, roomsSold: 0 },
  );

  const historicalAvgRate =
    historicalTotals.roomsSold > 0
      ? historicalTotals.revenue / historicalTotals.roomsSold
      : null;

  const competitorAvg = average(
    stats
      .map((day) => {
        if (typeof day.competitorAverage === "number") return day.competitorAverage;
        if (day.competitorRates.length === 0) return null;
        return average(day.competitorRates.map((rate) => rate.rate));
      })
      .filter((value): value is number => typeof value === "number"),
  );

  const [currentCalendar, proposedCalendar] = await Promise.all([
    generatePricingCalendar(args.startDate, days, args.strategy),
    generatePricingCalendar(args.startDate, days, args.proposed),
  ]);

  const proposedMarketBase = average(
    proposedCalendar.map((point) => point.trace.marketAnchor.basePrice),
  );

  return {
    competitorAvg,
    historicalAvgRate,
    oldPrice: average(currentCalendar.map((point) => point.finalPrice)),
    newPrice: average(proposedCalendar.map((point) => point.finalPrice)),
    proposedMarketBase,
  };
}

async function submitUserMessage(content: string): Promise<UIMessage> {
  "use server";

  const aiState = getMutableAIState<typeof AI>();
  aiState.update([...aiState.get(), { role: "user", content }]);

  const db = await readDb();
  const defaultStrategy: PricingStrategy = {
    baseRate: 200,
    floor: 100,
    ceiling: 500,
    freedomIndex: 1,
    smoothingFactor: 0.5,
    competitorWeights: { marriott: 0.33, hilton: 0.33, boutique: 0.33 },
    strategyDifferential: 0,
    overrides: {},
  };

  const strategy = db.activeStrategy || db.hotel?.pricingStrategy || defaultStrategy;

  const result = await streamUI({
    model: openai("gpt-4o"),
    initial: <ThinkingBlock content="STEP: Connecting to Autumn..." isStreaming />,
    messages: [
      {
        role: "system",
        content: `${SYSTEM_PROMPT}\n\nCURRENT CONFIG: ${JSON.stringify(strategy)}`,
      },
      ...aiState.get(),
    ],
    text: ({ content: reasoning, done }) => (
      <ThinkingBlock content={reasoning} isStreaming={!done} />
    ),
    tools: {
      propose_strategy: {
        description: "Propose a change to pricing strategy",
        parameters: z
          .object({
            baseRate: z.number().optional(),
            floor: z.number().optional(),
            ceiling: z.number().optional(),
            smoothingFactor: z.number().min(0).max(1).optional(),
            strategyDifferential: z.number().optional(),
            competitorWeights: z.record(z.number()).optional(),
            overrides: z.record(z.number()).optional(),
            reasoning: z.string().optional(),
          })
          .strict(),
        generate: async (partial) => {
          const { reasoning: _reasoning, ...partialConfig } = partial;
          const proposed = { ...strategy, ...partialConfig };
          const metrics = await buildStrategyMetrics({
            startDate: db.simulationStartDate,
            strategy,
            proposed,
          });

          return (
            <StrategyDiffCard
              currentConfig={strategy}
              proposedConfig={proposed}
              benchmarkCompetitorAvg={metrics.competitorAvg}
              historicalAvgRate={metrics.historicalAvgRate}
              oldPrice={metrics.oldPrice}
              newPrice={metrics.newPrice}
              proposedMarketBase={metrics.proposedMarketBase}
            />
          );
        },
      },
      price_explainer: {
        description: "Explain price for a date",
        parameters: z
          .object({
            date: z.string(),
          })
          .strict(),
        generate: async ({ date }) => {
          const historicalAdr =
            typeof db.historicalAdr === "number" && db.historicalAdr > 0
              ? db.historicalAdr
              : strategy.baseRate;

          const parsed = parseISO(date);
          if (!isValid(parsed)) return <div>Invalid date</div>;

          const windowStart = addDays(parsed, -1);
          const stats = await getDailyStats(windowStart, 3);
          const targetIndex = stats.findIndex((day) => day.date === date);
          const stat = stats[targetIndex];

          if (!stat) return <div>No data available</div>;

          const stage2 = stats.map((day) =>
            calculateStage2Price({
              historicalAdr,
              occupancyPct: day.occupancyPct,
              competitorRates: day.competitorRates,
              strategy,
            }),
          );

          const previousDayPrice =
            targetIndex > 0 ? stage2[targetIndex - 1] : null;
          const nextDayPrice =
            targetIndex < stage2.length - 1 ? stage2[targetIndex + 1] : null;

          const trace = calculatePrice({
            date,
            historicalAdr,
            occupancyPct: stat.occupancyPct,
            competitorRates: stat.competitorRates,
            previousDayPrice,
            nextDayPrice,
            strategy,
          });
          return <PriceBreakdownCard date={date} trace={trace} />;
        },
      },
      set_manual_override: {
        description: "Set a manual override price for a date",
        parameters: ManualOverrideRangeSchema,
        generate: async ({ startDate, endDate, price }) => {
          const start = parseISO(startDate);
          const end = parseISO(endDate);
          if (!isValid(start) || !isValid(end)) return <div>Invalid date</div>;

          const overrideValue = Math.round(price);
          await setManualOverrideRange({
            startDate,
            endDate,
            price: overrideValue,
          });

          return (
            <ManualOverrideCard
              startDate={startDate}
              endDate={endDate}
              price={overrideValue}
            />
          );
        },
      },
    },
  });

  aiState.done([...aiState.get(), { role: "assistant", content: "" }]);
  return {
    id: Date.now(),
    display: result.value,
  };
}

async function resetConversation(): Promise<void> {
  "use server";
  const aiState = getMutableAIState<typeof AI>();
  aiState.done([]);
}

export const AI = createAI<
  AIMessage[],
  UIMessage[],
  { submitUserMessage: typeof submitUserMessage; resetConversation: typeof resetConversation }
>({
  actions: {
    submitUserMessage,
    resetConversation,
  },
  initialUIState: [],
  initialAIState: [],
});

export type AIProvider = typeof AI;
