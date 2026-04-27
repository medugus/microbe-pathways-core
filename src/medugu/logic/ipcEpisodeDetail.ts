// Pure helper that composes a read-only "episode detail" view-model from
// either an in-memory IPC decision (live scan on the active accession) or a
// persisted ipc_signals row (from the tenant-wide /ipc dashboard). No React,
// no network, no IO. UI components consume the resulting object verbatim.
//
// Keeping this file framework-agnostic guarantees IPC logic stays out of
// React components per the Stage 4 boundary.

import type { Accession, Isolate, PhenotypeFlag } from "../domain/types";
import type { IPCDecision } from "./ipcEngine";
import type { IPCAction, EscalationTiming } from "../config/ipcRules";

export interface IPCEpisodeDetail {
  /** Stable key for React lists. */
  key: string;
  /** Accession row id when known (persisted signals only). */
  accessionRowId?: string;
  /** Domain accession id (MB25-…) when resolvable. */
  accessionDisplayId?: string;
  patientLabel: string;
  mrn?: string;
  ward?: string;
  specimenFamily?: string;
  specimenSubtype?: string;
  organismCode?: string;
  organismDisplay?: string;
  phenotypes: PhenotypeFlag[] | string[];
  expertRules: string[];
  ruleCode: string;
  message: string;
  actions: IPCAction[] | string[];
  notify: string[];
  timing: EscalationTiming | string;
  episodeStatus: "new" | "repeat";
  clearanceProgress?: { negativeCount: number; required: number };
  /** Raw prior accession ids (domain ids, e.g. MB25-…). Kept for back-compat. */
  priorAccessionIds: string[];
  /** Resolved prior cases — populated when an accession lookup is supplied. */
  priorCases: Array<{
    id: string;
    accessionDisplayId?: string;
    patientLabel?: string;
    ward?: string;
  }>;
  /** Human-readable basis for the rolling window, e.g. "MRSA_ALERT · 90d window · same MRN". */
  windowBasis?: string;
  raisedAt?: string;
  source: "live_decision" | "persisted_signal";
}

function patientLabel(a: Accession): string {
  const fn = a.patient.familyName ?? "";
  const gn = a.patient.givenName ?? "";
  const name = `${fn}${fn && gn ? ", " : ""}${gn}`.trim();
  return name || a.patient.mrn || "Unknown patient";
}

function expertRulesFor(accession: Accession, isolate: Isolate | undefined): string[] {
  if (!isolate) return [];
  const codes = new Set<string>();
  for (const r of accession.ast) {
    if (r.isolateId !== isolate.id) continue;
    for (const f of r.expertRulesFired ?? []) codes.add(f.ruleCode);
  }
  return Array.from(codes);
}

/** Build a detail view-model from a live engine decision + the active accession.
 *  When `priorLookup` is supplied, prior accession ids are resolved into
 *  `{id, accessionDisplayId, patientLabel, ward}` chips for the drawer. The
 *  lookup is intentionally generic so the same builder can later be fed by a
 *  server query without changing the contract. */
export function detailFromDecision(
  accession: Accession,
  decision: IPCDecision,
  accessionRowId?: string,
  priorLookup?: (id: string) => Accession | undefined,
  windowDays?: number,
): IPCEpisodeDetail {
  const iso = accession.isolates.find((i) => i.id === decision.isolateId);
  const priorIds = decision.priorAccessionIds ?? [];
  const priorCases = priorIds.map((id) => {
    const a = priorLookup?.(id);
    return {
      id,
      accessionDisplayId: a?.accessionNumber,
      patientLabel: a ? patientLabel(a) : undefined,
      ward: a?.patient.ward,
    };
  });
  const windowBasis = windowDays
    ? `${decision.ruleCode} · ${windowDays}d rolling window · same MRN`
    : `${decision.ruleCode} · same MRN (local cohort)`;
  return {
    key: `${accession.id}:${decision.isolateId}:${decision.ruleCode}`,
    accessionRowId,
    accessionDisplayId: accession.accessionNumber,
    patientLabel: patientLabel(accession),
    mrn: accession.patient.mrn,
    ward: accession.patient.ward,
    specimenFamily: accession.specimen.familyCode,
    specimenSubtype: accession.specimen.subtypeCode,
    organismCode: decision.organismCode,
    organismDisplay: iso?.organismDisplay,
    phenotypes: decision.phenotypes,
    expertRules: expertRulesFor(accession, iso),
    ruleCode: decision.ruleCode,
    message: decision.message,
    actions: decision.actions,
    notify: decision.notify,
    timing: decision.timing,
    episodeStatus: decision.isNewEpisode ? "new" : "repeat",
    clearanceProgress: decision.clearanceProgress,
    priorAccessionIds: priorIds,
    priorCases,
    windowBasis,
    source: "live_decision",
  };
}

/** Shape mirrors the ipc_signals row consumed by /ipc. */
export interface PersistedSignalLike {
  id: string;
  accession_id: string;
  isolate_id: string;
  rule_code: string;
  organism_code: string | null;
  phenotypes: string[];
  message: string;
  timing: string;
  actions: string[];
  notify: string[];
  mrn: string | null;
  ward: string | null;
  raised_at: string;
}

/** Build a detail view-model from a persisted ipc_signals row.
 *  When the linked accession.data is loaded it can be passed to enrich
 *  patient name / specimen / organism display fields. */
export function detailFromPersistedSignal(
  row: PersistedSignalLike,
  linkedAccession?: Accession | null,
): IPCEpisodeDetail {
  const iso = linkedAccession?.isolates.find((i) => i.id === row.isolate_id);
  return {
    key: row.id,
    accessionRowId: row.accession_id,
    accessionDisplayId: linkedAccession?.accessionNumber,
    patientLabel: linkedAccession ? patientLabel(linkedAccession) : (row.mrn ?? "Unknown patient"),
    mrn: row.mrn ?? linkedAccession?.patient.mrn,
    ward: row.ward ?? linkedAccession?.patient.ward,
    specimenFamily: linkedAccession?.specimen.familyCode,
    specimenSubtype: linkedAccession?.specimen.subtypeCode,
    organismCode: row.organism_code ?? undefined,
    organismDisplay: iso?.organismDisplay,
    phenotypes: row.phenotypes,
    expertRules: linkedAccession ? expertRulesFor(linkedAccession, iso) : [],
    ruleCode: row.rule_code,
    message: row.message,
    actions: row.actions,
    notify: row.notify,
    timing: row.timing,
    // Persisted signals are written only on isNewEpisode = true, so by
    // construction they represent fresh episodes at write time. Repeat
    // detection for that MRN+rule will surface as separate signals on
    // later cases, not by mutating this row.
    episodeStatus: "new",
    priorAccessionIds: [],
    priorCases: [],
    raisedAt: row.raised_at,
    source: "persisted_signal",
  };
}
