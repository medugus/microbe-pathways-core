// IPCSection — visualises IPC engine output per isolate.
//
// Stage 5 (browser-phase only): the IPC scan runs the **pure** engine
// (`evaluateIPC`) against the local in-browser accession dataset. Cross-
// accession rolling-window dedup and prior-case linkage are computed across
// every accession currently hydrated into the local store for this tenant.
//
// Scope boundary: NO backend / Postgres / cross-tenant queries are issued
// from this stage. The engine contract (Accession + allAccessions map) is
// intentionally kept generic so the same call site can later be backed by a
// server query without changing the UI contract.

import { useMemo, useState } from "react";
import { useActiveAccession, useMeduguState } from "../../store/useAccessionStore";
import { evaluateIPC, type IPCDecision } from "../../logic/ipcEngine";
import { rulesFor } from "../../config/ipcRules";
import { getOrganism } from "../../config/organisms";
import { detailFromDecision, type IPCEpisodeDetail } from "../../logic/ipcEpisodeDetail";
import { IPCEpisodeDrawer } from "./IPCEpisodeDrawer";

const TIMING_TONE: Record<string, string> = {
  immediate: "bg-destructive/20 text-destructive",
  same_shift: "bg-destructive/10 text-destructive",
  within_24h: "bg-muted text-foreground",
  next_business_day: "bg-muted text-muted-foreground",
};

function severityForDecision(d: IPCDecision): "high" | "moderate" | "review" {
  if (d.timing === "immediate") return "high";
  if (d.timing === "same_shift") return "moderate";
  return "review";
}

function statusForDecision(accessionIpc: { ruleCode: string; organismCode?: string; acknowledgedAt?: string }[], d: IPCDecision) {
  const matched = accessionIpc.find((s) => s.ruleCode === d.ruleCode && s.organismCode === d.organismCode);
  if (!matched) return "open";
  return matched.acknowledgedAt ? "acknowledged" : "open";
}

function triggerReason(accessionFamilyCode: string | undefined, d: IPCDecision): string {
  const reasonParts: string[] = [];
  if (d.organismCode) {
    const org = getOrganism(d.organismCode);
    reasonParts.push(org ? `Organism: ${org.display}` : `Organism code: ${d.organismCode}`);
  }
  if (d.phenotypes.length > 0) {
    reasonParts.push(`Phenotype: ${d.phenotypes.join(", ")}`);
  }
  if (accessionFamilyCode === "BLOOD") {
    reasonParts.push("Specimen context: bloodstream isolate");
  }
  return reasonParts.join(" · ");
}

export function IPCSection() {
  const accession = useActiveAccession();
  const state = useMeduguState();
  const [drawerDetail, setDrawerDetail] = useState<IPCEpisodeDetail | null>(null);

  // Cohort = every accession in the local store sharing this MRN (excluding
  // the active one). Surfaced for transparency; the engine itself sees the
  // full local dataset and applies its own dedup window per rule.
  const cohortSize = useMemo(() => {
    if (!accession) return 0;
    return Object.values(state.accessions).filter(
      (a) => a.id !== accession.id && a.patient.mrn === accession.patient.mrn,
    ).length;
  }, [accession, state.accessions]);

  const { decisions, windowDaysByRule } = useMemo(() => {
    if (!accession) return { decisions: [] as IPCDecision[], windowDaysByRule: {} as Record<string, number> };
    const report = evaluateIPC(accession, state.accessions);
    // Build a ruleCode → rollingWindowDays map from config so the drawer can
    // explain *why* a prior case counted (e.g. "MRSA_ALERT · 90d window").
    const map: Record<string, number> = {};
    for (const iso of accession.isolates) {
      const matched = rulesFor(iso.organismCode, [], accession.patient.ward);
      for (const r of matched) {
        if (r.rollingWindowDays) map[r.ruleCode] = r.rollingWindowDays;
      }
    }
    return { decisions: report.decisions, windowDaysByRule: map };
  }, [accession, state.accessions]);

  if (!accession) {
    return (
      <div className="rounded-lg border border-border bg-card p-8 text-center text-sm text-muted-foreground">
        No active accession.
      </div>
    );
  }

  const openDetail = (d: IPCDecision) => {
    setDrawerDetail(
      detailFromDecision(
        accession,
        d,
        undefined,
        (id) => state.accessions[id],
        windowDaysByRule[d.ruleCode],
      ),
    );
  };

  const banner = (
    <p className="rounded-md border border-dashed border-border bg-muted/30 px-2 py-1 text-[10px] text-muted-foreground">
      Local cohort scan — evaluates only accessions currently loaded in this
      browser. Server-backed cross-tenant rolling window not active in this stage.
    </p>
  );

  if (decisions.length === 0) {
    return <p className="text-sm text-muted-foreground">No IPC signals for this accession.</p>;
  }

  return (
    <div className="space-y-3">
      <header className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          Triggered by organism + phenotype + ward + rolling window. Cross-accession
          dedup performed locally across the in-browser dataset.
        </p>
        <span className="text-[10px] text-muted-foreground">
          local cohort: {cohortSize} prior case(s)
        </span>
      </header>
      <ul className="space-y-2">
        {decisions.map((d, idx) => {
          const isolate = accession.isolates.find((i) => i.id === d.isolateId);
          const severity = severityForDecision(d);
          const status = statusForDecision(accession.ipc, d);
          return (
            <li
              key={`${d.isolateId}-${d.ruleCode}-${idx}`}
              className="cursor-pointer rounded-md border border-border bg-card p-3 transition hover:border-primary/40 hover:bg-muted/30"
              onClick={() => openDetail(d)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  openDetail(d);
                }
              }}
            >
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <code className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                  {d.ruleCode}
                </code>
                <span className={`rounded px-1.5 py-0.5 text-[10px] ${TIMING_TONE[d.timing] ?? "bg-muted"}`}>
                  {d.timing.replaceAll("_", " ")}
                </span>
                <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-primary">
                  severity: {severity}
                </span>
                <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                  status: {status}
                </span>
                <span
                  className={`rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide ${
                    d.isNewEpisode
                      ? "bg-primary/15 text-primary"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {d.isNewEpisode ? "new episode" : "repeat episode"}
                </span>
                {d.priorAccessionIds && d.priorAccessionIds.length > 0 && (
                  <span className="text-[10px] text-muted-foreground">
                    · {d.priorAccessionIds.length} prior case(s)
                  </span>
                )}
                <span className="ml-auto text-[10px] text-muted-foreground">click for detail →</span>
              </div>
              <p className="mt-1.5 text-xs text-muted-foreground">
                Isolate {isolate?.isolateNo ?? "?"}: {isolate?.organismDisplay ?? d.organismCode ?? "Unknown organism"}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Trigger reason: {triggerReason(accession.specimen.familyCode, d)}
              </p>
              <p className="mt-1.5 text-sm text-foreground">Advice: {d.message}</p>
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
          );
        })}
      </ul>
      {banner}
      <IPCEpisodeDrawer
        open={drawerDetail !== null}
        onOpenChange={(o) => { if (!o) setDrawerDetail(null); }}
        detail={drawerDetail}
        // No "Open accession" button — we are already on this accession.
      />
    </div>
  );
}
