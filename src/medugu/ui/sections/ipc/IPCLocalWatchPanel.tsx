interface IPCLocalWatchPanelProps {
  priorAccessions: string[];
  comparableSignals: Array<{ ruleCode: string; count: number }>;
  wardGrouping: Array<{ ward: string; count: number }>;
  repeatAdjustedCount?: number;
}

export function IPCLocalWatchPanel({
  priorAccessions,
  comparableSignals,
  wardGrouping,
  repeatAdjustedCount,
}: IPCLocalWatchPanelProps) {
  return (
    <section className="space-y-2 rounded-md border border-dashed border-border bg-muted/20 p-3">
      <p className="text-xs font-medium text-foreground">Local browser watch</p>
      <p className="text-[10px] text-muted-foreground">
        Local browser watch evaluates only cases currently loaded in this browser. Hospital-wide
        rolling-window surveillance requires backend persistence.
      </p>

      <div className="space-y-1 text-xs text-muted-foreground">
        <p>Prior accessions for same MRN: {priorAccessions.length}</p>
        {priorAccessions.length > 0 && <p className="break-all">{priorAccessions.join(", ")}</p>}
        <p>
          Repeat-patient adjusted count:{" "}
          {repeatAdjustedCount ?? comparableSignals.reduce((sum, s) => sum + s.count, 0)}
        </p>
      </div>

      {comparableSignals.length > 0 && (
        <div className="space-y-1 text-xs">
          <p className="font-medium text-foreground">Comparable IPC signals in loaded cases</p>
          <ul className="space-y-1 text-muted-foreground">
            {comparableSignals.map((s) => (
              <li key={s.ruleCode}>
                {s.ruleCode}: {s.count}
              </li>
            ))}
          </ul>
        </div>
      )}

      {wardGrouping.length > 0 && (
        <div className="space-y-1 text-xs">
          <p className="font-medium text-foreground">Ward/unit grouping</p>
          <ul className="space-y-1 text-muted-foreground">
            {wardGrouping.map((w) => (
              <li key={w.ward}>
                {w.ward}: {w.count}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
