'use client';

import { Anchor, Shield, TrendingUp, Waves } from "lucide-react";
import type { PricingTrace } from "@/lib/schema";

type PriceBreakdownCardProps = {
  date: string;
  trace: PricingTrace;
};

function formatCurrency(value: number) {
  const rounded = Math.round(value);
  const abs = Math.abs(rounded);
  return `${rounded < 0 ? "-" : ""}$${abs}`;
}

function formatDelta(value: number) {
  const rounded = Math.round(value);
  const abs = Math.abs(rounded);
  return `${rounded >= 0 ? "+" : "-"}$${abs}`;
}

function formatMultiplier(value: number) {
  return `${value.toFixed(2)}x`;
}

function formatPct(value: number) {
  return `${Math.round(value)}%`;
}

export function PriceBreakdownCard({ date, trace }: PriceBreakdownCardProps) {
  const EPS = 0.01;
  const hitFloor =
    Math.abs(trace.guardrails.clampedPrice - trace.guardrails.floor) < EPS;
  const hitCeiling =
    Math.abs(trace.guardrails.clampedPrice - trace.guardrails.ceiling) < EPS;

  return (
    <div className="w-full rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        Price Explainer
      </div>
      <div className="text-sm text-slate-800">{date}</div>

      <div className="mt-4 space-y-3 text-sm text-slate-700">
        <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
          <div className="flex gap-2">
            <Anchor className="mt-0.5 h-4 w-4 text-slate-400" />
            <div className="min-w-0 flex-1">
              <div className="font-semibold text-slate-800">Market Anchor</div>
              <div className="mt-1 text-xs text-slate-600">
                Historical ADR {formatCurrency(trace.marketAnchor.historicalAdr)}
                {" | "}Weighted Avg{" "}
                {formatCurrency(trace.marketAnchor.weightedAverage)}
                {" | "}Diff{" "}
                {formatCurrency(trace.marketAnchor.strategyDifferential)}
                {" | "}Base {formatCurrency(trace.marketAnchor.basePrice)}
              </div>

              {trace.marketAnchor.smartWeights.length > 0 ? (
                <div className="mt-2 space-y-1 text-[11px] text-slate-600">
                  {trace.marketAnchor.smartWeights.map((row) => (
                    <div key={row.competitorId} className="flex justify-between">
                      <span className="truncate">{row.competitorId}</span>
                      <span>
                        {formatCurrency(row.rate)} {" | "}w{" "}
                        {Math.round(row.normalizedWeight * 100)}%
                      </span>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
          <div className="flex gap-2">
            <TrendingUp className="mt-0.5 h-4 w-4 text-slate-400" />
            <div className="min-w-0 flex-1">
              <div className="font-semibold text-slate-800">Yield</div>
              <div className="mt-1 text-xs text-slate-600">
                Occ {formatPct(trace.yieldMultiplier.occupancyPct)}
                {" | "}StageB {formatMultiplier(trace.yieldMultiplier.stageBMultiplier)}
                {" | "}Freedom {trace.yieldMultiplier.freedomIndex.toFixed(2)}
                {" | "}Effective{" "}
                {formatMultiplier(trace.yieldMultiplier.effectiveMultiplier)}
                {" | "}Price{" "}
                {formatCurrency(trace.yieldMultiplier.priceAfterMultiplier)}
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
          <div className="flex gap-2">
            <Waves className="mt-0.5 h-4 w-4 text-slate-400" />
            <div className="min-w-0 flex-1">
              <div className="font-semibold text-slate-800">Shoulder</div>
              <div className="mt-1 text-xs text-slate-600">
                Adj {formatDelta(trace.shoulderSmoothing.shoulderAdj)}
                {" | "}Smoothed{" "}
                {formatCurrency(trace.shoulderSmoothing.smoothedPrice)}
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
          <div className="flex gap-2">
            <Shield className="mt-0.5 h-4 w-4 text-slate-400" />
            <div className="min-w-0 flex-1">
              <div className="font-semibold text-slate-800">Guardrails</div>
              <div className="mt-1 text-xs text-slate-600">
                {hitFloor
                  ? `Clamped to Floor ${formatCurrency(trace.guardrails.floor)}`
                  : hitCeiling
                    ? `Clamped to Ceiling ${formatCurrency(trace.guardrails.ceiling)}`
                    : "Within Floor/Ceiling"}
                {" | "}Final {formatCurrency(trace.guardrails.finalPrice)}
              </div>
              {trace.guardrails.overrideApplied ? (
                <div className="mt-2 text-[11px] text-slate-600">
                  Override applied:{" "}
                  {formatCurrency(trace.guardrails.overrideValue ?? 0)}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

