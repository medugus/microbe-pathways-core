// Pure builder for the Zone Reader worklist export.
//
// Produces a FLAT envelope: every field at the JSON root, no `worklist`
// wrapper. Matches the Zone Reader importer's strict shape.

import type { Accession } from "../../domain/types";
import { getASTPanel, getAntibiotic } from "../../config/antibiotics";
import {
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
      // Zone Reader importer rejects null for discPotency — empty string when unknown.
      discPotency: "",
      antibioticClass: ab?.class ?? null,
      awareCategory: null,
      reportabilityDefault: null,
      plateHint: ab?.display ?? null,
    };
  });

  const standardFromAst = accession.ast.find((a) => a.isolateId === isolateId)?.standard;
  const standard: ZoneReaderStandard | null =
    input.standard ?? (standardFromAst as ZoneReaderStandard | undefined) ?? null;

  const patient = accession.patient;
  const specimen = accession.specimen;
  const patientName =
    patient && (patient.givenName || patient.familyName)
      ? `${patient.givenName ?? ""} ${patient.familyName ?? ""}`.trim()
      : null;

  const now = (input.now ?? new Date()).toISOString();
  const worklistId = `${accession.id}:${isolate.id}:${panel.id}`;

  const envelope: ZoneReaderWorklistExport = {
    schemaVersion: ZONE_READER_CONTRACT_VERSION,
    contractVersion: ZONE_READER_CONTRACT_VERSION,
    sourceSystem: ZONE_READER_SOURCE_SYSTEM,
    createdAt: now,
    worklistId,
    generatedAt: now,

    accessionId: accession.id,
    accessionNumber: accession.accessionNumber,
    isolateId: isolate.id,
    isolateNo: isolate.isolateNo,

    patientDisplayId: patient?.mrn ?? null,
    patientName,
    ward: patient?.ward ?? null,

    specimenType: specimen?.freeTextLabel ?? specimen?.subtypeCode ?? null,
    specimenCode: specimen?.subtypeCode ?? specimen?.familyCode ?? null,

    organismName: isolate.organismDisplay ?? null,
    organismCode: isolate.organismCode ?? null,
    organismGroup: deriveOrganismGroup(isolate.organismCode),
    organismDisplay: isolate.organismDisplay,

    astPanelId: panel.id,
    astPanelLabel: panel.label,
    astPanelName: panel.label,
    standard,

    method: "disk_diffusion",
    expectedDiscs,
  };

  return envelope;
}
