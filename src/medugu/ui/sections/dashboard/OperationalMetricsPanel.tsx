import type { OperationalDashboardSummary } from "../../../logic/operationalDashboard";

type MetricRow = {
  label: string;
  value: string | number;
  helper?: string;
  tone?: "default" | "highlight";
};

function toAgeLabel(hours: number | null): string {
  if (hours === null) return "Not available";
  if (hours < 24) return `${hours}h`;
  const days = Math.round((hours / 24) * 10) / 10;
  return `${days}d`;
}

export function OperationalMetricsPanel({ summary }: { summary: OperationalDashboardSummary }) {
  const metrics: MetricRow[] = [
    { label: "Total loaded cases", value: summary.totalLoadedCases },
    { label: "Open queue items", value: summary.openQueueItems, tone: "highlight" },
    {
      label: "Critical/high-priority queue items",
      value: summary.criticalOrHighPriorityQueueItems,
      tone: "highlight",
    },
    { label: "Release blocked cases", value: summary.releaseBlocked },
    { label: "Pending phone-out cases", value: summary.pendingPhoneOut },
    { label: "Pending consultant approval cases", value: summary.pendingConsultantApproval },
    { label: "AMS pending/restricted cases", value: summary.amsPendingOrRestricted },
    { label: "IPC high-priority cases", value: summary.ipcHighPriority },
    { label: "Colonisation/clearance follow-up cases", value: summary.colonisationOrClearanceFollowUp },
    { label: "Released/completed cases", value: summary.releasedOrCompletedCases },
    { label: "No-action cases", value: summary.noActionCases },
    {
      label: "Median age of open queue items",
      value: toAgeLabel(summary.medianOpenQueueAgeHours),
      helper: "Uses specimen collected/received/created timestamps when present.",
    },
  ];

  return (
    <section className="rounded-md border border-border bg-card p-3">
      <h5 className="text-xs font-semibold uppercase tracking-wide text-foreground">Operational metrics</h5>
      <p className="mt-1 text-[11px] text-muted-foreground">Metrics use only cases currently loaded in this browser.</p>
      <div className="mt-3 grid gap-x-3 gap-y-2 sm:grid-cols-2 lg:grid-cols-3">
        {metrics.map((metric) => (
          <div key={metric.label} className="rounded border border-border/70 bg-background px-2 py-1.5">
            <div className="text-[11px] text-muted-foreground">{metric.label}</div>
            <div
              className={`mt-0.5 text-sm font-semibold ${
                metric.tone === "highlight" ? "text-destructive" : "text-foreground"
              }`}
              title={metric.helper}
            >
              {metric.value}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
