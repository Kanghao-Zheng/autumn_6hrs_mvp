import { createReadStream, promises as fs } from "fs";
import path from "path";
import { z } from "zod";
import csvParser from "csv-parser";
import {
  addDays,
  differenceInCalendarDays,
  format,
  isValid,
  parse,
  parseISO,
} from "date-fns";
import { readDb } from "./db";
import {
  type Competitor,
  type CompetitorRate,
  CompetitorRateSchema,
  type DailyStat,
  type Reservation,
} from "./schema";
import { detectDelimiterFromHeaderLine, pickReservationFieldsLoose } from "./csv-utils";

export const TOTAL_ROOMS = 15;

const DATE_FORMAT = "yyyy-MM-dd";
const DISPLAY_DATE_FORMAT = "M/d/yyyy";

type OccupancyBucket = {
  roomsSold: number;
  revenue: number;
};

type ParseResult = {
  reservations: Reservation[];
  dailyStats: DailyStat[];
  historicalAdr: number;
  revPar: number;
  minDate: string;
  maxDate: string;
};

export type EnrichedDailyStat = DailyStat & {
  competitorRates: CompetitorRate[];
};

export const UploadedReservationRowSchema = z
  .object({
    Status: z.string().optional(),
    "Check in Date": z.string().optional(),
    "Check out Date": z.string().optional(),
    "Accommodation Total": z.string().optional(),
    "Grand Total": z.string().optional(),
    "Reservation Number": z.string().optional(),
    "Third Party Confirmation Number": z.string().optional(),
    Source: z.string().optional(),
    "Reservation Date": z.string().optional(),
  })
  .strict();

export type UploadedReservationRow = z.infer<typeof UploadedReservationRowSchema>;

const DATA_DIR = path.join(process.cwd(), "data");
const RESERVATIONS_PATH = path.join(DATA_DIR, "reservations.csv");
const COMPETITORS_PATH = path.join(DATA_DIR, "competitors.json");

function toDateString(date: Date) {
  return format(date, DATE_FORMAT);
}

function parseDate(value: string | undefined): Date | null {
  if (!value) return null;
  const trimmed = value.trim();
  const parsed = parse(trimmed, DISPLAY_DATE_FORMAT, new Date());
  if (isValid(parsed)) return parsed;
  const iso = parseISO(trimmed);
  return isValid(iso) ? iso : null;
}

function parseNumber(value: string | undefined): number {
  if (!value) return 0;
  const cleaned = value.replace(/[^0-9.-]/g, "");
  const asNumber = Number.parseFloat(cleaned);
  return Number.isFinite(asNumber) ? asNumber : 0;
}

export function calculateOccupancy(
  accumulator: Map<string, OccupancyBucket>,
  checkIn: Date,
  checkOut: Date,
  rooms: number,
  revenue: number,
) {
  const nights = differenceInCalendarDays(checkOut, checkIn);
  if (nights <= 0) return { nights, revenuePerNight: 0 };

  const revenuePerNight = revenue / nights;
  for (let i = 0; i < nights; i += 1) {
    const day = addDays(checkIn, i);
    const key = toDateString(day);
    const current = accumulator.get(key) ?? { roomsSold: 0, revenue: 0 };
    accumulator.set(key, {
      roomsSold: current.roomsSold + rooms,
      revenue: current.revenue + revenuePerNight,
    });
  }
  return { nights, revenuePerNight };
}

