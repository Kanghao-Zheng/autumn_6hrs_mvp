import { seed } from "../lib/seed";

seed()
  .then((state) => {
    // eslint-disable-next-line no-console
    console.log(
      `Seeded ${state.reservations.length} reservations, ${state.competitorRates.length} competitor rates.`,
    );
  })
  .catch((error) => {
    // eslint-disable-next-line no-console
    console.error("Seeding failed:", error);
    process.exitCode = 1;
  });

