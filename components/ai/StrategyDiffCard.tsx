'use client';

import { useEffect, useMemo, useState } from "react";
import { ArrowDownRight, ArrowUpRight, Check, Loader2 } from "lucide-react";
import { useActions, useUIState } from "ai/rsc";
import { useRouter } from "next/navigation";
import { applyStrategyChange } from "@/lib/actions";
import type { AIProvider } from "@/app/action";
import { useStore } from "@/lib/store";
import type { PricingStrategy } from "@/lib/schema";

type StrategyDiffCardProps = {
  currentConfig: PricingStrategy;
  proposedConfig: PricingStrategy;
  benchmarkCompetitorAvg?: number | null;
  historicalAvgRate?: number | null;
  proposedMarketBase?: number | null;
  oldPrice?: number | null;
  newPrice?: number | null;
  onApprove?: (proposed: PricingStrategy) => void | Promise<void>;
  onReject?: () => void | Promise<void>;
};

function formatCurrency(value: number) {
  return `$${Math.round(value).toLocaleString()}`;
}

function formatMaybeCurrency(value?: number | null) {
  if (value == null || !Number.isFinite(value)) return "-";
  return formatCurrency(value);
}

function formatSignedCurrency(value?: number | null) {
  if (value == null || !Number.isFinite(value)) return "-";
  const rounded = Math.round(value);
  const abs = Math.abs(rounded);
  return `${rounded >= 0 ? "+" : "-"}$${abs.toLocaleString()}`;
}