export function ingestReservationRows(
  rows: UploadedReservationRow[],
  roomsAvailable: number = TOTAL_ROOMS,
): ParseResult {
  const reservations: Reservation[] = [];
  const occupancy = new Map<string, OccupancyBucket>();
  let totalRevenue = 0;
  let totalRoomNights = 0;
  let minCheckIn: Date | null = null;
  let maxCheckOut: Date | null = null;

  rows.forEach((row) => {
    const status = (row.Status ?? "").trim().toLowerCase();
    if (status === "cancelled") return;

    const checkInDate = parseDate(row["Check in Date"]);
    const checkOutDate = parseDate(row["Check out Date"]);
    if (!checkInDate || !checkOutDate) return;

    const nights = differenceInCalendarDays(checkOutDate, checkInDate);
    if (nights <= 0) return;

    if (!minCheckIn || checkInDate < minCheckIn) minCheckIn = checkInDate;
    if (!maxCheckOut || checkOutDate > maxCheckOut) maxCheckOut = checkOutDate;

    const revenue =
      parseNumber(row["Accommodation Total"]) || parseNumber(row["Grand Total"]);
    const adr = revenue / nights;

    totalRevenue += revenue;
    totalRoomNights += nights;

    calculateOccupancy(occupancy, checkInDate, checkOutDate, 1, revenue);

    const bookedAtDate = parseDate(row["Reservation Date"]);
    const id =
      row["Reservation Number"]?.toString().trim() ||
      row["Third Party Confirmation Number"]?.toString().trim() ||
      `${toDateString(checkInDate)}-${reservations.length}`;

    reservations.push({
      id,
      bookedAt: bookedAtDate ? toDateString(bookedAtDate) : undefined,
      checkIn: toDateString(checkInDate),
      checkOut: toDateString(checkOutDate),
      rooms: 1,
      adr,
      channel: row.Source?.trim(),
    });
  });

  const fallback = new Date();
  const resolvedMin = minCheckIn ?? fallback;
  const resolvedMaxNight =
    maxCheckOut && differenceInCalendarDays(maxCheckOut, resolvedMin) > 0
      ? addDays(maxCheckOut, -1)
      : resolvedMin;

  const totalDays = Math.max(
    1,
    differenceInCalendarDays(resolvedMaxNight, resolvedMin) + 1,
  );

  const dailyStats: DailyStat[] = Array.from(
    { length: totalDays },
    (_, idx) => {
      const current = addDays(resolvedMin, idx);
      const date = toDateString(current);
      const bucket = occupancy.get(date) ?? { roomsSold: 0, revenue: 0 };
      const occupancyPct = (bucket.roomsSold / roomsAvailable) * 100;
      const adr = bucket.roomsSold ? bucket.revenue / bucket.roomsSold : undefined;
      const revPar = bucket.revenue / roomsAvailable;
      return {
        date,
        roomsSold: bucket.roomsSold,
        roomsAvailable,
        occupancyPct,
        adr,
        revPar,
        competitorAverage: undefined,
      };
    },
  );

  const historicalAdr = totalRoomNights > 0 ? totalRevenue / totalRoomNights : 0;
  const revPar = totalDays > 0 ? totalRevenue / (roomsAvailable * totalDays) : 0;

  return {
    reservations,
    dailyStats,
    historicalAdr,
    revPar,
    minDate: toDateString(resolvedMin),
    maxDate: toDateString(resolvedMaxNight),
  };
}

export async function parseReservations(
  filePath: string = RESERVATIONS_PATH,
): Promise<ParseResult> {
  const firstLine = await (async () => {
    const handle = await fs.open(filePath, "r");
    try {
      const buffer = Buffer.alloc(4096);
      const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0);
      const chunk = buffer.toString("utf-8", 0, bytesRead);
      return chunk.split(/\r?\n/)[0] ?? "";
    } finally {
      await handle.close();
    }
  })();
  const delimiter = detectDelimiterFromHeaderLine(firstLine);

  return new Promise((resolve, reject) => {
    const parsedRows: UploadedReservationRow[] = [];

    createReadStream(filePath)
      .pipe(
        csvParser({
          separator: delimiter,
          mapHeaders: ({ header }) => header.trim().toLowerCase(),
        }),
      )
      .on("data", (row: Record<string, string>) => {
        const canonical = pickReservationFieldsLoose(row);
        if (!canonical["Check in Date"] && !canonical["Check out Date"]) return;
        const parsed = UploadedReservationRowSchema.safeParse(canonical);
        if (!parsed.success) return;
        parsedRows.push(parsed.data);
      })
      .on("end", () => {
        const result = ingestReservationRows(parsedRows, TOTAL_ROOMS);
        if (result.reservations.length === 0) {
          reject(
            new Error("Could not parse CSV format. Please check delimiters."),
          );
          return;
        }
        resolve(result);
      })
      .on("error", reject);
  });
}

export function generateCompetitorRates(
  minDate: Date,
  maxDate: Date,
  bufferDays: number = 7,
  baseRate: number = 200,
  spikeMultiplier: number = 1.25,
): { profiles: Competitor[]; rates: CompetitorRate[] } {
  const competitors: Competitor[] = [
    { id: "marriott", name: "Marriott" },
    { id: "hilton", name: "Hilton" },
    { id: "boutique", name: "Boutique" },
  ];

  const rates: CompetitorRate[] = [];

  const start = new Date(minDate);
  const end = addDays(maxDate, bufferDays);
  const totalDays = Math.max(0, differenceInCalendarDays(end, start) + 1);

  for (let offset = 0; offset < totalDays; offset += 1) {
    const current = addDays(start, offset);
    const date = toDateString(current);
    const isWeekend = [5, 6].includes(current.getDay());

    competitors.forEach((comp) => {
      const weekendAdjusted = baseRate * (isWeekend ? spikeMultiplier : 1);
      const jitter = Math.floor(Math.random() * 21) - 10; // +/- $10
      const rate = Math.max(50, Math.round(weekendAdjusted + jitter));
      rates.push({
        competitorId: comp.id,
        date,
        rate,
      });
    });
  }

  return { profiles: competitors, rates };
}

export async function writeCompetitorsFile(
  rates: CompetitorRate[],
  filePath: string = COMPETITORS_PATH,
) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(rates, null, 2), "utf-8");
}

export async function readCompetitorRates(
  filePath: string = COMPETITORS_PATH,
): Promise<CompetitorRate[]> {
  try {
    const raw = await fs.readFile(filePath, "utf-8");
    const parsed = JSON.parse(raw);
    return z.array(CompetitorRateSchema).parse(parsed);
  } catch (error: unknown) {
    const typedError = error as NodeJS.ErrnoException;
    if (typedError?.code === "ENOENT") {
      return [];
    }
    throw error;
  }
}

