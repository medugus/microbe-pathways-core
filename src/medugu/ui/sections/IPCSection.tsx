import { useMemo } from "react";
import { meduguActions, useActiveAccession, useMeduguState } from "../../store/useAccessionStore";
import { evaluateIPC, getSpecimenIPCContext } from "../../logic/ipcEngine";
import type { IPCDecision } from "../../logic/ipcEngine";
import { deriveColonisationContext } from "../../logic/ipcColonisation";
import { deriveLocalOutbreakWatch } from "../../logic/ipcLocalWatch";
import type { IPCSignal } from "../../domain/types";
import { IPCFlag } from "../../domain/enums";
import { newId } from "../../domain/ids";
import { IPC_RULES } from "../../config/ipcRules";
import { getRuleForSignal } from "../../logic/ipcRuleGovernance";
import { IPCSummaryStrip } from "./ipc/IPCSummaryStrip";
import { IPCSignalCard } from "./ipc/IPCSignalCard";
import { IPCColonisationTracker } from "./ipc/IPCColonisationTracker";
import { IPCLocalOutbreakWatch } from "./ipc/IPCLocalOutbreakWatch";
import { IPCOfficerQueue } from "./ipc/IPCOfficerQueue";
import { IPCRuleGovernancePanel } from "./ipc/IPCRuleGovernancePanel";

const DEFAULT_IPC_EMAIL = "ipc@hospital.local";

function signalKey(ruleCode: string, organismCode?: string | null): string {
  return `${ruleCode}|${organismCode ?? ""}`;
}

function signalKeyForDecision(decision: IPCDecision): string {
  return signalKey(decision.ruleCode, decision.organismCode);
}

function flagForDecision(decision: IPCDecision): IPCFlag {
  if (["CRE_ALERT", "CRAB_ALERT", "CRPA_ALERT"].includes(decision.ruleCode)) {
    return IPCFlag.CarbapenemResistant;
  }
  if (decision.ruleCode === "CAURIS_ALERT") return IPCFlag.XDR;
  if (["MRSA_ALERT", "VRE_ALERT"].includes(decision.ruleCode)) return IPCFlag.MDRO;
  return IPCFlag.AlertOrganism;
}

function buildSignalFromDecision(decision: IPCDecision): IPCSignal {
  return {
    id: newId("ipc"),
    flag: flagForDecision(decision),
    organismCode: decision.organismCode,
    ruleCode: decision.ruleCode,
    message: decision.message,
    raisedAt: new Date().toISOString(),
  };
}

