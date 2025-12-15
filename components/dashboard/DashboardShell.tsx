import { ChatPanel } from "@/components/ai/ChatPanel";
import { DashboardView } from "@/components/dashboard/DashboardView";
import { getDashboardData } from "@/lib/dashboard-service";

export async function DashboardShell() {
  const dashboard = await getDashboardData();

  return (
    <>
      <DashboardView
        hotelName={dashboard.hotelName}
        rangeLabel={dashboard.rangeLabel}
        metrics={dashboard.metrics}
        monthly={dashboard.monthly}
        viewport={dashboard.viewport}
        activeStrategy={dashboard.activeStrategy}
        simulationStrategy={dashboard.simulationStrategy}
        isSimulating={dashboard.isSimulating}
        historicalAdr={dashboard.historicalAdr}
        hasActiveStrategy={dashboard.hasActiveStrategy}
      />
      <ChatPanel />
    </>
  );
}
