import type { Accession, Isolate } from "../domain/types";
import type { ASTInterpretation } from "../domain/enums";
import { getOrganism } from "../config/organisms";
import { getSubtype } from "../config/specimenFamilies";
import { resolveSpecimen } from "./specimenResolver";

export interface ASTComparison {
  antibioticCode: string;
  priorInterpretation: ASTInterpretation;
  currentInterpretation: ASTInterpretation;
  worsening: boolean;
}

export interface PriorHistoryRow {
  accessionId: string;
  accessionNumber: string;
  date: string;
  specimenDisplay: string;
  context: "diagnostic" | "screening";
  organisms: string[];
  repeatOrganism: boolean;
  sameSpecimenSourceRecurrence: boolean;
  priorPhenotypes: string[];
  priorIPCSignal: boolean;
  priorColonisationPositive: boolean;
  astComparisons: ASTComparison[];
}

export interface CurrentRelevance {
  currentIPCSignalExists: boolean;
  repeatAlertOrganism: boolean;
  currentMatchesPriorColonisingOrganism: boolean;
  priorColonisationWithRelatedHighRiskGroup: boolean;
  susceptibilityWorsening: boolean;
  newResistantPhenotypeFlag: boolean;
}

export interface PatientMicrobiologyHistory {
  diagnosticHistory: PriorHistoryRow[];
  colonisationScreeningHistory: PriorHistoryRow[];
  priorMDROFlags: string[];
  currentRelevance: CurrentRelevance;
}

