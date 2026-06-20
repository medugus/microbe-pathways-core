// Pure builder for the Zone Reader worklist export.
//
// Produces a FLAT envelope: every field at the JSON root, no `worklist`
// wrapper. Matches the Zone Reader importer's strict shape.

import type { Accession } from "../../domain/types";
import { getASTPanel, getAntibiotic } from "../../config/antibiotics";
import { PRIMARY_STANDARD } from "../../config/breakpoints";
import { getDiscPotency } from "../../config/discPotencies";
import {
  DISC_POTENCY_PLACEHOLDER,
  ZONE_READER_CONTRACT_VERSION,
  ZONE_READER_SOURCE_SYSTEM,
  type ZoneReaderStandard,
  type ZoneReaderWorklistExport,
} from "./types";


export interface BuildWorklistInput {
  accession: Accession;
  isolateId: string;
  astPanelId: string;
  /** Override clock for tests. Defaults to new Date(). */
  now?: Date;
  /** Breakpoint standard in force; defaults to whatever the AST rows declare. */
  standard?: ZoneReaderStandard;
}

export class ZoneReaderExportError extends Error {}

export interface ZoneReaderWorklistWarning {
  field: "patientDisplayId" | "specimenType" | "organismName" | "organismCode" | "standard";
  message: string;
}

const FALLBACK_PATIENT_DISPLAY_ID = "unknown-patient";
const FALLBACK_SPECIMEN_TYPE = "unknown-specimen";
const FALLBACK_ORGANISM_NAME = "unknown organism";
const FALLBACK_ORGANISM_CODE = "UNKNOWN_ORGANISM";

function nonEmpty(value: unknown, fallback: string): string {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  return trimmed || fallback;
}

/** Coarse organism-group derivation from an organism code. */
function deriveOrganismGroup(organismCode?: string | null): string {
  if (!organismCode) return "";
  const code = organismCode.toUpperCase();
  if (code.startsWith("EFAM") || code.includes("ENTEROCOC")) return "enterococcus";
  if (code.startsWith("SAUR") || code.startsWith("STAPH") || code.includes("MRSA")) {
    return "staphylococcus";
  }
  if (code.startsWith("SPNE") || code.startsWith("STREP") || code.startsWith("GBS")) {
    return "streptococcus";
  }
  if (
    code.startsWith("ECOL") ||
    code.startsWith("KPN") ||
    code.startsWith("ENTB") ||
    code.startsWith("ENB") ||
    code.startsWith("CITRO") ||
    code.startsWith("PROT") ||
    code.startsWith("SERR")
  ) {
    return "enterobacterales";
  }
  if (code.startsWith("PAER") || code.startsWith("ACINE") || code.startsWith("STENO")) {
    return "non_fermenter";
  }
  if (code.startsWith("HFLU") || code.startsWith("MCAT")) return "fastidious";
  if (code.startsWith("CAND") || code.startsWith("YEAST")) return "candida";
  return "other";
}

export function buildWorklistExport(input: BuildWorklistInput): ZoneReaderWorklistExport {
  const { accession, isolateId, astPanelId } = input;
  const isolate = accession.isolates.find((i) => i.id === isolateId);
  if (!isolate) throw new ZoneReaderExportError(`Isolate ${isolateId} not found on accession`);

  const panel = getASTPanel(astPanelId);
  if (!panel) throw new ZoneReaderExportError(`AST panel ${astPanelId} not found`);

  const expectedDiscs = panel.codes.map((code) => {
    const ab = getAntibiotic(code);
    return {
      antibioticCode: code,
      antibioticName: ab?.display ?? null,
      discPotency: getDiscPotency(code) ?? DISC_POTENCY_PLACEHOLDER,
      plateHint: ab?.display ?? null,
    };
  });

  const standardFromAst = accession.ast.find((a) => a.isolateId === isolateId)?.standard;
  const standard: ZoneReaderStandard =
    input.standard ??
    (standardFromAst as ZoneReaderStandard | undefined) ??
    (PRIMARY_STANDARD as ZoneReaderStandard);

  const patient = accession.patient;
  const specimen = accession.specimen;

  const now = (input.now ?? new Date()).toISOString();
  const worklistId = `${accession.id}:${isolate.id}:${panel.id}`;

  const envelope: ZoneReaderWorklistExport = {
    schemaVersion: ZONE_READER_CONTRACT_VERSION,
    sourceSystem: ZONE_READER_SOURCE_SYSTEM,
    createdAt: now,
    worklistId,

    accessionId: accession.id,
    accessionNumber: accession.accessionNumber,
    isolateId: isolate.id,

    patientDisplayId: nonEmpty(patient?.mrn, FALLBACK_PATIENT_DISPLAY_ID),

    specimenType: nonEmpty(specimen?.freeTextLabel ?? specimen?.subtypeCode, FALLBACK_SPECIMEN_TYPE),

    organismName: nonEmpty(isolate.organismDisplay, FALLBACK_ORGANISM_NAME),
    organismCode: nonEmpty(isolate.organismCode, FALLBACK_ORGANISM_CODE),
    organismGroup: deriveOrganismGroup(isolate.organismCode) || "unspecified",

    astPanelId: panel.id,
    astPanelName: panel.label,
    standard,

    expectedDiscs,
  };



  return envelope;
}

export function getWorklistExportWarnings(
  worklist: ZoneReaderWorklistExport,
): ZoneReaderWorklistWarning[] {
  const warnings: ZoneReaderWorklistWarning[] = [];
  if (worklist.patientDisplayId === FALLBACK_PATIENT_DISPLAY_ID) {
    warnings.push({
      field: "patientDisplayId",
      message: "Patient display identifier was missing; Zone Reader received unknown-patient.",
    });
  }
  if (worklist.specimenType === FALLBACK_SPECIMEN_TYPE) {
    warnings.push({
      field: "specimenType",
      message: "Specimen type was missing; Zone Reader received unknown-specimen.",
    });
  }
  if (worklist.organismName === FALLBACK_ORGANISM_NAME) {
    warnings.push({
      field: "organismName",
      message: "Organism name was missing; Zone Reader received unknown organism.",
    });
  }
  if (worklist.organismCode === FALLBACK_ORGANISM_CODE) {
    warnings.push({
      field: "organismCode",
      message: "Organism code was missing; organism-specific breakpoints may not resolve.",
    });
  }
  return warnings;
}
