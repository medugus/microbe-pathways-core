import type { Accession, Isolate } from "../domain/types";
import { AST_PANELS, type ASTPanelDef } from "../config/antibiotics";
import { PRIMARY_STANDARD, SECONDARY_STANDARD } from "../config/breakpoints";
import { getOrganism, type OrganismDef } from "../config/organisms";
import { getColonisationScreenPathway } from "./specimenResolver";

const SCREEN_ONLY_PANEL_IDS = new Set<ASTPanelDef["id"]>([
  "mrsa_screen",
  "vre_screen",
  "cpe_screen",
  "crab_screen",
  "crpa_screen",
]);

function isUrineFamily(accession?: Accession): boolean {
  return accession?.specimen.familyCode === "URINE";
}

function getScreenPathway(accession?: Accession) {
  return getColonisationScreenPathway(
    accession?.specimen.familyCode,
    accession?.specimen.subtypeCode,
  );
}

function getIsolateOrganism(isolate?: Isolate): OrganismDef | undefined {
  if (!isolate?.organismCode) return undefined;
  return getOrganism(isolate.organismCode);
}

function getIsolateOrganismGroup(isolate?: Isolate): OrganismDef["group"] | undefined {
  return getIsolateOrganism(isolate)?.group;
}

function panelSortWeight(panel: ASTPanelDef, accession?: Accession): number {
  const pathway = getScreenPathway(accession);
  if (pathway?.defaultAstPanelId === panel.id) return -20;
  if (pathway && pathway.allowedAstPanelIds.includes(panel.id)) return -10;
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
  const org = getIsolateOrganism(isolate);
  if (!org || org.noAst) return false;

  const pathway = getScreenPathway(accession);
  if (pathway) {
    if (!isolate?.organismCode || !pathway.organismCodes.includes(isolate.organismCode)) {
      return false;
    }
    if (pathway.allowedAstPanelIds.length === 0) return false;
    if (!pathway.allowedAstPanelIds.includes(panel.id)) return false;
  } else if (SCREEN_ONLY_PANEL_IDS.has(panel.id)) {
    return false;
  }

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
  const eligible = AST_PANELS.filter((panel) => isASTPanelEligibleForIsolate(panel, isolate, accession));

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
  const org = getIsolateOrganism(isolate);
  if (!org || org.noAst) return undefined;

  const eligible = getEligibleASTPanelsForIsolate(accession, isolate);
  const pathway = getScreenPathway(accession);
  if (eligible.length === 0) {
    return pathway ? undefined : AST_PANELS.find((panel) => panel.id === "other");
  }

  if (pathway?.defaultAstPanelId) {
    const preferredScreenPanel = eligible.find((panel) => panel.id === pathway.defaultAstPanelId);
    if (preferredScreenPanel) return preferredScreenPanel;
  }

  const preferred = eligible.find((panel) => panel.id !== "reserve_cre" && panel.id !== "other");
  return preferred ?? eligible[0];
}

export function getDefaultASTStandardForPanel(panel?: ASTPanelDef) {
  if (
    panel?.id === "mrsa_screen" ||
    panel?.id === "vre_screen" ||
    panel?.id === "cpe_screen" ||
    panel?.id === "crab_screen" ||
    panel?.id === "crpa_screen" ||
    panel?.id === "enterobacterales" ||
    panel?.id === "urine_enterobacterales" ||
    panel?.id === "staphylococcus" ||
    panel?.id === "nonfermenters" ||
    panel?.id === "streptococcus" ||
    panel?.id === "enterococcus" ||
    panel?.id === "haemophilus_moraxella"
  ) {
    return SECONDARY_STANDARD;
  }

  return PRIMARY_STANDARD;
}
