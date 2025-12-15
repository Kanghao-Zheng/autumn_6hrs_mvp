'use client';

import { useEffect, useMemo, useState, useTransition, type ReactNode } from "react";
import { Info } from "lucide-react";
import { useRouter } from "next/navigation";
import type { PricingStrategy } from "@/lib/schema";
import { applyStrategyChange, resetDB } from "@/lib/actions";
import { useStore } from "@/lib/store";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

type SettingsDialogProps = {
  trigger: ReactNode;
};

const numberField =
  "w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-300";
const labelField = "text-sm font-medium text-slate-800";

const DEFAULT_STRATEGY: PricingStrategy = {
  baseRate: 150,
  floor: 80,
  ceiling: 450,
  freedomIndex: 1.0,
  smoothingFactor: 0.6,
  competitorWeights: {},
  strategyDifferential: 0,
  overrides: {},
};

export function SettingsDialog({ trigger }: SettingsDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [toast, setToast] = useState<
    | { kind: "success" | "error" | "info"; message: string }
    | null
  >(null);
  const [pendingSave, startSave] = useTransition();
  const [pendingReset, startReset] = useTransition();

  const simulationStrategy = useStore((state) => state.simulationStrategy);
  const activeStrategy = useStore((state) => state.activeStrategy);
  const patchSimulationStrategy = useStore(
    (state) => state.patchSimulationStrategy,
  );
  const resetSimulation = useStore((state) => state.resetSimulation);
  const setActiveStrategy = useStore((state) => state.setActiveStrategy);

  const strategy = simulationStrategy ?? activeStrategy ?? DEFAULT_STRATEGY;
  const isHydrated = Boolean(simulationStrategy || activeStrategy);

  const hasUnsavedChanges = useMemo(() => {
    if (!activeStrategy) return false;
    const keys: Array<keyof PricingStrategy> = [
      "freedomIndex",
      "smoothingFactor",
      "floor",
      "ceiling",
      "strategyDifferential",
    ];
    return keys.some((key) => activeStrategy[key] !== strategy[key]);
  }, [activeStrategy, strategy]);

  useEffect(() => {
    if (!toast) return;
    if (toast.kind === "info") return;
    const timer = window.setTimeout(() => setToast(null), 3500);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    if (!open) {
      setToast(null);
    }
  }, [open]);

  const updateNumber = (key: keyof PricingStrategy, value: string) => {
    const next = Number(value);
    patchSimulationStrategy({
      [key]: Number.isFinite(next) ? next : 0,
    } as Partial<PricingStrategy>);
  };

  const saveChanges = () => {
    startSave(async () => {
      try {
        setToast({ kind: "info", message: "Saving strategy..." });
        await applyStrategyChange(strategy);
        setActiveStrategy(strategy);
        resetSimulation();
        setToast({ kind: "success", message: "Strategy saved." });
        router.refresh();
        setOpen(false);
      } catch (error) {
        setToast({
          kind: "error",
          message: error instanceof Error ? error.message : "Save failed.",
        });
      }
    });
  };

  const doReset = () => {
    startReset(async () => {
      try {
        setToast({ kind: "info", message: "Resetting system..." });
        await resetDB();
        setActiveStrategy(DEFAULT_STRATEGY);
        setToast({
          kind: "success",
          message: "System reset to factory settings.",
        });
        setTimeout(() => {
          setOpen(false);
          router.refresh();
        }, 600);
      } catch (error) {
        setToast({
          kind: "error",
          message: error instanceof Error ? error.message : "Reset failed.",
        });
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-xl p-0">
        <div className="rounded-xl bg-white">
          <DialogHeader className="border-b border-slate-200 px-6 py-5">
            <DialogTitle>Strategy Configuration</DialogTitle>
            <DialogDescription>
              Tune AI sensitivity and hard pricing guardrails.
            </DialogDescription>
          </DialogHeader>

          {toast ? (
            <div className="px-6 pt-4">
              <div
                className={[
                  "rounded-lg px-3 py-2 text-xs font-medium",
                  toast.kind === "success"
                    ? "border border-emerald-200 bg-emerald-50 text-emerald-700"
                    : toast.kind === "error"
                      ? "border border-red-200 bg-red-50 text-red-700"
                      : "border border-slate-200 bg-slate-50 text-slate-700",
                ].join(" ")}
              >
                {toast.message}
              </div>
            </div>
          ) : null}

          <div className="space-y-6 px-6 py-5">
            <section className="space-y-4">
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  AI Parameters
                </div>
                <div className="mt-1 text-sm text-slate-600">
                  Controls how the engine responds to demand signals.
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <label className={labelField} htmlFor="freedomIndex">
                    AI Freedom Index
                  </label>
                  <div className="flex items-center gap-2">
                    <span
                      className="inline-flex"
                      title="Controls how aggressively the AI yields price based on demand."
                    >
                      <Info className="h-4 w-4 text-slate-400" aria-hidden="true" />
                    </span>
                    <span className="text-sm text-slate-600">
                      {strategy.freedomIndex.toFixed(2)}
                    </span>
                  </div>
                </div>
                <input
                  id="freedomIndex"
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={strategy.freedomIndex}
                  onChange={(e) =>
                    patchSimulationStrategy({
                      freedomIndex: Number(e.target.value),
                    })
                  }
                  className="w-full accent-orange-600"
                  disabled={!isHydrated}
                />
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <label className={labelField} htmlFor="smoothingFactor">
                    Smoothing Factor
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
                  step={0.01}
                  value={strategy.smoothingFactor}
                  onChange={(e) =>
                    patchSimulationStrategy({
                      smoothingFactor: Number(e.target.value),
                    })
                  }
                  className="w-full accent-slate-900"
                  disabled={!isHydrated}
                />
              </div>
            </section>

            <section className="space-y-4">
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Hard Constraints
                </div>
                <div className="mt-1 text-sm text-slate-600">
                  Limits that the engine cannot break.
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <label className={labelField} htmlFor="floor">
                    Min Price (Floor)
                  </label>
                  <input
                    id="floor"
                    type="number"
                    className={numberField}
                    value={strategy.floor}
                    onChange={(e) => updateNumber("floor", e.target.value)}
                    disabled={!isHydrated}
                  />
                </div>
                <div className="space-y-2">
                  <label className={labelField} htmlFor="ceiling">
                    Max Price (Ceiling)
                  </label>
                  <input
                    id="ceiling"
                    type="number"
                    className={numberField}
                    value={strategy.ceiling}
                    onChange={(e) => updateNumber("ceiling", e.target.value)}
                    disabled={!isHydrated}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className={labelField} htmlFor="strategyDifferential">
                  Strategy Differential (+/- $)
                </label>
                <input
                  id="strategyDifferential"
                  type="number"
                  className={numberField}
                  value={strategy.strategyDifferential}
                  onChange={(e) =>
                    updateNumber("strategyDifferential", e.target.value)
                  }
                  disabled={!isHydrated}
                />
              </div>
            </section>

            <section className="space-y-4 rounded-xl border border-red-200 bg-red-50/40 p-4">
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-red-700">
                  Developer Tools
                </div>
                <div className="mt-1 text-sm text-red-700">
                  Danger Zone. Use with care.
                </div>
              </div>
              <button
                type="button"
                onClick={doReset}
                disabled={pendingReset}
                className="inline-flex w-full items-center justify-center rounded-md border border-red-300 bg-transparent px-4 py-2 text-sm font-semibold text-red-700 shadow-sm transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Reset Demo Data
              </button>
            </section>
          </div>

          <DialogFooter className="border-t border-slate-200 px-6 py-4">
            <button
              type="button"
              className="rounded-md border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
              onClick={() => setOpen(false)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
              disabled={pendingSave || pendingReset || !hasUnsavedChanges}
              onClick={saveChanges}
            >
              {pendingSave ? "Saving..." : "Save Changes"}
            </button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