export function StrategyDiffCard({
  currentConfig,
  proposedConfig,
  benchmarkCompetitorAvg,
  historicalAvgRate,
  proposedMarketBase,
  oldPrice,
  newPrice,
  onApprove,
  onReject,
}: StrategyDiffCardProps) {
  const router = useRouter();
  const { submitUserMessage } = useActions<AIProvider>();
  const [, setMessages] = useUIState<AIProvider>();
  const [isApproving, setIsApproving] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);
  const setSimulationStrategy = useStore((state) => state.setSimulationStrategy);
  const resetSimulation = useStore((state) => state.resetSimulation);

  const hasChanges = useMemo(() => {
    try {
      return JSON.stringify(currentConfig) !== JSON.stringify(proposedConfig);
    } catch {
      return true;
    }
  }, [currentConfig, proposedConfig]);

  useEffect(() => {
    if (!hasChanges) return;
    setSimulationStrategy(proposedConfig);
  }, [hasChanges, proposedConfig, setSimulationStrategy]);

  const yieldImpact =
    typeof newPrice === "number" && typeof proposedMarketBase === "number"
      ? newPrice - proposedMarketBase
      : null;

  const showHistoricalComparison = useMemo(() => {
    if (typeof historicalAvgRate !== "number" || typeof newPrice !== "number") return false;
    if (!Number.isFinite(historicalAvgRate) || !Number.isFinite(newPrice)) return false;
    return Math.round(historicalAvgRate) !== Math.round(newPrice);
  }, [historicalAvgRate, newPrice]);

  const showAvgComparison = useMemo(() => {
    if (typeof oldPrice !== "number" || typeof newPrice !== "number") return false;
    if (!Number.isFinite(oldPrice) || !Number.isFinite(newPrice)) return false;
    return Math.round(oldPrice) !== Math.round(newPrice);
  }, [newPrice, oldPrice]);

  const avgDelta =
    typeof oldPrice === "number" && typeof newPrice === "number"
      ? newPrice - oldPrice
      : null;

  return (
    <div className="w-full rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Strategy Proposal
          </div>
          <div className="text-sm text-slate-600">Pricing impact preview</div>
        </div>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
          Proposal
        </span>
      </div>

      <div className="mt-4 rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <div className="text-sm font-semibold text-slate-800">Final Price</div>
          <div className="flex items-center gap-2">
            {showHistoricalComparison ? (
              <>
                <span className="rounded-full bg-red-50 px-3 py-1 text-sm font-semibold text-red-700 line-through">
                  {formatMaybeCurrency(historicalAvgRate ?? null)}
                </span>
                <span className="text-slate-400">-&gt;</span>
                <span className="rounded-full bg-emerald-50 px-3 py-1 text-sm font-semibold text-emerald-700">
                  {formatMaybeCurrency(newPrice ?? null)}
                </span>
              </>
            ) : (
              <span className="rounded-full bg-emerald-50 px-3 py-1 text-sm font-semibold text-emerald-700">
                {formatMaybeCurrency(newPrice ?? historicalAvgRate ?? null)}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-4">
        <div className="flex flex-col justify-between rounded-xl border border-slate-100 bg-slate-50 p-4">
          <div>
            <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Benchmark
            </div>
            <div className="text-2xl font-bold text-slate-900">
              {formatMaybeCurrency(benchmarkCompetitorAvg ?? null)}
            </div>
          </div>
          <div className="mt-1 text-xs text-slate-400">Competitor Avg</div>
        </div>

        <div className="flex flex-col justify-between rounded-xl border border-slate-100 bg-slate-50 p-4">
          <div>
            <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Yield Impact
            </div>
            <div className="text-2xl font-bold text-slate-900">
              {formatSignedCurrency(yieldImpact)}
            </div>
          </div>
          <div className="mt-1 text-xs text-slate-400">New Avg - Market Base</div>
        </div>

        <div className="flex flex-col justify-between rounded-xl border border-slate-100 bg-slate-50 p-4">
          <div>
            <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Final Avg Rate
            </div>
            {showAvgComparison ? (
              <div className="flex items-baseline">
                <span className="mr-2 text-lg font-semibold text-red-400 line-through">
                  {formatMaybeCurrency(oldPrice ?? null)}
                </span>
                <span className="text-2xl font-bold text-emerald-600">
                  {formatMaybeCurrency(newPrice ?? null)}
                </span>
              </div>
            ) : (
              <div className="text-2xl font-bold text-slate-900">
                {formatMaybeCurrency(newPrice ?? oldPrice ?? null)}
              </div>
            )}

            {showAvgComparison &&
            typeof avgDelta === "number" &&
            Number.isFinite(avgDelta) &&
            Math.abs(avgDelta) > 0.01 ? (
              <div
                className={[
                  "mt-2 flex items-center gap-1 text-xs font-medium",
                  avgDelta >= 0 ? "text-emerald-600" : "text-red-600",
                ].join(" ")}
              >
                {avgDelta >= 0 ? (
                  <ArrowUpRight className="h-3.5 w-3.5" />
                ) : (
                  <ArrowDownRight className="h-3.5 w-3.5" />
                )}
                {formatSignedCurrency(avgDelta)}
              </div>
            ) : null}
          </div>
          <div className="mt-1 text-xs text-slate-400">30-Day Avg Rate</div>
        </div>
      </div>

      <div className="mt-4 flex items-center gap-3">
        <button
          type="button"
          disabled={!hasChanges || isApproving || isRejecting}
          onClick={async () => {
            setIsApproving(true);
            try {
              if (onApprove) {
                await onApprove(proposedConfig);
                return;
              }

              await applyStrategyChange(proposedConfig);
              const response = await submitUserMessage(
                "I approved the strategy. Please confirm the update.",
              );
              setMessages((current) => [...current, response]);
              router.refresh();
            } finally {
              setIsApproving(false);
            }
          }}
          className="inline-flex items-center justify-center gap-2 rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-emerald-300"
        >
          {isApproving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Check className="h-4 w-4" />
          )}
          Approve Changes
        </button>
        <button
          type="button"
          disabled={isApproving || isRejecting}
          onClick={async () => {
            resetSimulation();
            setIsRejecting(true);
            try {
              if (onReject) {
                await onReject();
                return;
              }

              const response = await submitUserMessage(
                "I rejected the strategy. Please ask me what to adjust.",
              );
              setMessages((current) => [...current, response]);
            } finally {
              setIsRejecting(false);
            }
          }}
          className="inline-flex items-center justify-center rounded-md border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Reject
        </button>
        {!hasChanges ? (
          <span className="text-xs text-slate-500">Adjust parameters to see a diff.</span>
        ) : null}
      </div>
    </div>
  );
}
