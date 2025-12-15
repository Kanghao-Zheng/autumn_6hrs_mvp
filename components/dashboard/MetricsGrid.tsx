'use client';

type Metric = {
  label: string;
  value: string;
  deltaPct?: number | null;
};

type MetricsGridProps = {
  metrics: Metric[];
};

function DeltaPill({ deltaPct }: { deltaPct: number }) {
  const positive = deltaPct >= 0;
  const formatted = `${positive ? "+" : ""}${deltaPct.toFixed(0)}%`;
  return (
    <span
      className={[
        "rounded-full px-2 py-0.5 text-[11px] font-semibold",
        positive
          ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
          : "bg-red-50 text-red-700 ring-1 ring-red-200",
      ].join(" ")}
    >
      {formatted}
    </span>
  );
}

export function MetricsGrid({ metrics }: MetricsGridProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {metrics.map((metric) => (
        <div
          key={metric.label}
          className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
        >
          <div className="flex items-center justify-between gap-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              {metric.label}
            </div>
            {typeof metric.deltaPct === "number" ? (
              <DeltaPill deltaPct={metric.deltaPct} />
            ) : null}
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900">
            {metric.value}
          </div>
          {typeof metric.deltaPct === "number" ? (
            <div className="mt-1 text-xs text-slate-500">vs previous period</div>
          ) : null}
        </div>
      ))}
    </div>
  );
}

export type { Metric };
