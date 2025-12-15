import { Sidebar } from "@/components/dashboard/Sidebar";
import { MetricsGrid, type Metric } from "@/components/dashboard/MetricsGrid";
import {
  RevenueCharts,
  type MonthlySummary,
} from "@/components/dashboard/RevenueCharts";
import { StoreHydrator } from "@/components/dashboard/StoreHydrator";
import { DailyPricingPanel } from "@/components/dashboard/DailyPricingPanel";
import type { PricingStrategy } from "@/lib/schema";
import type { EnrichedDailyStat } from "@/lib/data-service";

type DashboardViewProps = {
  hotelName: string;
  rangeLabel: string;
  metrics: Metric[];
  monthly: MonthlySummary[];
  viewport: EnrichedDailyStat[];
  activeStrategy: PricingStrategy;
  simulationStrategy: PricingStrategy;
  isSimulating: boolean;
  historicalAdr: number;
  hasActiveStrategy: boolean;
};

export function DashboardView({
  hotelName,
  rangeLabel,
  metrics,
  monthly,
  viewport,
  activeStrategy,
  simulationStrategy,
  isSimulating,
  historicalAdr,
  hasActiveStrategy,
}: DashboardViewProps) {
  return (
    <div className="grid h-screen grid-cols-[240px_1fr]">
      <StoreHydrator
        activeStrategy={activeStrategy}
        simulationStrategy={simulationStrategy}
        isSimulating={isSimulating}
      />
      <Sidebar />

      <main className="min-w-0 overflow-y-auto bg-slate-50/50">
        <div className="mx-auto max-w-6xl space-y-6 px-8 py-8">
          <header className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-orange-600">
                Autumn Hotel OS
              </div>
              <h1 className="mt-2 text-2xl font-bold text-slate-900">
                Good afternoon.
              </h1>
              <p className="mt-1 text-sm text-slate-600">
                <span className="font-medium text-slate-800">{hotelName}</span>{" "}
                · {rangeLabel}
              </p>
            </div>
          </header>

          <MetricsGrid metrics={metrics} />
          <DailyPricingPanel
            stats={viewport}
            historicalAdr={historicalAdr}
            hasActiveStrategy={hasActiveStrategy}
          />
          <RevenueCharts
            data={monthly}
            hasActiveStrategy={hasActiveStrategy}
            showProjectedRevenue={hasActiveStrategy}
          />
        </div>
      </main>
    </div>
  );
}