function normaliseText(value: string | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

function getPatientMatchKey(accession: Accession): string | null {
  const patientId = normaliseText((accession.patient as { id?: string }).id);
  if (patientId) return `id:${patientId}`;
  const mrn = normaliseText(accession.patient.mrn);
  if (mrn) return `mrn:${mrn}`;
  return null;
}

function isSamePatient(current: Accession, candidate: Accession): boolean {
  const currentKey = getPatientMatchKey(current);
  const candidateKey = getPatientMatchKey(candidate);
  if (!currentKey || !candidateKey) return false;
  return currentKey === candidateKey;
}

function getPriorDate(accession: Accession): string {
  return accession.releasedAt ?? accession.updatedAt ?? accession.createdAt;
}

function getSpecimenDisplay(accession: Accession): string {
  const resolved = resolveSpecimen(accession.specimen.familyCode, accession.specimen.subtypeCode);
  if (resolved.ok) return resolved.profile.displayName;
  return accession.specimen.freeTextLabel ?? accession.specimen.subtypeCode;
}

function isColonisationOrScreening(accession: Accession): boolean {
  if (accession.specimen.familyCode === "COLONISATION") return true;
  const subtype = getSubtype(accession.specimen.familyCode, accession.specimen.subtypeCode);
  return !!subtype?.tags?.includes("screen");
}

function isolateLabel(iso: Isolate): string {
  return iso.organismDisplay || iso.organismCode;
}

function isPositiveScreen(accession: Accession): boolean {
  return accession.isolates.some((iso) => !["NOGRO", "MIXED", "NORML"].includes(iso.organismCode));
}

function getPhenotypeFlags(accession: Accession): Set<string> {
  const flags = new Set<string>();
  for (const row of accession.ast) {
    for (const phenotype of row.phenotypeFlags ?? []) {
      if (
        phenotype === "MRSA" ||
        phenotype === "VRE" ||
        phenotype === "CRE" ||
        phenotype === "carbapenemase_suspected" ||
        phenotype === "ESBL"
      ) {
        flags.add(phenotype);
      }
    }
  }

  if (accession.ipc.some((signal) => signal.flag === "mdro")) flags.add("MDR");
  if (accession.ipc.some((signal) => signal.flag === "xdr")) flags.add("XDR");
  if (accession.isolates.some((iso) => iso.organismCode === "CAUR")) flags.add("Candida_auris");

  return flags;
}

function bestInterpretation(accession: Accession, isolateId: string, antibioticCode: string): ASTInterpretation | null {
  const row = accession.ast.find((entry) => entry.isolateId === isolateId && entry.antibioticCode === antibioticCode);
  return row?.finalInterpretation ?? row?.interpretedSIR ?? row?.rawInterpretation ?? null;
}

function isWorsening(prior: ASTInterpretation, current: ASTInterpretation): boolean {
  return (
    (prior === "S" && ["R", "I", "SDD", "NS"].includes(current)) ||
    ((prior === "I" || prior === "SDD") && current === "R")
  );
}

function organismMatch(currentIso: Isolate, priorIso: Isolate): boolean {
  if (currentIso.organismCode && priorIso.organismCode) {
    return currentIso.organismCode === priorIso.organismCode;
  }
  return normaliseText(currentIso.organismDisplay) === normaliseText(priorIso.organismDisplay);
}

function compareAccessionToCurrent(current: Accession, prior: Accession): {
  repeatOrganism: boolean;
  sameSpecimenSourceRecurrence: boolean;
  astComparisons: ASTComparison[];
} {
  const comparisons: ASTComparison[] = [];

  for (const currentIso of current.isolates) {
    for (const priorIso of prior.isolates) {
      if (!organismMatch(currentIso, priorIso)) continue;

      const priorRows = prior.ast.filter((row) => row.isolateId === priorIso.id);
      for (const priorRow of priorRows) {
        const priorInterpretation = bestInterpretation(prior, priorIso.id, priorRow.antibioticCode);
        const currentInterpretation = bestInterpretation(current, currentIso.id, priorRow.antibioticCode);
        if (!priorInterpretation || !currentInterpretation) continue;

        comparisons.push({
          antibioticCode: priorRow.antibioticCode,
          priorInterpretation,
          currentInterpretation,
          worsening: isWorsening(priorInterpretation, currentInterpretation),
        });
      }
    }
  }

  return {
    repeatOrganism:
      current.isolates.some((curr) => prior.isolates.some((prev) => organismMatch(curr, prev))),
    sameSpecimenSourceRecurrence:
      current.specimen.familyCode === prior.specimen.familyCode &&
      current.specimen.subtypeCode === prior.specimen.subtypeCode,
    astComparisons: comparisons,
  };
}

function buildPriorRow(current: Accession, prior: Accession): PriorHistoryRow {
  const cmp = compareAccessionToCurrent(current, prior);
  const phenotypes = Array.from(getPhenotypeFlags(prior));

  return {
    accessionId: prior.id,
    accessionNumber: prior.accessionNumber,
    date: getPriorDate(prior),
    specimenDisplay: getSpecimenDisplay(prior),
    context: isColonisationOrScreening(prior) ? "screening" : "diagnostic",
    organisms: prior.isolates.map(isolateLabel),
    repeatOrganism: cmp.repeatOrganism,
    sameSpecimenSourceRecurrence: cmp.sameSpecimenSourceRecurrence,
    priorPhenotypes: phenotypes,
    priorIPCSignal: prior.ipc.length > 0,
    priorColonisationPositive: isColonisationOrScreening(prior) && isPositiveScreen(prior),
    astComparisons: cmp.astComparisons,
  };
}

function patientPriors(current: Accession, allAccessions: Record<string, Accession> | Accession[]): Accession[] {
  const list = Array.isArray(allAccessions) ? allAccessions : Object.values(allAccessions);
  const currentKey = getPatientMatchKey(current);
  if (!currentKey) return [];

  return list
    .filter((candidate) => candidate.id !== current.id && isSamePatient(current, candidate))
    .sort((a, b) => new Date(getPriorDate(b)).getTime() - new Date(getPriorDate(a)).getTime());
}

export function compareCurrentIsolatesToPrior(
  currentAccession: Accession,
  allAccessions: Record<string, Accession> | Accession[],
): PriorHistoryRow[] {
  return patientPriors(currentAccession, allAccessions).map((prior) => buildPriorRow(currentAccession, prior));
}

export function getPriorMDROFlags(
  currentAccession: Accession,
  allAccessions: Record<string, Accession> | Accession[],
): string[] {
  const flags = new Set<string>();
  for (const prior of patientPriors(currentAccession, allAccessions)) {
    for (const flag of getPhenotypeFlags(prior)) flags.add(flag);
  }
  return Array.from(flags);
}

export function getPriorColonisationScreeningHistory(
  currentAccession: Accession,
  allAccessions: Record<string, Accession> | Accession[],
): PriorHistoryRow[] {
  return patientPriors(currentAccession, allAccessions)
    .filter((prior) => isColonisationOrScreening(prior))
    .map((prior) => buildPriorRow(currentAccession, prior));
}

export function derivePatientMicrobiologyHistory(
  currentAccession: Accession,
  allAccessions: Record<string, Accession> | Accession[],
): PatientMicrobiologyHistory {
  const priorRows = compareCurrentIsolatesToPrior(currentAccession, allAccessions);
  const diagnosticHistory = priorRows.filter((row) => row.context === "diagnostic");
  const colonisationScreeningHistory = priorRows.filter((row) => row.context === "screening");
  const currentPhenotypes = getPhenotypeFlags(currentAccession);
  const priorPhenotypes = new Set(getPriorMDROFlags(currentAccession, allAccessions));

  const currentEnterobacterales = currentAccession.isolates.some(
    (iso) => getOrganism(iso.organismCode)?.group === "enterobacterales",
  );

  const currentMatchesPriorColonisingOrganism = colonisationScreeningHistory.some(
    (row) => row.repeatOrganism && row.priorColonisationPositive,
  );

  const priorColonisationWithRelatedHighRiskGroup = colonisationScreeningHistory.some((row) => {
    if (!row.priorColonisationPositive) return false;

    const hasSameAlertOrganism = currentAccession.isolates.some(
      (iso) =>
        !!getOrganism(iso.organismCode)?.alert &&
        row.organisms.some((label) => normaliseText(label) === normaliseText(iso.organismDisplay)),
    );

    if (hasSameAlertOrganism) return true;

    const priorHadCREGroup = row.priorPhenotypes.some((flag) => flag === "CRE" || flag === "carbapenemase_suspected");
    return priorHadCREGroup && currentEnterobacterales;
  });

  return {
    diagnosticHistory,
    colonisationScreeningHistory,
    priorMDROFlags: Array.from(priorPhenotypes),
    currentRelevance: {
      currentIPCSignalExists: currentAccession.ipc.length > 0,
      repeatAlertOrganism: priorRows.some((row) => row.repeatOrganism && row.priorIPCSignal),
      currentMatchesPriorColonisingOrganism,
      priorColonisationWithRelatedHighRiskGroup,
      susceptibilityWorsening: priorRows.some((row) => row.astComparisons.some((item) => item.worsening)),
      newResistantPhenotypeFlag:
        priorRows.length > 0 && Array.from(currentPhenotypes).some((flag) => !priorPhenotypes.has(flag)),
    },
  };
}
