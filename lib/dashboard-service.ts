import { addDays, differenceInCalendarDays, format, isValid, parseISO } from "date-fns";
import { readDb } from "./db";
import { getDailyStats } from "./data-service";
import { generatePricingCalendar } from "./pricing-service";
import type { Metric } from "@/components/dashboard/MetricsGrid";
import type { MonthlySummary } from "@/components/dashboard/RevenueCharts";

type Aggregate = {
  revenue: number;
  bookedNights: number;
  availableNights: number;
};

function aggregateHistorical(
  stats: Awaited<ReturnType<typeof getDailyStats>>,
  maxDate: string,
): Aggregate {
  return stats.reduce<Aggregate>(
    (acc, day) => {
      if (day.date > maxDate) return acc;
      const revenue = (day.revPar ?? 0) * day.roomsAvailable;
      acc.revenue += revenue;
      acc.bookedNights += day.roomsSold;
      acc.availableNights += day.roomsAvailable;
      return acc;
    },
    { revenue: 0, bookedNights: 0, availableNights: 0 },
  );
}

function percentChange(current: number, previous: number): number | null {
  if (!Number.isFinite(current) || !Number.isFinite(previous) || previous <= 0) {
    return null;
  }
  return ((current - previous) / previous) * 100;
}

function formatMoney(value: number) {
  return `$${Math.round(value).toLocaleString()}`;
}

function formatPercent(value: number) {
  return `${value.toFixed(0)}%`;
}

const MONTH_LABELS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

function monthLabelFromKey(monthKey: string) {
  const month = Number.parseInt(monthKey.slice(5, 7), 10);
  const label = MONTH_LABELS[month - 1];
  return label ?? monthKey;
}

function getMonthlyAggregates(args: {
  stats: Awaited<ReturnType<typeof getDailyStats>>;
  calendar: Awaited<ReturnType<typeof generatePricingCalendar>>;
  maxHistoricalDate: string;
}): MonthlySummary[] {
  type MonthBucket = {
    monthKey: string;
    monthLabel: string;
    historicalRevenue: number;
    projectedRevenue: number;
    historicalRoomsSold: number;
    competitorSum: number;
    competitorCount: number;
    historicalDayCount: number;
    projectedDayCount: number;
  };

  const buckets = new Map<string, MonthBucket>();

  args.stats.forEach((day, idx) => {
    if (!day.date || typeof day.date !== "string") return;
    const monthKey = day.date.slice(0, 7); // YYYY-MM (stable, timezone-free)
    const bucket =
      buckets.get(monthKey) ??
      {
        monthKey,
        monthLabel: monthLabelFromKey(monthKey),
        historicalRevenue: 0,
        projectedRevenue: 0,
        historicalRoomsSold: 0,
        competitorSum: 0,
        competitorCount: 0,
        historicalDayCount: 0,
        projectedDayCount: 0,
      };

    const isHistorical = day.date <= args.maxHistoricalDate;
    if (isHistorical) {
      const revenue = (day.revPar ?? 0) * day.roomsAvailable;
      bucket.historicalRevenue += revenue;
      bucket.historicalRoomsSold += day.roomsSold;
      bucket.historicalDayCount += 1;
    } else {
      const projectedPrice = args.calendar[idx]?.finalPrice ?? 0;
      const projectedRoomsSold = (day.roomsAvailable * day.occupancyPct) / 100;
      bucket.projectedRevenue += projectedPrice * projectedRoomsSold;
      bucket.projectedDayCount += 1;
    }

    if (typeof day.competitorAverage === "number") {
      bucket.competitorSum += day.competitorAverage;
      bucket.competitorCount += 1;
    }

    buckets.set(monthKey, bucket);
  });

  return Array.from(buckets.values())
    .sort((a, b) => a.monthKey.localeCompare(b.monthKey)) // Oldest -> newest
    .map((bucket) => {
      const competitorAverage =
        bucket.competitorCount > 0
          ? bucket.competitorSum / bucket.competitorCount
          : null;

      const adr =
        bucket.historicalRoomsSold > 0
          ? bucket.historicalRevenue / bucket.historicalRoomsSold
          : null;

      return {
        monthKey: bucket.monthKey,
        monthLabel: bucket.monthLabel,
        historicalRevenue:
          bucket.historicalDayCount > 0 ? bucket.historicalRevenue : null,
        projectedRevenue:
          bucket.projectedDayCount > 0 ? bucket.projectedRevenue : null,
        adr,
        competitorAverage,
      };
    });
}

