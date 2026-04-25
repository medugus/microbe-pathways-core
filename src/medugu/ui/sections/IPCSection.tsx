import { useMemo } from "react";
import { useActiveAccession, useMeduguState } from "../../store/useAccessionStore";
import { evaluateIPC, getSpecimenIPCContext } from "../../logic/ipcEngine";
import type { IPCSignal } from "../../domain/types";
import { IPCSummaryStrip } from "./ipc/IPCSummaryStrip";
import { IPCSignalCard } from "./ipc/IPCSignalCard";
import { IPCLocalWatchPanel } from "./ipc/IPCLocalWatchPanel";

export function IPCSection() {
  const accession = useActiveAccession();
  const state = useMeduguState();

  const data = useMemo(() => {
    if (!accession) {
      return {
        decisions: [],
        specimenContext: "not available",
        signalMap: new Map<string, IPCSignal>(),
        priorAccessions: [] as string[],
        comparableSignals: [] as Array<{ ruleCode: string; count: number }>,
        wardGrouping: [] as Array<{ ward: string; count: number }>,
        localWatchSummary: undefined as string | undefined,
      };
    }

    const report = evaluateIPC(accession, state.accessions);
    const signalMap = new Map(
      accession.ipc.map((s) => [`${s.ruleCode}|${s.organismCode ?? ""}`, s]),
    );

    const prior = Object.values(state.accessions).filter(
      (a) => a.id !== accession.id && a.patient.mrn === accession.patient.mrn,
    );

    const comparableByRule: Record<string, number> = {};
    const wardCounts: Record<string, number> = {};
    for (const candidate of Object.values(state.accessions)) {
      const candidateReport = evaluateIPC(candidate, state.accessions);
      for (const d of candidateReport.decisions) {
        comparableByRule[d.ruleCode] = (comparableByRule[d.ruleCode] ?? 0) + 1;
      }
      const ward = candidate.patient.ward ?? "unknown";
      wardCounts[ward] = (wardCounts[ward] ?? 0) + 1;
    }

    const comparableSignals = Object.entries(comparableByRule)
      .map(([ruleCode, count]) => ({ ruleCode, count }))
      .sort((a, b) => b.count - a.count);

    const wardGrouping = Object.entries(wardCounts)
      .map(([ward, count]) => ({ ward, count }))
      .sort((a, b) => b.count - a.count);

    const wardWatch = accession.patient.ward
      ? wardGrouping.find((w) => w.ward === accession.patient.ward)
      : undefined;

    const localWatchSummary = wardWatch
      ? `Outbreak watch: ${wardWatch.count} comparable loaded cases in ${wardWatch.ward}`
      : undefined;

    return {
      decisions: report.decisions,
      specimenContext: getSpecimenIPCContext(accession),
      signalMap,
      priorAccessions: prior.map((a) => a.id),
      comparableSignals,
      wardGrouping,
      localWatchSummary,
    };
  }, [accession, state.accessions]);

  if (!accession) {
    return (
      <div className="rounded-lg border border-border bg-card p-8 text-center text-sm text-muted-foreground">
        No active accession.
      </div>
    );
  }

  const episodeCounts = {
    newCount: data.decisions.filter((d) => d.isNewEpisode).length,
    repeatCount: data.decisions.filter((d) => !d.isNewEpisode).length,
    clearanceCount: data.decisions.filter((d) => Boolean(d.clearanceProgress)).length,
  };

  const openActionCount = data.decisions.reduce((sum, d) => {
    const signal = data.signalMap.get(`${d.ruleCode}|${d.organismCode ?? ""}`);
    return sum + (signal?.acknowledgedAt ? 0 : d.actions.length);
  }, 0);

  return (
    <div className="space-y-3">
      <IPCSummaryStrip
        decisions={data.decisions}
        openActionCount={openActionCount}
        episodeCounts={episodeCounts}
        localWatchSummary={data.localWatchSummary}
      />

      {data.decisions.length === 0 ? (
        <div className="space-y-2 rounded-md border border-border bg-card p-4">
          <p className="text-sm text-muted-foreground">
            No IPC signals — no alert organism, phenotype, ward trigger, repeat-case trigger or clearance trigger matched.
          </p>
          <p className="text-xs text-muted-foreground">Local cohort count: {data.priorAccessions.length}</p>
          <p className="text-xs text-muted-foreground">
            Local browser watch evaluates only cases currently loaded in this browser. Hospital-wide rolling-window surveillance requires backend persistence.
          </p>
          <p className="text-xs text-muted-foreground">Rule version: {accession.ruleVersion || "not available"}</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {data.decisions.map((d, idx) => (
            <li key={`${d.isolateId}-${d.ruleCode}-${idx}`}>
              <IPCSignalCard
                decision={d}
                signal={data.signalMap.get(`${d.ruleCode}|${d.organismCode ?? ""}`)}
                specimenContext={data.specimenContext}
                ward={accession.patient.ward}
                ruleVersion={accession.ruleVersion}
              />
            </li>
          ))}
        </ul>
      )}

      <IPCLocalWatchPanel
        priorAccessions={data.priorAccessions}
        comparableSignals={data.comparableSignals.slice(0, 5)}
        wardGrouping={data.wardGrouping.slice(0, 5)}
        repeatAdjustedCount={new Set(data.priorAccessions).size}
      />
    </div>
  );
}