export function findSmartViewport(
  reservations: Reservation[],
  windowDays: number = 30,
): string {
  if (reservations.length === 0) {
    return toDateString(new Date());
  }

  const occupancy = new Map<string, number>();
  let minDate: Date | null = null;
  let maxDate: Date | null = null;

  reservations.forEach((reservation) => {
    const checkIn = parseISO(reservation.checkIn);
    const checkOut = parseISO(reservation.checkOut);
    if (!isValid(checkIn) || !isValid(checkOut)) return;

    if (!minDate || checkIn < minDate) minDate = checkIn;
    if (!maxDate || checkOut > maxDate) maxDate = checkOut;

    const nights = differenceInCalendarDays(checkOut, checkIn);
    for (let i = 0; i < nights; i += 1) {
      const current = addDays(checkIn, i);
      const key = toDateString(current);
      occupancy.set(key, (occupancy.get(key) ?? 0) + reservation.rooms);
    }
  });

  if (!minDate || !maxDate) {
    return toDateString(new Date());
  }

  const totalDays = Math.max(
    1,
    differenceInCalendarDays(maxDate, minDate) + 1,
  );
  const timeline: Array<{ date: Date; count: number }> = Array.from(
    { length: totalDays },
    (_, idx) => {
      const current = addDays(minDate!, idx);
      const key = toDateString(current);
      return { date: current, count: occupancy.get(key) ?? 0 };
    },
  );

  let bestStartIndex = 0;
  let bestSum = -Infinity;
  let windowSum = 0;

  for (let i = 0; i < timeline.length; i += 1) {
    windowSum += timeline[i].count;
    if (i >= windowDays) {
      windowSum -= timeline[i - windowDays].count;
    }
    const windowFilled = Math.min(windowDays, i + 1);
    if (windowFilled === windowDays || timeline.length < windowDays) {
      if (windowSum > bestSum) {
        bestSum = windowSum;
        bestStartIndex = Math.max(0, i - windowDays + 1);
      }
    }
  }

  return toDateString(timeline[bestStartIndex].date);
}

export async function getDailyStats(
  startDate: Date | string,
  days: number = 30,
): Promise<EnrichedDailyStat[]> {
  const state = await readDb();
  const parsedStart =
    typeof startDate === "string" ? parseISO(startDate) : new Date(startDate);

  if (state.dailyStats.length === 0) return [];

  const sorted = state.dailyStats
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date));

  const rangeStart = parseISO(sorted[0]!.date);
  const rangeEnd = parseISO(sorted[sorted.length - 1]!.date);

  const statMap = new Map(sorted.map((stat) => [stat.date, stat]));

  let start = isValid(parsedStart) ? parsedStart : rangeStart;
  if (isValid(rangeStart) && start < rangeStart) start = rangeStart;

  const safeDays = Math.max(1, days);

  // Forecast occupancy for future dates using historical weekday averages.
  const weekdayTotals = new Array(7).fill(0) as number[];
  const weekdayCounts = new Array(7).fill(0) as number[];
  sorted.forEach((stat) => {
    const date = parseISO(stat.date);
    if (!isValid(date)) return;
    const weekday = date.getDay();
    weekdayTotals[weekday] += stat.occupancyPct;
    weekdayCounts[weekday] += 1;
  });

  const overallAverage =
    sorted.reduce((sum, stat) => sum + stat.occupancyPct, 0) /
    Math.max(1, sorted.length);

  const forecastByWeekday = weekdayTotals.map((total, weekday) => {
    const count = weekdayCounts[weekday] ?? 0;
    return count > 0 ? total / count : overallAverage;
  });

  const roomsAvailable = state.hotel.roomCount || TOTAL_ROOMS;
  const competitorRates = state.competitorRates ?? [];
  const competitorsByDate = competitorRates.reduce<
    Record<string, CompetitorRate[]>
  >((acc, rate) => {
    if (!acc[rate.date]) acc[rate.date] = [];
    acc[rate.date].push(rate);
    return acc;
  }, {});

  const enriched: EnrichedDailyStat[] = [];

  for (let i = 0; i < safeDays; i += 1) {
    const current = addDays(start, i);
    const date = toDateString(current);

    const base = statMap.get(date);
    const compRates = competitorsByDate[date] ?? [];
    const competitorAverage =
      compRates.length > 0
        ? compRates.reduce((sum, rate) => sum + rate.rate, 0) /
          compRates.length
        : undefined;

    enriched.push({
      date,
      roomsSold:
        base?.roomsSold ??
        (isValid(rangeEnd) && current > rangeEnd
          ? Math.round((forecastByWeekday[current.getDay()] / 100) * roomsAvailable)
          : 0),
      roomsAvailable: base?.roomsAvailable ?? roomsAvailable,
      occupancyPct:
        base?.occupancyPct ??
        (isValid(rangeEnd) && current > rangeEnd
          ? forecastByWeekday[current.getDay()]
          : 0),
      adr: base?.adr,
      revPar: base?.revPar,
      competitorAverage,
      competitorRates: compRates,
    });
  }

  return enriched;
}
