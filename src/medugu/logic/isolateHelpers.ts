// Pure helpers for isolate handling. No React.

import type { Accession, Isolate, IsolateSignificance } from "../domain/types";
import { getOrganism } from "../config/organisms";
import { newId } from "../domain/ids";

export function nextIsolateNumber(accession: Accession): number {
  const max = accession.isolates.reduce((m, i) => Math.max(m, i.isolateNo), 0);
  return max + 1;
}

export function buildIsolate(
  accession: Accession,
  organismCode: string,
  opts: Partial<Omit<Isolate, "id" | "isolateNo" | "organismCode" | "organismDisplay">> = {},
): Isolate {
  const def = getOrganism(organismCode);
  return {
    id: newId("iso"),
    isolateNo: nextIsolateNumber(accession),
    organismCode,
    organismDisplay: def?.display ?? organismCode,
    significance: opts.significance ?? "indeterminate",
    purityFlag: opts.purityFlag,
    mixedGrowth: opts.mixedGrowth,
    growthQuantifierCode: opts.growthQuantifierCode,
    colonyCountCfuPerMl: opts.colonyCountCfuPerMl,
    identifiedAt: opts.identifiedAt ?? new Date().toISOString(),
    identificationMethodCode: opts.identificationMethodCode,
    notes: opts.notes,
  };
}

/**
 * Phase-2 contextual hint for significance based on organism + specimen family.
 * Real interpretation lives in Phase 3 expert rules — this only seeds the UI.
 */
export function suggestSignificance(
  accession: Accession,
  organismCode: string,
): IsolateSignificance {
  const org = getOrganism(organismCode);
  if (!org) return "indeterminate";
  if (org.code === "MIXED") return "mixed_growth";
  if (org.code === "NORML") return "normal_flora";
  if (org.code === "NOGRO") return "indeterminate";
  if (accession.specimen.familyCode === "BLOOD" && org.commonSkinFlora) {
    return "probable_contaminant";
  }
  return "significant";
}

export function describeGrowth(i: Isolate): string {
  if (i.colonyCountCfuPerMl !== undefined) {
    return `${i.colonyCountCfuPerMl.toExponential(0)} CFU/mL`;
  }
  return i.growthQuantifierCode ?? "—";
}
