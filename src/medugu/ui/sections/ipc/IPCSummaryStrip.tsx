import type { IPCDecision } from "../../../logic/ipcEngine";

interface IPCSummaryStripProps {
  decisions: IPCDecision[];
  openActionCount: number;
  episodeCounts: { newCount: number; repeatCount: number; clearanceCount: number };
  localWatchSummary?: string;
}

const severityOrder = ["high", "review", "routine"] as const;
type SummarySeverity = (typeof severityOrder)[number];

function severityForDecision(d: IPCDecision): SummarySeverity {
  if (d.timing === "immediate") return "high";
  if (d.timing === "same_shift" || d.timing === "within_24h") return "review";
  return "routine";
}

export function IPCSummaryStrip({
  decisions,
  openActionCount,
  episodeCounts,
  localWatchSummary,
}: IPCSummaryStripProps) {
  if (decisions.length === 0) {
    return (
      <div className="rounded-md border border-border bg-muted/20 p-3 text-xs text-muted-foreground">
        No IPC signals
      </div>
    );
  }

  const highestSeverity = decisions
    .map(severityForDecision)
    .sort((a, b) => severityOrder.indexOf(a) - severityOrder.indexOf(b))[0];

  const summaryText =
    decisions.length === 1 && highestSeverity === "high"
      ? "1 high-priority IPC signal"
      : `${decisions.length} ${highestSeverity} signal${decisions.length > 1 ? "s" : ""} · ${openActionCount} pending IPC action${openActionCount === 1 ? "" : "s"}`;

  return (
    <div className="rounded-md border border-border bg-muted/20 p-3">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="rounded bg-background px-2 py-1 font-medium text-foreground">
          {summaryText}
        </span>
        <span className="rounded bg-background px-2 py-1 text-muted-foreground">
          highest severity: {highestSeverity}
        </span>
        <span className="rounded bg-background px-2 py-1 text-muted-foreground">
          episodes — new: {episodeCounts.newCount}, repeat: {episodeCounts.repeatCount}, clearance:{" "}
          {episodeCounts.clearanceCount}
        </span>
        {localWatchSummary && (
          <span className="rounded bg-background px-2 py-1 text-muted-foreground">
            {localWatchSummary}
          </span>
        )}
      </div>
    </div>
  );
}
