'use client';

import { useEffect } from "react";
import { X } from "lucide-react";
import type { PricingStrategy } from "@/lib/schema";

type SettingsModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  strategy: PricingStrategy;
  onChange: (next: PricingStrategy) => void;
};

const numberField =
  "w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-300";
const labelField = "text-sm font-medium text-slate-700";

export function SettingsModal({
  open,
  onOpenChange,
  strategy,
  onChange,
}: SettingsModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onOpenChange(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onOpenChange]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"
      onMouseDown={() => onOpenChange(false)}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-5 shadow-xl"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Strategy Settings
            </div>
            <div className="text-lg font-semibold text-slate-900">
              Tune the guardrails
            </div>
            <div className="text-sm text-slate-600">
              Changes update the simulated line immediately.
            </div>
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="rounded-md p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
            aria-label="Close settings"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-5 space-y-5">
          <div className="space-y-2">
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
              className="w-full accent-orange-600"
            />
          </div>

          <div className="space-y-2">
            <label className={labelField} htmlFor="strategyDifferential">
              Strategy Differential
            </label>
            <input
              id="strategyDifferential"
              type="number"
              className={numberField}
              value={strategy.strategyDifferential}
              onChange={(e) =>
                onChange({
                  ...strategy,
                  strategyDifferential: Number(e.target.value) || 0,
                })
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
                  onChange({
                    ...strategy,
                    ceiling: Number(e.target.value) || 0,
                  })
                }
              />
            </div>
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-slate-800"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

