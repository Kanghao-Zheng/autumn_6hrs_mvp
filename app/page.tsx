import { readDb } from "@/lib/db";
import { UploadOverlay } from "@/components/onboarding/UploadOverlay";
import { DashboardShell } from "@/components/dashboard/DashboardShell";

export const dynamic = "force-dynamic";

export default async function Home() {
  const state = await readDb();

  if (!state.reservations || state.reservations.length === 0) {
    return <UploadOverlay />;
  }

  return <DashboardShell key={JSON.stringify(state.activeStrategy)} />;
}
