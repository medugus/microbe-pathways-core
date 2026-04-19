// IPCSection — visualises IPC engine output per isolate.
// Logic in logic/ipcEngine.ts; this is a thin presentation shell.

import { useActiveAccession, useMeduguState } from "../../store/useAccessionStore";
import { evaluateIPC } from "../../logic/ipcEngine";

const TIMING_TONE: Record<string, string> = {
  immediate: "bg-destructive/20 text-destructive",
  same_shift: "bg-destructive/10 text-destructive",
  within_24h: "bg-muted text-foreground",
  next_business_day: "bg-muted text-muted-foreground",
};

export function IPCSection() {
  const accession = useActiveAccession();
  const all = useMeduguState();
  if (!accession) {
    return (
      <div className="rounded-lg border border-border bg-card p-8 text-center text-sm text-muted-foreground">
        No active accession.
      </div>
    );
  }
  const report = evaluateIPC(accession, all.accessions);

  if (report.decisions.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No IPC signals — no alert organism, phenotype, or ward trigger matched.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <header>
        <p className="text-xs text-muted-foreground">
          Triggered by organism + phenotype + ward + rolling window. Episode dedup applied per MRN.
        </p>
      </header>
      <ul className="space-y-2">
        {report.decisions.map((d, idx) => (
          <li
            key={`${d.isolateId}-${d.ruleCode}-${idx}`}
            className="rounded-md border border-border bg-card p-3"
          >
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <code className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                {d.ruleCode}
              </code>
              <span className={`rounded px-1.5 py-0.5 text-[10px] ${TIMING_TONE[d.timing] ?? "bg-muted"}`}>
                {d.timing.replaceAll("_", " ")}
              </span>
              {!d.isNewEpisode && (
                <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                  deduped (existing episode)
                </span>
              )}
              {d.phenotypes.length > 0 && (
                <span className="text-[10px] text-muted-foreground">
                  phenotype: {d.phenotypes.join(", ")}
                </span>
              )}
            </div>
            <p className="mt-1.5 text-sm text-foreground">{d.message}</p>
            <div className="mt-2 flex flex-wrap gap-1.5 text-[10px]">
              {d.actions.map((a) => (
                <span key={a} className="rounded bg-primary/10 px-1.5 py-0.5 text-primary">
                  {a.replaceAll("_", " ")}
                </span>
              ))}
            </div>
            <div className="mt-1 text-[10px] text-muted-foreground">
              Notify: {d.notify.join(", ")}
            </div>
            {d.clearanceProgress && (
              <div className="mt-1 text-[10px] text-muted-foreground">
                Clearance: {d.clearanceProgress.negativeCount}/{d.clearanceProgress.required} negative screens.
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
