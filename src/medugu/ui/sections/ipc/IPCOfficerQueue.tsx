import { useMemo } from "react";
import type { Accession, MeduguState } from "../../../domain/types";
import { deriveIPCOfficerQueue, type IPCQueueItem } from "../../../logic/ipcQueue";

interface IPCOfficerQueueProps {
  accession: Accession;
  allAccessions: MeduguState["accessions"];
}

function priorityTone(priority: IPCQueueItem["priority"]): string {
  if (priority === "critical") return "bg-destructive/15 text-destructive";
  if (priority === "high") return "bg-amber-500/15 text-amber-700 dark:text-amber-300";
  if (priority === "review") return "bg-primary/15 text-primary";
  return "bg-muted text-muted-foreground";
}

export function IPCOfficerQueue({ accession, allAccessions }: IPCOfficerQueueProps) {
  const items = useMemo(
    () => deriveIPCOfficerQueue(accession, allAccessions),
    [accession, allAccessions],
  );

  const counts = useMemo(
    () => ({
      criticalHigh: items.filter((item) => item.priority === "critical" || item.priority === "high")
        .length,
      openActions: items.filter((item) => item.queueType === "open_action").length,
      colonisationPositives: items.filter((item) => item.queueType === "colonisation_positive")
        .length,
      clearanceFollowUp: items.filter((item) => item.queueType === "clearance_incomplete").length,
      outbreakWatch: items.filter((item) => item.queueType === "possible_cluster").length,
    }),
    [items],
  );

  return (
    <section className="space-y-3 rounded-md border border-border bg-card p-3">
      <details open>
        <summary className="cursor-pointer list-none">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold text-foreground">IPC officer queue</h3>
            <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
              browser-local queue
            </span>
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">
            Queue derived from currently loaded cases; requires backend persistence for
            hospital-wide task management.
          </p>
        </summary>

        <div className="mt-3 space-y-3">
          <div className="flex flex-wrap gap-2 text-xs">
            <span className="rounded bg-muted px-2 py-1 text-muted-foreground">
              critical/high: {counts.criticalHigh}
            </span>
            <span className="rounded bg-muted px-2 py-1 text-muted-foreground">
              open actions: {counts.openActions}
            </span>
            <span className="rounded bg-muted px-2 py-1 text-muted-foreground">
              colonisation positives: {counts.colonisationPositives}
            </span>
            <span className="rounded bg-muted px-2 py-1 text-muted-foreground">
              clearance follow-up: {counts.clearanceFollowUp}
            </span>
            <span className="rounded bg-muted px-2 py-1 text-muted-foreground">
              outbreak watch: {counts.outbreakWatch}
            </span>
          </div>

          {items.length === 0 ? (
            <p className="rounded border border-dashed border-border bg-muted/20 p-3 text-xs text-muted-foreground">
              No IPC queue items among cases currently loaded in this browser.
            </p>
          ) : (
            <ul className="space-y-2">
              {items.map((item) => (
                <li
                  key={item.id}
                  className="space-y-1 rounded border border-border bg-muted/20 p-2 text-xs"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded px-1.5 py-0.5 text-[10px] uppercase tracking-wide ${priorityTone(item.priority)}`}
                    >
                      {item.priority}
                    </span>
                    <span className="rounded bg-background px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                      {item.queueType.replaceAll("_", " ")}
                    </span>
                    {item.relatedRuleCode && (
                      <code className="rounded bg-background px-1.5 py-0.5 text-[10px] text-muted-foreground">
                        {item.relatedRuleCode}
                      </code>
                    )}
                  </div>

                  <p className="font-medium text-foreground">
                    {item.patientLabel ?? "patient not available"}
                    {item.accessionNumber ? ` · ${item.accessionNumber}` : ""}
                  </p>
                  <p className="text-muted-foreground">Ward/unit: {item.ward ?? "not available"}</p>
                  <p className="text-muted-foreground">
                    Organism/phenotype: {item.organismOrPhenotype ?? "not available"}
                  </p>
                  <p className="text-muted-foreground">Reason: {item.reason}</p>
                  <p className="text-muted-foreground">
                    Recommended action: {item.recommendedAction}
                  </p>
                  <p className="text-muted-foreground">
                    Due/age: {item.dueLabel ?? "not available"}
                    {typeof item.ageHours === "number"
                      ? ` · ${item.ageHours}h since collection`
                      : ""}
                  </p>
                  <p className="text-[10px] text-muted-foreground">{item.limitationNote}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </details>
    </section>
  );
}
