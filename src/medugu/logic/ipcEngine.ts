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
  /** Prior accessions (same MRN, within rolling window) that contributed
   * to dedup / repeat-episode detection. Empty for first occurrences. */
  priorAccessionIds?: string[];
}

export interface IPCReport {
  decisions: IPCDecision[];
  signals: IPCSignal[];
}

const DEFAULT_SPECIMEN_IPC_ADVICE =
  "Review IPC implications according to organism, phenotype, clinical syndrome, and local policy.";

const SPECIMEN_IPC_ADVICE_BY_FAMILY: Record<string, string> = {
  BLOOD:
    "Bloodstream isolate: review source, line association, placement precautions, and repeat culture pathway according to local policy.",
  URINE:
    "Urine isolate: interpret with symptoms and catheter status. Escalate IPC primarily when alert organism, MDRO, CRE/CPE, VRE, MRSA, or outbreak context is present.",
  LRT: "Respiratory specimen: assess droplet/airborne/contact precautions according to organism, transmissibility, and local respiratory isolation policy.",
  STERILE_FLUID:
    "Sterile-site isolate: urgent clinical awareness; escalate IPC if alert organism or transmissible/resistant phenotype is present.",
  COLONISATION:
    "Screening specimen: treat as colonisation/surveillance context unless clinical infection is documented; follow local screening and decolonisation pathway where applicable.",
};

const SPECIMEN_IPC_CONTEXT_BY_FAMILY: Record<string, string> = {
  BLOOD: "bloodstream isolate",
  URINE: "urine specimen",
  LRT: "respiratory specimen",
  STERILE_FLUID: "sterile-site specimen",
  COLONISATION: "screening specimen",
};

export function getSpecimenIPCAdvice(accession: Accession, _decision?: IPCDecision): string {
  return (
    SPECIMEN_IPC_ADVICE_BY_FAMILY[accession.specimen.familyCode] ?? DEFAULT_SPECIMEN_IPC_ADVICE
  );
}

export function getSpecimenIPCContext(accession: Accession): string {
  return SPECIMEN_IPC_CONTEXT_BY_FAMILY[accession.specimen.familyCode] ?? "other/unknown specimen";
}

function flagFor(rule: IPCRule): IPCFlag {
  if (["CRE_ALERT", "CRAB_ALERT", "CRPA_ALERT"].includes(rule.ruleCode)) {
    return IPCFlag.CarbapenemResistant;
  }
  if (["CAURIS_ALERT"].includes(rule.ruleCode)) {
    return IPCFlag.XDR;
  }
  if (["MRSA_ALERT", "VRE_ALERT"].includes(rule.ruleCode)) {
    return IPCFlag.MDRO;
  }
  return IPCFlag.AlertOrganism;
}

function withinWindow(thenIso: string, days: number): boolean {
  const t = new Date(thenIso).getTime();
  return Date.now() - t <= days * 86_400_000;
}

export function deriveIPCSignals(
  accession: Accession,
  allAccessions?: MeduguState["accessions"],
): IPCReport {
  const decisions: IPCDecision[] = [];
  const signals: IPCSignal[] = [];
  const seenDecisionKeys = new Set<string>();

  for (const iso of accession.isolates) {
    const ruleOut = evaluateIsolate(accession, iso);
    const phenotypes: PhenotypeFlag[] = ruleOut.phenotypeFlags;
    const ward = accession.patient.ward;
    const matched = rulesFor(iso.organismCode, phenotypes as string[], ward);

    for (const rule of matched) {
      const decisionKey = `${iso.id}|${rule.ruleCode}`;
      if (seenDecisionKeys.has(decisionKey)) continue;
      seenDecisionKeys.add(decisionKey);

      // Dedup against prior accessions for the same patient/MRN within window
      let isNewEpisode = true;
      let priorAccessionIds: string[] = [];
      if (allAccessions && rule.rollingWindowDays) {
        const priors = Object.values(allAccessions).filter(
          (a) =>
            a.id !== accession.id &&
            a.patient.mrn === accession.patient.mrn &&
            withinWindow(a.createdAt, rule.rollingWindowDays!),
        );
        const contributing = priors.filter((a) =>
          a.ipc.some((s) => s.ruleCode === rule.ruleCode && s.organismCode === iso.organismCode),
        );
        if (contributing.length > 0) {
          isNewEpisode = false;
          priorAccessionIds = contributing.map((a) => a.id);
        }
      }

      // Clearance for screen pathway
      let clearanceProgress: IPCDecision["clearanceProgress"];
      if (rule.clearanceCount && allAccessions) {
        const negatives = Object.values(allAccessions).filter(
          (a) =>
            a.patient.mrn === accession.patient.mrn &&
            a.specimen.familyCode === "COLONISATION" &&
            a.isolates.every(
              (i) => i.organismCode === "NOGRO" || i.significance === "normal_flora",
            ),
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
        priorAccessionIds: priorAccessionIds.length > 0 ? priorAccessionIds : undefined,
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

export function evaluateIPC(
  accession: Accession,
  allAccessions?: MeduguState["accessions"],
): IPCReport {
  return deriveIPCSignals(accession, allAccessions);
}

export type { Isolate };
