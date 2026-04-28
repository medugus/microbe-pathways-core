import type { ColonisationContext } from "../../../logic/ipcColonisation";
import { IPCClearanceCounter } from "./IPCClearanceCounter";

interface IPCColonisationTrackerProps {
  context?: ColonisationContext;
}

function humanize(value: string | undefined): string {
  if (!value) return "not available";
  return value.replaceAll("_", " ");
}

export function IPCColonisationTracker({ context }: IPCColonisationTrackerProps) {
  if (!context || !context.isScreen) {
    return (
      <section className="rounded-md border border-border bg-card p-3">
        <p className="text-xs text-muted-foreground">Not a colonisation-screen workflow.</p>
      </section>
    );
  }

  return (
    <section className="space-y-2 rounded-md border border-border bg-card p-3">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
          colonisation screen
        </span>
        <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
          purpose: {humanize(context.screenPurpose)}
        </span>
      </div>

      <p className="text-sm text-foreground">Target organism: {context.targetOrganism ?? "not available"}</p>
      <p className="text-xs text-muted-foreground">Screening result: {humanize(context.screenResult)}</p>
      <p className="text-xs text-muted-foreground">Carrier status: {humanize(context.episodeStatus)}</p>

      <IPCClearanceCounter count={context.clearanceCount} required={context.clearanceRequired} />

      <p className="text-xs text-muted-foreground">
        Last positive date: {context.lastPositiveDate ? new Date(context.lastPositiveDate).toLocaleDateString() : "not available"}
      </p>
      <p className="text-xs text-muted-foreground">
        Days since last positive: {context.daysSinceLastPositive !== undefined ? context.daysSinceLastPositive : "not available"}
      </p>

      <p className="text-xs text-muted-foreground">Isolation status: {humanize(context.isolationStatus)}</p>
      <p className="text-xs text-muted-foreground">Decolonisation status: {humanize(context.decolonisationStatus)}</p>
      <p className="text-xs text-muted-foreground">Next suggested screen/action: {context.nextAction ?? "not available"}</p>
      <p className="text-[10px] text-muted-foreground">{context.limitationNote}</p>
    </section>
  );
}
