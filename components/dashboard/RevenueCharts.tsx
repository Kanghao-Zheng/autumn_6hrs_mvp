'use client';

import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export type MonthlySummary = {
  monthKey: string; // YYYY-MM
  monthLabel: string; // Jan, Feb...
  historicalRevenue: number | null;
  projectedRevenue: number | null;
  adr: number | null;
  competitorAverage: number | null;
};

type RevenueChartsProps = {
  data: MonthlySummary[];
  hasActiveStrategy: boolean;
  showProjectedRevenue?: boolean;
};

function formatCurrency(value?: number | null) {
  if (value == null || Number.isNaN(value)) return "-";
  return `$${Math.round(value).toLocaleString()}`;
}

function formatCurrencySmall(value?: number | null) {
  if (value == null || Number.isNaN(value)) return "-";
  return `$${Math.round(value).toLocaleString()}`;
}

export function RevenueCharts({
  data,
  hasActiveStrategy,
  showProjectedRevenue = true,
}: RevenueChartsProps) {
  const safe = useMemo(() => data, [data]);
  const labelByKey = useMemo(
    () => new Map(safe.map((row) => [row.monthKey, row.monthLabel])),
    [safe],
  );

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Revenue Summary
            </div>
            <div className="text-sm text-slate-700">
              Actual vs projected (engine)
            </div>
          </div>
        </div>

        <div className="mt-4 h-[280px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={safe} barCategoryGap={16}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis
                dataKey="monthKey"
                stroke="#94a3b8"
                fontSize={12}
                tickLine={false}
                axisLine={false}
                tickFormatter={(value) => labelByKey.get(String(value)) ?? String(value)}
              />
              <YAxis
                stroke="#94a3b8"
                fontSize={12}
                tickLine={false}
                axisLine={false}
                tickFormatter={(value) => `$${Math.round(value / 1000)}k`}
              />
              <Tooltip
                formatter={(value: any) => formatCurrency(value as number)}
                cursor={{ fill: "rgba(148, 163, 184, 0.12)" }}
              />
              <Legend />
              <Bar
                dataKey="historicalRevenue"
                name="Historical Revenue"
                fill="#e2e8f0"
                radius={[8, 8, 0, 0]}
              />
              {showProjectedRevenue ? (
                <Bar
                  dataKey="projectedRevenue"
                  name="Projected Revenue"
                  fill="#1e293b"
                  radius={[8, 8, 0, 0]}
                />
              ) : null}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Average Room Rate
            </div>
            <div className="text-sm text-slate-700">ADR vs competitor market</div>
          </div>
        </div>

        <div className="mt-4 h-[280px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={safe}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis
                dataKey="monthKey"
                stroke="#94a3b8"
                fontSize={12}
                tickLine={false}
                axisLine={false}
                tickFormatter={(value) => labelByKey.get(String(value)) ?? String(value)}
              />
              <YAxis
                stroke="#94a3b8"
                fontSize={12}
                tickLine={false}
                axisLine={false}
                tickFormatter={(value) => `$${Math.round(value)}`}
              />
              <Tooltip
                formatter={(value: any, name: any) => {
                  if (name === "Competitor Avg") return formatCurrencySmall(value);
                  return formatCurrencySmall(value);
                }}
                cursor={{ fill: "rgba(148, 163, 184, 0.12)" }}
              />
              <Legend />
              <Bar dataKey="adr" name="ADR" fill="#e2e8f0" radius={[8, 8, 0, 0]} />
              {hasActiveStrategy ? (
                <Line
                  type="monotone"
                  dataKey="competitorAverage"
                  name="Competitor Avg"
                  stroke="#2dd4bf"
                  strokeWidth={2}
                  dot={false}
                />
              ) : null}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
