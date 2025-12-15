'use client';

import { useMemo } from "react";
import { calculatePrice, calculateStage2Price } from "@/lib/pricing-engine";
import type { PricingStrategy } from "@/lib/schema";
import { useStore } from "@/lib/store";
import { PricingChart, type ChartDatum } from "@/components/dashboard/PricingChart";
import type { EnrichedDailyStat } from "@/lib/data-service";

type DailyPricingPanelProps = {
  stats: EnrichedDailyStat[];
  historicalAdr: number;
  hasActiveStrategy: boolean;
};

type PricePoint = {
  finalPrice: number;
  trace: ReturnType<typeof calculatePrice>;
};

function computeCalendar(
  stats: EnrichedDailyStat[],
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
    const previousDayPrice = idx === 0 ? null : stage2Prices[idx - 1] ?? null;
    const nextDayPrice =
      idx === stage2Prices.length - 1 ? null : stage2Prices[idx + 1] ?? null;

    const trace = calculatePrice({
      date: day.date,
      historicalAdr,
      occupancyPct: day.occupancyPct,
      competitorRates: day.competitorRates,
      previousDayPrice,
      nextDayPrice,
      strategy,
    });

    return {
      finalPrice: trace.guardrails.finalPrice,
      trace,
    };
  });
}

export function DailyPricingPanel({
  stats,
  historicalAdr,
  hasActiveStrategy,
}: DailyPricingPanelProps) {
  const activeStrategy = useStore((state) => state.activeStrategy);
  const simulationStrategy = useStore((state) => state.simulationStrategy);
  const isSimulating = useStore((state) => state.isSimulating);

  const showSimulation = Boolean(isSimulating && simulationStrategy);

  const data = useMemo<ChartDatum[]>(() => {
    if (!activeStrategy || stats.length === 0) return [];
    const sim = simulationStrategy ?? activeStrategy;

    if (!hasActiveStrategy && !showSimulation) {
      return stats.map((day) => ({
        date: day.date,
        occupancyPct: day.occupancyPct,
        competitorAverage: day.competitorAverage,
        activePrice: null,
        simulatedPrice: null,
      }));
    }

    const activeCalendar = computeCalendar(stats, activeStrategy, historicalAdr);
    const simulatedCalendar = computeCalendar(stats, sim, historicalAdr);

    return stats.map((day, idx) => ({
      date: day.date,
      occupancyPct: day.occupancyPct,
      competitorAverage: day.competitorAverage,
      activePrice: hasActiveStrategy ? activeCalendar[idx]?.finalPrice ?? null : null,
      simulatedPrice: showSimulation ? simulatedCalendar[idx]?.finalPrice ?? null : null,
      activeTrace: hasActiveStrategy ? activeCalendar[idx]?.trace : undefined,
      simulatedTrace: showSimulation ? simulatedCalendar[idx]?.trace : undefined,
      activeOverrideApplied: hasActiveStrategy
        ? Boolean(activeCalendar[idx]?.trace.guardrails.overrideApplied)
        : false,
      simulatedOverrideApplied: showSimulation
        ? Boolean(simulatedCalendar[idx]?.trace.guardrails.overrideApplied)
        : false,
    }));
  }, [
    activeStrategy,
    hasActiveStrategy,
    historicalAdr,
    showSimulation,
    simulationStrategy,
    stats,
  ]);

  if (!activeStrategy || stats.length === 0) return null;

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            30-Day Rate Outlook
          </div>
          <div className="text-sm text-slate-700">
            Active vs simulated daily rate
          </div>
        </div>
        {showSimulation ? (
          <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
            Simulating
          </span>
        ) : (
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
            Active
          </span>
        )}
      </div>

      <div className="mt-4">
        <PricingChart
          data={data}
          isSimulating={showSimulation}
          hasActiveStrategy={hasActiveStrategy}
        />
      </div>
    </section>
  );
}
