'use client';

import { format, parseISO } from "date-fns";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { PricingTrace } from "@/lib/schema";

type ChartDatum = {
  date: string;
  occupancyPct: number;
  competitorAverage?: number;
  activePrice?: number | null;
  simulatedPrice?: number | null;
  activeTrace?: PricingTrace;
  simulatedTrace?: PricingTrace;
  activeOverrideApplied?: boolean;
  simulatedOverrideApplied?: boolean;
};

function formatCurrency(value?: number | null) {
  if (value == null || Number.isNaN(value)) return "-";
  return `$${Math.round(value).toLocaleString()}`;
}

function formatDelta(value?: number | null) {
  if (value == null || Number.isNaN(value)) return "-";
  const rounded = Math.round(value);
  const abs = Math.abs(rounded);
  return `${rounded >= 0 ? "+" : "-"}$${abs.toLocaleString()}`;
}

function describeDemand(occupancy: number) {
  if (occupancy > 90) return "Critical Scarcity";
  if (occupancy > 80) return "Aggressive Demand";
  if (occupancy > 70) return "High Demand";
  if (occupancy < 30) return "Distress";
  return "Parity";
}

function CustomTooltip({
  active,
  payload,
  label,
  isSimulating,
  hasActiveStrategy,
}: {
  active?: boolean;
  payload?: any[];
  label?: string;
  isSimulating: boolean;
  hasActiveStrategy: boolean;
}) {
  if (!active || !payload?.length) return null;
  const point = payload[0]?.payload as ChartDatum | undefined;
  if (!point) return null;
  const parsed = label ? parseISO(label) : null;
  const dateLabel =
    parsed && !Number.isNaN(parsed.getTime())
      ? format(parsed, "MMM dd, yyyy")
      : point.date;

  const chosenTrace =
    (isSimulating && point.simulatedTrace) || point.activeTrace;
  const marketBase = chosenTrace?.marketAnchor.basePrice;
  const smoothed = chosenTrace?.shoulderSmoothing.smoothedPrice;
  const shoulderAdj = chosenTrace?.shoulderSmoothing.shoulderAdj;
  const clamped = chosenTrace?.guardrails.clampedPrice;
  const clampAdj =
    smoothed != null && clamped != null ? clamped - smoothed : undefined;
  const demandLabel = describeDemand(
    chosenTrace?.yieldMultiplier.occupancyPct ?? 0,
  );

  return (
    <div className="min-w-[240px] rounded-md border border-slate-200 bg-white p-3 shadow-md">
      <div className="text-sm font-semibold text-slate-900">{dateLabel}</div>
      <div className="mt-1 space-y-1 text-xs text-slate-600">
        <div>Occupancy: {point.occupancyPct.toFixed(1)}%</div>
        {hasActiveStrategy ? (
          <div>
            Competitor Avg: {formatCurrency(point.competitorAverage ?? null)}
          </div>
        ) : null}
      </div>

      {hasActiveStrategy && chosenTrace ? (
        <div className="mt-2 rounded-sm bg-slate-50 p-2">
          <div className="text-xs font-semibold text-blue-700">Pricing Trace</div>
          <div className="mt-1 space-y-1 text-[11px] text-slate-700">
            <div>
              Market Base: {formatCurrency(marketBase)}
            </div>
            <div>
              Yield Multiplier: {chosenTrace.yieldMultiplier.stageBMultiplier.toFixed(2)}x ({demandLabel})
            </div>
            <div>
              Freedom Index: {chosenTrace.yieldMultiplier.freedomIndex.toFixed(2)} · Effective {chosenTrace.yieldMultiplier.effectiveMultiplier.toFixed(2)}x
            </div>
            <div>
              Shoulder Adj:{" "}
              {formatDelta(shoulderAdj)}
            </div>
            <div>
              Clamp Adj:{" "}
              {formatDelta(clampAdj)}
            </div>
            <div>
              Final: {formatCurrency(chosenTrace.guardrails.finalPrice)}
            </div>
          </div>
        </div>
      ) : null}

      {hasActiveStrategy && isSimulating && point.simulatedTrace && (
        <div className="mt-2 rounded-sm bg-emerald-50 p-2">
          <div className="text-xs font-semibold text-emerald-700">
            Simulated Path
          </div>
          <div className="mt-1 space-y-1 text-[11px] text-emerald-700">
            <div>
              Final: {formatCurrency(point.simulatedTrace.guardrails.finalPrice)}
            </div>
            <div>
              Yield: {point.simulatedTrace.yieldMultiplier.effectiveMultiplier.toFixed(2)}x
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

type PricingChartProps = {
  data: ChartDatum[];
  isSimulating: boolean;
  hasActiveStrategy: boolean;
};

function OverrideDot({
  cx,
  cy,
  stroke,
}: {
  cx?: number;
  cy?: number;
  stroke?: string;
}) {
  if (cx == null || cy == null) return null;
  return (
    <circle
      cx={cx}
      cy={cy}
      r={5}
      fill={stroke ?? "#0f172a"}
      stroke="#ffffff"
      strokeWidth={2}
    />
  );
}

export function PricingChart({
  data,
  isSimulating,
  hasActiveStrategy,
}: PricingChartProps) {
  const showPriceLines = hasActiveStrategy;
  return (
    <div className="h-[400px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, bottom: 8, left: 8, right: 16 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis
            dataKey="date"
            tickFormatter={(value) => {
              const parsed = parseISO(value);
              return Number.isNaN(parsed.getTime())
                ? value
                : format(parsed, "MMM dd");
            }}
            stroke="#94a3b8"
            fontSize={12}
          />
          {showPriceLines ? (
            <YAxis
              yAxisId="left"
              tickFormatter={(value) => `$${value}`}
              stroke="#94a3b8"
              fontSize={12}
            />
          ) : null}
          <YAxis
            yAxisId="right"
            orientation="right"
            tickFormatter={(value) => `${value}%`}
            stroke="#94a3b8"
            fontSize={12}
          />
          <Tooltip
            content={
              <CustomTooltip
                isSimulating={showPriceLines && isSimulating}
                hasActiveStrategy={hasActiveStrategy}
              />
            }
          />
          <Legend />
          <Bar
            yAxisId="right"
            dataKey="occupancyPct"
            name="Occupancy %"
            fill="#e2e8f0"
            stroke="#cbd5e1"
            radius={[4, 4, 0, 0]}
          />
          {showPriceLines ? (
            <Line
              yAxisId="left"
              type="monotone"
              dataKey="competitorAverage"
              name="Competitor Avg"
              stroke="#94a3b8"
              strokeDasharray="5 5"
              dot={false}
            />
          ) : null}
          {showPriceLines ? (
            <Line
              yAxisId="left"
              type="monotone"
              dataKey="activePrice"
              name="Active Price"
              stroke="#2563eb"
              strokeWidth={2}
              dot={(props: any) => {
                if (!props?.payload?.activeOverrideApplied) return null;
                return <OverrideDot {...props} stroke="#2563eb" />;
              }}
            />
          ) : null}
          {showPriceLines && isSimulating ? (
            <Line
              yAxisId="left"
              type="monotone"
              dataKey="simulatedPrice"
              name="Simulated Price"
              stroke="#16a34a"
              strokeDasharray="4 4"
              strokeWidth={2}
              dot={(props: any) => {
                if (!props?.payload?.simulatedOverrideApplied) return null;
                return <OverrideDot {...props} stroke="#16a34a" />;
              }}
            />
          ) : null}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

export type { ChartDatum };