export function IPCSection() {
  const accession = useActiveAccession();
  const state = useMeduguState();
  const ipcEmail = import.meta.env.VITE_MEDUGU_IPC_EMAIL || DEFAULT_IPC_EMAIL;

  const data = useMemo(() => {
    if (!accession) {
      return {
        decisions: [],
        specimenContext: "not available",
        signalMap: new Map<string, IPCSignal>(),
        generatedSignalMap: new Map<string, IPCSignal>(),
        signalRuleMap: new Map<string, string>(),
        localWatchSummary: undefined as string | undefined,
        localWatch: undefined as ReturnType<typeof deriveLocalOutbreakWatch> | undefined,
        colonisationContext: undefined as ReturnType<typeof deriveColonisationContext> | undefined,
      };
    }

    const report = evaluateIPC(accession, state.accessions);
    const signalMap = new Map(
      accession.ipc.map((s) => [signalKey(s.ruleCode, s.organismCode), s]),
    );
    const generatedSignalMap = new Map(
      report.signals.map((s) => [signalKey(s.ruleCode, s.organismCode), s]),
    );
    const signalRuleMap = new Map(
      accession.ipc.map((s) => {
        const matchedRule = getRuleForSignal(s, IPC_RULES);
        return [signalKey(s.ruleCode, s.organismCode), matchedRule?.ruleCode ?? s.ruleCode];
      }),
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
      generatedSignalMap,
      signalRuleMap,
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

  const activeDecisions = data.decisions.filter(
    (d) => !data.signalMap.get(signalKeyForDecision(d))?.archivedAt,
  );
  const sentToIpcSignals = accession.ipc.filter((signal) => signal.archivedAt);

  const episodeCounts = {
    newCount: activeDecisions.filter((d) => d.isNewEpisode).length,
    repeatCount: activeDecisions.filter((d) => !d.isNewEpisode).length,
    clearanceCount: activeDecisions.filter((d) => Boolean(d.clearanceProgress)).length,
  };

  const openActionCount = activeDecisions.reduce((sum, d) => {
    const signal = data.signalMap.get(signalKeyForDecision(d));
    return sum + (signal?.acknowledgedAt ? 0 : d.actions.length);
  }, 0);

  function notifyAndArchive(decision: IPCDecision) {
    if (!accession) return;
    const now = new Date().toISOString();
    const key = signalKeyForDecision(decision);
    const existing = data.signalMap.get(key);
    const generated = data.generatedSignalMap.get(key);
    const nextSignal: IPCSignal = {
      ...(existing ?? generated ?? buildSignalFromDecision(decision)),
      acknowledgedAt: existing?.acknowledgedAt ?? now,
      acknowledgedBy: existing?.acknowledgedBy ?? "local",
      notifiedAt: now,
      notifiedBy: "local",
      notificationTarget: ipcEmail,
      notificationMethod: "email",
      archivedAt: now,
      archivedBy: "local",
      archiveReason: "Sent to IPC by email from the workspace.",
    };
    const nextIpc = existing
      ? accession.ipc.map((signal) => (signal.id === existing.id ? nextSignal : signal))
      : [...accession.ipc, nextSignal];

    meduguActions.upsertAccession({
      ...accession,
      ipc: nextIpc,
      audit: [
        ...accession.audit,
        {
          id: newId("aud"),
          at: now,
          actor: "local",
          action: "ipc.notifyAndArchive",
          section: "ipc",
          field: `ipc[${decision.ruleCode}]`,
          newValue: {
            ruleCode: decision.ruleCode,
            organismCode: decision.organismCode,
            notificationTarget: ipcEmail,
          },
        },
      ],
    });

    if (typeof window !== "undefined") {
      const subject = encodeURIComponent(`IPC alert: ${decision.ruleCode} · ${accession.accessionNumber}`);
      const body = encodeURIComponent(
        [
          `Accession: ${accession.accessionNumber}`,
          `Patient: ${accession.patient.givenName} ${accession.patient.familyName} (${accession.patient.mrn})`,
          `Ward: ${accession.patient.ward ?? "not recorded"}`,
          `Rule: ${decision.ruleCode}`,
          `Message: ${decision.message}`,
          `Actions: ${decision.actions.join(", ") || "not recorded"}`,
          `Timing: ${decision.timing.replaceAll("_", " ")}`,
          "",
          "This signal has been archived under Items sent to IPC in Medugu LIMS.",
        ].join("\n"),
      );
      window.location.href = `mailto:${ipcEmail}?subject=${subject}&body=${body}`;
    }
  }

  function restoreSignal(signal: IPCSignal) {
    if (!accession) return;
    const restored: IPCSignal = {
      ...signal,
      archivedAt: undefined,
      archivedBy: undefined,
      archiveReason: undefined,
    };
    meduguActions.upsertAccession({
      ...accession,
      ipc: accession.ipc.map((item) => (item.id === signal.id ? restored : item)),
      audit: [
        ...accession.audit,
        {
          id: newId("aud"),
          at: new Date().toISOString(),
          actor: "local",
          action: "ipc.restoreArchivedSignal",
          section: "ipc",
          field: `ipc[${signal.ruleCode}]`,
          newValue: { ruleCode: signal.ruleCode, organismCode: signal.organismCode },
        },
      ],
    });
  }

  return (
    <div className="space-y-3">
      <IPCSummaryStrip
        decisions={data.decisions}
        openActionCount={openActionCount}
        episodeCounts={episodeCounts}
        localWatchSummary={data.localWatchSummary}
      />

      <IPCOfficerQueue accession={accession} allAccessions={state.accessions} />

      <IPCRuleGovernancePanel />

      {activeDecisions.length === 0 ? (
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
          {activeDecisions.map((d, idx) => (
            <li key={`${d.isolateId}-${d.ruleCode}-${idx}`}>
              <IPCSignalCard
                decision={d}
                signal={data.signalMap.get(signalKeyForDecision(d))}
                specimenContext={data.specimenContext}
                ward={accession.patient.ward}
                ruleVersion={accession.ruleVersion}
                generatedByRuleCode={data.signalRuleMap.get(signalKeyForDecision(d))}
                notificationTarget={ipcEmail}
                onNotifyIPC={() => notifyAndArchive(d)}
              />
            </li>
          ))}
        </ul>
      )}

      {sentToIpcSignals.length > 0 && (
        <details className="rounded-md border border-border bg-card p-3">
          <summary className="cursor-pointer text-sm font-semibold text-foreground">
            Items sent to IPC ({sentToIpcSignals.length})
          </summary>
          <ul className="mt-3 space-y-2">
            {sentToIpcSignals.map((signal) => (
              <li key={signal.id} className="rounded border border-border bg-muted/20 p-2 text-xs">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <code className="rounded bg-background px-1.5 py-0.5 text-[10px] text-muted-foreground">
                      {signal.ruleCode}
                    </code>
                    <span className="ml-2 text-muted-foreground">
                      sent {signal.notifiedAt ? new Date(signal.notifiedAt).toLocaleString() : "time not recorded"}
                      {signal.notificationTarget ? ` to ${signal.notificationTarget}` : ""}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => restoreSignal(signal)}
                    className="rounded border border-border bg-background px-2 py-1 text-[11px] text-foreground hover:bg-muted"
                  >
                    Retrieve
                  </button>
                </div>
                <p className="mt-1 text-muted-foreground">{signal.message}</p>
                {signal.archiveReason && (
                  <p className="mt-1 text-[10px] text-muted-foreground">{signal.archiveReason}</p>
                )}
              </li>
            ))}
          </ul>
        </details>
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
