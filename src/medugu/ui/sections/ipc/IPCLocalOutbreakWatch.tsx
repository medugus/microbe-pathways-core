import type { LocalOutbreakWatchItem } from "../../../logic/ipcLocalWatch";

interface IPCLocalOutbreakWatchProps {
  summary: "no local cluster" | "possible cluster" | "outbreak watch";
  limitationNote: string;
  items: LocalOutbreakWatchItem[];
}

function summaryTone(summary: IPCLocalOutbreakWatchProps["summary"]): string {
  if (summary === "outbreak watch") {
    return "text-destructive";
  }
  if (summary === "possible cluster") {
    return "text-amber-700 dark:text-amber-400";
  }
  return "text-muted-foreground";
}

export function IPCLocalOutbreakWatch({
  summary,
  limitationNote,
  items,
}: IPCLocalOutbreakWatchProps) {
  return (
    <section className="space-y-3 rounded-md border border-dashed border-border bg-muted/20 p-3">
      <div className="space-y-1">
        <h3 className="text-sm font-semibold text-foreground">Local outbreak watch</h3>
        <p className="text-[11px] text-muted-foreground">Browser-local only</p>
        <p className="text-[11px] text-muted-foreground">{limitationNote}</p>
        <p className={`text-xs font-medium capitalize ${summaryTone(summary)}`}>{summary}</p>
      </div>

      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          No local outbreak watch signal among cases currently loaded in this browser.
        </p>
      ) : (
        <ul className="space-y-2">
          {items.map((item) => (
            <li
              key={item.id}
              className="space-y-1 rounded border border-border bg-card p-2 text-xs"
            >
              <p className="font-medium text-foreground">
                {item.ward ? `Ward/unit: ${item.ward}` : "Ward/unit: not available"}
              </p>
              <p className="text-muted-foreground">
                Organism/phenotype: {item.organismLabel ?? "not available"}
                {item.phenotypeLabel ? ` / ${item.phenotypeLabel}` : ""}
              </p>
              <p className="text-muted-foreground">
                patient-adjusted count: {item.patientAdjustedCount}
              </p>
              <p className="text-muted-foreground">Raw case count: {item.rawCaseCount}</p>
              <p className="text-muted-foreground">Window: {item.windowDays} days</p>
              <p className="break-all text-muted-foreground">
                Related accessions: {item.relatedAccessions.join(", ")}
              </p>
              <p className="text-muted-foreground">
                Suggested IPC review action: {item.recommendedAction}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
