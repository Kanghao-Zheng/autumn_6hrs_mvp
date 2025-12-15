'use client';

import { useMemo } from "react";
import type { PricingStrategy } from "@/lib/schema";

type StrategyControlsProps = {
  strategy: PricingStrategy;
  onChange: (next: PricingStrategy) => void;
};

const numberField =
  "w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-300";
const labelField = "text-sm font-medium text-slate-700";

export function StrategyControls({ strategy, onChange }: StrategyControlsProps) {
  const formattedWeights = useMemo(
    () =>
      Object.entries(strategy.competitorWeights)
        .map(([id, weight]) => `${id}: ${(weight * 100).toFixed(0)}%`)
        .join(" · "),
    [strategy.competitorWeights],
  );

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Strategy
        </div>
        <p className="text-sm text-slate-600">
          Tune guardrails and sensitivity. Changes update the simulation line in
          real time.
        </p>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <label className={labelField} htmlFor="baseRate">
            Base Rate
          </label>
          <input
            id="baseRate"
            type="number"
            className={numberField}
            value={strategy.baseRate}
            onChange={(e) =>
              onChange({ ...strategy, baseRate: Number(e.target.value) || 0 })
            }
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <label className={labelField} htmlFor="floor">
              Floor
            </label>
            <input
              id="floor"
              type="number"
              className={numberField}
              value={strategy.floor}
              onChange={(e) =>
                onChange({ ...strategy, floor: Number(e.target.value) || 0 })
              }
            />
          </div>
          <div className="space-y-2">
            <label className={labelField} htmlFor="ceiling">
              Ceiling
            </label>
            <input
              id="ceiling"
              type="number"
              className={numberField}
              value={strategy.ceiling}
              onChange={(e) =>
                onChange({ ...strategy, ceiling: Number(e.target.value) || 0 })
              }
            />
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className={labelField} htmlFor="freedomIndex">
              Freedom Index
            </label>
            <span className="text-sm text-slate-600">
              {strategy.freedomIndex.toFixed(2)}
            </span>
          </div>
          <input
            id="freedomIndex"
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={strategy.freedomIndex}
            onChange={(e) =>
              onChange({
                ...strategy,
                freedomIndex: Number(e.target.value),
              })
            }
            className="w-full accent-blue-600"
          />
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className={labelField} htmlFor="smoothingFactor">
              Smoothing
            </label>
            <span className="text-sm text-slate-600">
              {strategy.smoothingFactor.toFixed(2)}
            </span>
          </div>
          <input
            id="smoothingFactor"
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={strategy.smoothingFactor}
            onChange={(e) =>
              onChange({
                ...strategy,
                smoothingFactor: Number(e.target.value),
              })
            }
            className="w-full accent-indigo-600"
          />
        </div>
      </div>

      <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
        <div className="font-semibold text-slate-700">Weights</div>
        <div className="mt-1">{formattedWeights || "Equal weighting"}</div>
      </div>
    </div>
  );
}

