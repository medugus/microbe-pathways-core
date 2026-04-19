// IPC engine — pure.
// Computes IPC signals from organism + phenotype + ward + time window.
// Supports rolling windows, dedup per patient episode, and clearance counts.

import type { Accession, IPCSignal, Isolate, MeduguState, PhenotypeFlag } from "../domain/types";
import { evaluateIsolate } from "./astEngine";
import { rulesFor, type IPCRule, type IPCAction, type EscalationTiming } from "../config/ipcRules";
import { newId } from "../domain/ids";
import { IPCFlag } from "../domain/enums";

export interface IPCDecision {
  isolateId: string;
  ruleCode: string;
  message: string;
  actions: IPCAction[];
  notify: string[];
  timing: EscalationTiming;
  organismCode?: string;
  phenotypes: PhenotypeFlag[];
  /** True when this is a fresh signal (not deduped against prior episode). */
  isNewEpisode: boolean;
  /** Clearance progress for screen pathways: e.g. 1/3. */
  clearanceProgress?: { negativeCount: number; required: number };
}

export interface IPCReport {
  decisions: IPCDecision[];
  signals: IPCSignal[];
}

function flagFor(rule: IPCRule): IPCFlag {
  if (rule.ruleCode === "CRE_ALERT" || rule.ruleCode === "CRAB_ALERT" || rule.ruleCode === "CRPA_ALERT") {
    return IPCFlag.CarbapenemResistant;
  }
  if (rule.ruleCode === "CAURIS_ALERT" || rule.ruleCode === "MRSA_ALERT" || rule.ruleCode === "VRE_ALERT") {
    return IPCFlag.AlertOrganism;
  }
  return IPCFlag.AlertOrganism;
}

function withinWindow(thenIso: string, days: number): boolean {
  const t = new Date(thenIso).getTime();
  return Date.now() - t <= days * 86_400_000;
}

export function evaluateIPC(
  accession: Accession,
  allAccessions?: MeduguState["accessions"],
): IPCReport {
  const decisions: IPCDecision[] = [];
  const signals: IPCSignal[] = [];

  for (const iso of accession.isolates) {
    const ruleOut = evaluateIsolate(accession, iso);
    const phenotypes: PhenotypeFlag[] = ruleOut.phenotypeFlags;
    const ward = accession.patient.ward;
    const matched = rulesFor(iso.organismCode, phenotypes as string[], ward);

    for (const rule of matched) {
      // Dedup against prior accessions for the same patient/MRN within window
      let isNewEpisode = true;
      if (allAccessions && rule.rollingWindowDays) {
        const priors = Object.values(allAccessions).filter(
          (a) =>
            a.id !== accession.id &&
            a.patient.mrn === accession.patient.mrn &&
            withinWindow(a.createdAt, rule.rollingWindowDays!),
        );
        const seenSame = priors.some((a) =>
          a.ipc.some((s) => s.ruleCode === rule.ruleCode && s.organismCode === iso.organismCode),
        );
        if (seenSame) isNewEpisode = false;
      }

      // Clearance for screen pathway
      let clearanceProgress: IPCDecision["clearanceProgress"];
      if (rule.clearanceCount && allAccessions) {
        const negatives = Object.values(allAccessions).filter(
          (a) =>
            a.patient.mrn === accession.patient.mrn &&
            a.specimen.familyCode === "COLONISATION" &&
            a.isolates.every((i) => i.organismCode === "NOGRO" || i.significance === "normal_flora"),
        );
        clearanceProgress = { negativeCount: negatives.length, required: rule.clearanceCount };
      }

      const decision: IPCDecision = {
        isolateId: iso.id,
        ruleCode: rule.ruleCode,
        message: rule.message,
        actions: rule.actions,
        notify: rule.notify,
        timing: rule.timing,
        organismCode: iso.organismCode,
        phenotypes,
        isNewEpisode,
        clearanceProgress,
      };
      decisions.push(decision);

      // Only emit a fresh signal if it's a new episode
      if (isNewEpisode) {
        signals.push({
          id: newId("ipc"),
          flag: flagFor(rule),
          organismCode: iso.organismCode,
          ruleCode: rule.ruleCode,
          message: rule.message,
          raisedAt: new Date().toISOString(),
        });
      }
    }
  }

  return { decisions, signals };
}

export type { Isolate };
