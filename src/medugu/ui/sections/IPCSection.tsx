import { useMemo } from "react";
import { useActiveAccession, useMeduguState } from "../../store/useAccessionStore";
import { evaluateIPC, getSpecimenIPCContext } from "../../logic/ipcEngine";
import { deriveColonisationContext } from "../../logic/ipcColonisation";
import { deriveLocalOutbreakWatch } from "../../logic/ipcLocalWatch";
import type { IPCSignal } from "../../domain/types";
import { IPCSummaryStrip } from "./ipc/IPCSummaryStrip";
import { IPCSignalCard } from "./ipc/IPCSignalCard";
import { IPCColonisationTracker } from "./ipc/IPCColonisationTracker";
import { IPCLocalOutbreakWatch } from "./ipc/IPCLocalOutbreakWatch";
import { IPCOfficerQueue } from "./ipc/IPCOfficerQueue";

export function IPCSection() {
  const accession = useActiveAccession();
  const state = useMeduguState();

  const data = useMemo(() => {
    if (!accession) {
      return {
        decisions: [],
        specimenContext: "not available",
        signalMap: new Map<string, IPCSignal>(),
        localWatchSummary: undefined as string | undefined,
        localWatch: undefined as ReturnType<typeof deriveLocalOutbreakWatch> | undefined,
        colonisationContext: undefined as ReturnType<typeof deriveColonisationContext> | undefined,
      };
    }

    const report = evaluateIPC(accession, state.accessions);
    const signalMap = new Map(
      accession.ipc.map((s) => [`${s.ruleCode}|${s.organismCode ?? ""}`, s]),
    );
    const localWatch = deriveLocalOutbreakWatch(accession, state.accessions);

    const localWatchSummary =
      localWatch.signalItems.length > 0
        ? `Local outbreak watch: ${localWatch.signalItems[0].patientAdjustedCount} patient-adjusted comparable loaded cases`
        : undefined;

    return {
      decisions: report.decisions,
      specimenContext: getSpecimenIPCContext(accession),
      signalMap,
      localWatchSummary,
      localWatch,
      colonisationContext: deriveColonisationContext(accession, state.accessions),
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

      <IPCOfficerQueue accession={accession} allAccessions={state.accessions} />

      {data.decisions.length === 0 ? (
        <div className="space-y-2 rounded-md border border-border bg-card p-4">
          <p className="text-sm text-muted-foreground">
            No IPC signals — no alert organism, phenotype, ward trigger, repeat-case trigger or
            clearance trigger matched.
          </p>
          <p className="text-xs text-muted-foreground">
            Local outbreak watch evaluates only currently loaded cases in this browser.
            Browser-local only and requires backend persistence for hospital-wide surveillance.
          </p>
          <p className="text-xs text-muted-foreground">
            Rule version: {accession.ruleVersion || "not available"}
          </p>
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

      <IPCColonisationTracker context={data.colonisationContext} />

      <IPCLocalOutbreakWatch
        summary={data.localWatch?.summary ?? "no local cluster"}
        limitationNote={data.localWatch?.limitationNote ?? "Browser-local only"}
        items={data.localWatch?.signalItems ?? []}
      />
    </div>
  );
}
