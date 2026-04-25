import type { OperationalDashboardSummary } from "../../../logic/operationalDashboard";

export function OperationalSummaryCards({ summary }: { summary: OperationalDashboardSummary }) {
  const cards = [
    { label: "Total loaded cases", value: summary.totalLoadedCases },
    { label: "Open queue items", value: summary.openQueueItems, tone: "text-destructive" },
    { label: "Critical / urgent cases", value: summary.criticalUrgentCases, tone: "text-destructive" },
    { label: "Critical/high queue items", value: summary.criticalOrHighPriorityQueueItems, tone: "text-destructive" },
    { label: "Release blocked", value: summary.releaseBlocked, tone: "text-destructive" },
    { label: "Pending phone-out", value: summary.pendingPhoneOut, tone: "text-destructive" },
    { label: "AMS pending/restricted", value: summary.amsPendingOrRestricted },
    { label: "IPC high priority", value: summary.ipcHighPriority },
    { label: "Follow-up", value: summary.colonisationOrClearanceFollowUp },
  ];

  return (
    <div className="grid gap-2 md:grid-cols-4">
      {cards.map((card) => (
        <div key={card.label} className="rounded border border-border bg-card p-3">
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{card.label}</div>
          <div className={`mt-1 text-xl font-semibold ${card.tone ?? "text-foreground"}`}>{card.value}</div>
        </div>
      ))}
    </div>
  );
}
