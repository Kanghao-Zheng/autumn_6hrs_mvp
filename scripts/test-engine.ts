import { addDays, format, parseISO } from "date-fns";
import { parseReservations } from "../lib/data-service";
import { generatePricingCalendar } from "../lib/pricing-service";

async function main() {
  const { dailyStats, minDate } = await parseReservations();

  const busiest =
    dailyStats.length > 0
      ? dailyStats.reduce((best, current) =>
          current.occupancyPct > best.occupancyPct ? current : best,
        )
      : { date: minDate, occupancyPct: 0 };

  const start = parseISO(busiest.date);
  const calendar = await generatePricingCalendar(busiest.date, 7);

  console.log(`Pricing preview (7 days starting ${busiest.date}):`);
  calendar.forEach((point, idx) => {
    const trace = point.trace;
    const date = format(addDays(start, idx), "yyyy-MM-dd");
    const occupancy = trace.yieldMultiplier.occupancyPct.toFixed(1);
    const compAvg = trace.marketAnchor.weightedAverage.toFixed(2);
    const stageB = trace.yieldMultiplier.stageBMultiplier.toFixed(2);
    const effective = trace.yieldMultiplier.effectiveMultiplier.toFixed(2);
    const shoulderAdj = trace.shoulderSmoothing.shoulderAdj.toFixed(2);
    const finalPrice = trace.guardrails.finalPrice.toFixed(2);

    console.log(
      `${date} | Occ ${occupancy}% | CompAvg $${compAvg} | StageB ${stageB}x | Effective ${effective}x | ShoulderAdj $${shoulderAdj} | Final $${finalPrice}`,
    );
  });

  console.log("\nSample PricingTrace (day 1):");
  console.dir(calendar[0]?.trace, { depth: null });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
