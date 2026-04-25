import type { Accession, MeduguState } from "../domain/types";

export type ColonisationScreenPurpose = "admission" | "contact" | "weekly" | "clearance" | "unknown";
export type ColonisationScreenResult = "positive" | "negative" | "pending" | "not_applicable";
export type ColonisationEpisodeStatus =
  | "new_carrier"
  | "known_carrier"
  | "clearance_attempt"
  | "cleared"
  | "not_applicable";
export type ColonisationIsolationStatus = "required" | "continue" | "review" | "not_required" | "unknown";
export type ColonisationDecolonisationStatus =
  | "not_applicable"
  | "recommended"
  | "in_progress"
  | "completed"
  | "unknown";

export interface ColonisationContext {
  isScreen: boolean;
  targetOrganism?: string;
  screenPurpose?: ColonisationScreenPurpose;
  screenResult?: ColonisationScreenResult;
  episodeStatus?: ColonisationEpisodeStatus;
  clearanceCount?: number;
  clearanceRequired?: number;
  lastPositiveDate?: string;
  daysSinceLastPositive?: number;
  isolationStatus?: ColonisationIsolationStatus;
  decolonisationStatus?: ColonisationDecolonisationStatus;
  nextAction?: string;
  limitationNote?: string;
}

const DEFAULT_CLEARANCE_REQUIRED = 3;

const SCREEN_TARGET_BY_SUBTYPE: Record<string, string> = {
  COL_MRSA_NOSE: "MRSA",
  COL_MRSA_GROIN: "MRSA",
  COL_VRE_RECTAL: "VRE",
  COL_CPE_RECTAL: "CRE / carbapenemase-producing Enterobacterales",
  COL_CANDIDA_AURIS: "Candida auris",
  COL_CRAB_SCREEN: "CRAB",
  COL_CRPA_SCREEN: "CRPA",
};

const LIMITATION_NOTE =
  "Clearance counter uses cases currently loaded in this browser. Production clearance certification requires backend persistence and policy-configured lookback.";

function accessionDateMs(accession: Accession): number {
  const dateIso = accession.specimen.collectedAt ?? accession.createdAt;
  const parsed = Date.parse(dateIso);
  return Number.isFinite(parsed) ? parsed : 0;
}

function sortByDateAsc(accessions: Accession[]): Accession[] {
  return [...accessions].sort((a, b) => accessionDateMs(a) - accessionDateMs(b));
}

function getScreenResult(accession: Accession): ColonisationScreenResult {
  if (!isColonisationScreen(accession)) return "not_applicable";
  if (accession.isolates.length === 0) return "pending";

  const hasPositiveSignal = accession.isolates.some(
    (iso) =>
      iso.organismCode !== "NOGRO" &&
      iso.significance !== "normal_flora" &&
      iso.significance !== "mixed_growth" &&
      iso.significance !== "indeterminate",
  );
  if (hasPositiveSignal) return "positive";

  const allNegativeLike = accession.isolates.every(
    (iso) =>
      iso.organismCode === "NOGRO" ||
      iso.significance === "normal_flora" ||
      iso.significance === "mixed_growth" ||
      iso.significance === "indeterminate",
  );
  return allNegativeLike ? "negative" : "pending";
}

function inferPurpose(accession: Accession): ColonisationScreenPurpose {
  if (!isColonisationScreen(accession)) return "unknown";
  const descriptor = `${accession.specimen.freeTextLabel ?? ""} ${accession.specimen.subtypeCode}`.toLowerCase();
  if (descriptor.includes("clearance")) return "clearance";
  if (descriptor.includes("contact")) return "contact";
  if (descriptor.includes("weekly")) return "weekly";
  if (descriptor.includes("admission") || descriptor.includes("screen")) return "admission";
  return "unknown";
}

export function isColonisationScreen(accession: Accession): boolean {
  return accession.specimen.familyCode === "COLONISATION" || accession.specimen.subtypeCode.startsWith("COL_");
}

export function getTargetOrganismForScreen(accession: Accession): string | undefined {
  if (!isColonisationScreen(accession)) return undefined;

  const fromSubtype = SCREEN_TARGET_BY_SUBTYPE[accession.specimen.subtypeCode];
  if (fromSubtype) return fromSubtype;

  const label = `${accession.specimen.freeTextLabel ?? ""}`.toLowerCase();
  if (label.includes("mrsa")) return "MRSA";
  if (label.includes("vre")) return "VRE";
  if (label.includes("cpe") || label.includes("cre")) return "CRE / carbapenemase-producing Enterobacterales";
  if (label.includes("crab")) return "CRAB";
  if (label.includes("crpa")) return "CRPA";
  if (label.includes("auris")) return "Candida auris";

  return undefined;
}

function samePatientSameTarget(accession: Accession, candidate: Accession): boolean {
  if (accession.patient.mrn !== candidate.patient.mrn) return false;
  if (!isColonisationScreen(candidate)) return false;
  return getTargetOrganismForScreen(accession) === getTargetOrganismForScreen(candidate);
}

