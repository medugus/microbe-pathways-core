import type { Accession, Isolate } from "../domain/types";
import { AST_PANELS, type ASTPanelDef } from "../config/antibiotics";
import { getOrganism, type OrganismDef } from "../config/organisms";

function isUrineFamily(accession?: Accession): boolean {
  return accession?.specimen.familyCode === "URINE";
}

function getIsolateOrganismGroup(isolate?: Isolate): OrganismDef["group"] | undefined {
  if (!isolate?.organismCode) return undefined;
  return getOrganism(isolate.organismCode)?.group;
}

function panelSortWeight(panel: ASTPanelDef, accession?: Accession): number {
  if (panel.id === "other") return 999;
  if (panel.id === "reserve_cre") return 90;
  if (panel.id === "urine_enterobacterales") {
    return isUrineFamily(accession) ? 0 : 20;
  }
  if (panel.id === "enterobacterales") {
    return isUrineFamily(accession) ? 10 : 0;
  }
  return 0;
}

export function isASTPanelEligibleForIsolate(
  panel: ASTPanelDef,
  isolate?: Isolate,
  accession?: Accession,
): boolean {
  if (panel.id === "other") return true;

  const group = getIsolateOrganismGroup(isolate);
  if (!group || !panel.allowedOrganismGroups || panel.allowedOrganismGroups.length === 0) {
    return false;
  }

  if (!panel.allowedOrganismGroups.includes(group)) {
    return false;
  }

  if (panel.id === "urine_enterobacterales" && !isUrineFamily(accession)) {
    return false;
  }

  return true;
}

export function getEligibleASTPanelsForIsolate(
  accession?: Accession,
  isolate?: Isolate,
): ASTPanelDef[] {
  const eligible = AST_PANELS.filter((panel) =>
    isASTPanelEligibleForIsolate(panel, isolate, accession),
  );

  return eligible
    .map((panel, index) => ({ panel, index }))
    .sort((a, b) => {
      const weightDiff = panelSortWeight(a.panel, accession) - panelSortWeight(b.panel, accession);
      if (weightDiff !== 0) return weightDiff;
      return a.index - b.index;
    })
    .map((entry) => entry.panel);
}

export function getDefaultASTPanelForIsolate(
  accession?: Accession,
  isolate?: Isolate,
): ASTPanelDef | undefined {
  const eligible = getEligibleASTPanelsForIsolate(accession, isolate);
  if (eligible.length === 0) {
    return AST_PANELS.find((panel) => panel.id === "other");
  }

  const preferred = eligible.find((panel) => panel.id !== "reserve_cre" && panel.id !== "other");
  return preferred ?? eligible[0];
}