export async function getDashboardData() {
  const state = await readDb();
  const activeStrategy = state.activeStrategy ?? state.hotel.pricingStrategy;
  const simulationStrategy = state.simulationStrategy ?? activeStrategy;
  const isSimulating = state.isSimulating;
  const hasActiveStrategy = state.hasActiveStrategy ?? false;
  const historicalAdr =
    typeof state.historicalAdr === "number" && state.historicalAdr > 0
      ? state.historicalAdr
      : activeStrategy.baseRate;

  if (state.dailyStats.length === 0) {
    return {
      hotelName: state.hotel.name,
      rangeLabel: "Upload a CSV to begin.",
      metrics: [] as Metric[],
      monthly: [] as MonthlySummary[],
      viewport: [] as Awaited<ReturnType<typeof getDailyStats>>,
      activeStrategy,
      simulationStrategy,
      isSimulating,
      historicalAdr,
      hasActiveStrategy,
    };
  }

  const sorted = state.dailyStats
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date));

  const rangeStart = parseISO(sorted[0]!.date);
  const rangeEnd = parseISO(sorted[sorted.length - 1]!.date);
  const maxHistoricalDate = sorted[sorted.length - 1]!.date;

  const rangeLabel =
    isValid(rangeStart) && isValid(rangeEnd)
      ? `Historical window: ${format(rangeStart, "MMM dd, yyyy")} to ${format(rangeEnd, "MMM dd, yyyy")}`
      : "Historical window loaded.";

  // Metrics: use the 30-day smart viewport window.
  const viewportStart = (() => {
    const parsed = parseISO(state.simulationStartDate);
    return isValid(parsed) ? parsed : rangeStart;
  })();

  const currentWindow = await getDailyStats(viewportStart, 30);
  const previousStart = addDays(viewportStart, -30);
  const previousWindow =
    isValid(previousStart) && isValid(rangeStart) && previousStart >= rangeStart
      ? await getDailyStats(previousStart, 30)
      : null;

  const currentAgg = aggregateHistorical(currentWindow, maxHistoricalDate);
  const previousAgg = previousWindow
    ? aggregateHistorical(previousWindow, maxHistoricalDate)
    : null;

  const occupancyPct =
    currentAgg.availableNights > 0
      ? (currentAgg.bookedNights / currentAgg.availableNights) * 100
      : 0;
  const adr =
    currentAgg.bookedNights > 0 ? currentAgg.revenue / currentAgg.bookedNights : 0;
  const revPar =
    currentAgg.availableNights > 0 ? currentAgg.revenue / currentAgg.availableNights : 0;

  const deltas: Array<number | null> =
    previousAgg && previousAgg.availableNights > 0
      ? [
          percentChange(currentAgg.revenue, previousAgg.revenue),
          percentChange(
            occupancyPct,
            (previousAgg.bookedNights / Math.max(1, previousAgg.availableNights)) * 100,
          ),
          percentChange(
            adr,
            previousAgg.bookedNights > 0
              ? previousAgg.revenue / previousAgg.bookedNights
              : 0,
          ),
          percentChange(
            revPar,
            previousAgg.availableNights > 0
              ? previousAgg.revenue / previousAgg.availableNights
              : 0,
          ),
        ]
      : [null, null, null, null];

  const metrics: Metric[] = [
    { label: "Room Revenue", value: formatMoney(currentAgg.revenue), deltaPct: deltas[0] ?? null },
    { label: "Occupancy", value: formatPercent(occupancyPct), deltaPct: deltas[1] ?? null },
    { label: "ADR", value: formatMoney(adr), deltaPct: deltas[2] ?? null },
    { label: "RevPAR", value: formatMoney(revPar), deltaPct: deltas[3] ?? null },
  ];

  // Charts: monthly rollups across the full historical window + a small projection horizon.
  const projectionDays = 90;
  const timelineEnd = isValid(rangeEnd) ? addDays(rangeEnd, projectionDays) : rangeEnd;
  const totalDays =
    isValid(rangeStart) && isValid(timelineEnd)
      ? Math.max(1, differenceInCalendarDays(timelineEnd, rangeStart) + 1)
      : 1;

  const timelineStats = await getDailyStats(rangeStart, totalDays);
  const calendar = await generatePricingCalendar(rangeStart, totalDays, state.activeStrategy);

  const monthly = getMonthlyAggregates({
    stats: timelineStats,
    calendar,
    maxHistoricalDate,
  });

  return {
    hotelName: state.hotel.name,
    rangeLabel,
    metrics,
    monthly,
    viewport: currentWindow,
    activeStrategy,
    simulationStrategy,
    isSimulating,
    historicalAdr,
    hasActiveStrategy,
  };
}