export function getLastPositiveScreen(
  accession: Accession,
  allAccessions?: MeduguState["accessions"],
): Accession | undefined {
  if (!allAccessions || !isColonisationScreen(accession)) return undefined;

  const ordered = sortByDateAsc(Object.values(allAccessions));
  const currentTime = accessionDateMs(accession);
  const prior = ordered.filter(
    (candidate) =>
      candidate.id !== accession.id &&
      accessionDateMs(candidate) <= currentTime &&
      samePatientSameTarget(accession, candidate) &&
      getScreenResult(candidate) === "positive",
  );

  return prior[prior.length - 1];
}

export function calculateClearanceCounter(
  accession: Accession,
  allAccessions?: MeduguState["accessions"],
): { count: number; required: number; priorPositiveFound: boolean } {
  const required = DEFAULT_CLEARANCE_REQUIRED;
  if (!allAccessions || !isColonisationScreen(accession)) {
    return { count: 0, required, priorPositiveFound: false };
  }

  const all = sortByDateAsc(Object.values(allAccessions)).filter((candidate) =>
    samePatientSameTarget(accession, candidate),
  );

  const lastPositive = getLastPositiveScreen(accession, allAccessions);
  if (!lastPositive) {
    return { count: 0, required, priorPositiveFound: false };
  }

  const lastPositiveTime = accessionDateMs(lastPositive);
  const currentTime = accessionDateMs(accession);
  const attempts = all.filter(
    (candidate) => accessionDateMs(candidate) > lastPositiveTime && accessionDateMs(candidate) <= currentTime,
  );

  let sequentialNegativeCount = 0;
  for (const candidate of attempts) {
    const result = getScreenResult(candidate);
    if (result === "negative") {
      sequentialNegativeCount += 1;
      continue;
    }
    if (result === "positive") {
      sequentialNegativeCount = 0;
    }
  }

  return { count: sequentialNegativeCount, required, priorPositiveFound: true };
}

export function getSuggestedNextScreenAction(context: ColonisationContext): string {
  if (!context.isScreen) return "Not a colonisation-screen workflow.";

  if (context.screenResult === "positive") {
    return "Notify IPC, continue or initiate contact precautions, update carrier status, and schedule follow-up colonisation screen per local policy.";
  }

  if (context.episodeStatus === "clearance_attempt") {
    return "Continue precautions pending required negative screens.";
  }

  if (context.episodeStatus === "cleared") {
    return "Review for discontinuation of precautions according to local IPC policy.";
  }

  if (context.screenResult === "pending") {
    return "Await screening result and maintain interim precautions according to risk profile and local policy.";
  }

  return "Continue colonisation-screen workflow according to local policy and browser-local lookback findings.";
}

export function deriveColonisationContext(
  accession: Accession,
  allAccessions?: MeduguState["accessions"],
): ColonisationContext {
  const isScreen = isColonisationScreen(accession);
  if (!isScreen) {
    return {
      isScreen: false,
      screenResult: "not_applicable",
      episodeStatus: "not_applicable",
      decolonisationStatus: "not_applicable",
      limitationNote: "Not a colonisation-screen workflow.",
      nextAction: "Not a colonisation-screen workflow.",
    };
  }

  const screenResult = getScreenResult(accession);
  const targetOrganism = getTargetOrganismForScreen(accession);
  const screenPurpose = inferPurpose(accession);
  const { count, required, priorPositiveFound } = calculateClearanceCounter(accession, allAccessions);
  const lastPositive = getLastPositiveScreen(accession, allAccessions);

  let episodeStatus: ColonisationEpisodeStatus = "not_applicable";
  if (screenResult === "positive") {
    episodeStatus = lastPositive ? "known_carrier" : "new_carrier";
  } else if (priorPositiveFound) {
    episodeStatus = count >= required ? "cleared" : "clearance_attempt";
  }

  let isolationStatus: ColonisationIsolationStatus = "unknown";
  if (screenResult === "positive") isolationStatus = "required";
  else if (episodeStatus === "clearance_attempt") isolationStatus = "continue";
  else if (episodeStatus === "cleared") isolationStatus = "review";
  else if (screenResult === "negative") isolationStatus = "not_required";

  let decolonisationStatus: ColonisationDecolonisationStatus = "unknown";
  if (targetOrganism === "MRSA") {
    if (screenResult === "positive") decolonisationStatus = "recommended";
    else if (episodeStatus === "clearance_attempt") decolonisationStatus = "in_progress";
    else if (episodeStatus === "cleared") decolonisationStatus = "completed";
    else decolonisationStatus = "not_applicable";
  } else {
    decolonisationStatus = "not_applicable";
  }

  const lastPositiveDate = lastPositive?.specimen.collectedAt ?? lastPositive?.createdAt;
  const daysSinceLastPositive =
    lastPositiveDate && Number.isFinite(Date.parse(lastPositiveDate))
      ? Math.max(0, Math.floor((Date.now() - Date.parse(lastPositiveDate)) / 86_400_000))
      : undefined;

  const limitationNote = priorPositiveFound
    ? LIMITATION_NOTE
    : `${LIMITATION_NOTE} Also: prior positive not found in browser-local dataset.`;

  const context: ColonisationContext = {
    isScreen,
    targetOrganism,
    screenPurpose,
    screenResult,
    episodeStatus,
    clearanceCount: count,
    clearanceRequired: required,
    lastPositiveDate,
    daysSinceLastPositive,
    isolationStatus,
    decolonisationStatus,
    limitationNote,
  };

  return {
    ...context,
    nextAction: getSuggestedNextScreenAction(context),
  };
}
