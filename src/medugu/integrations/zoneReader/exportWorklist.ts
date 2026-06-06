// Pure builder for the Zone Reader worklist export.
// No I/O, no engine calls — given an accession + isolate + panel, produce
// the envelope shape the Zone Reader importer expects:
//
//   { schemaVersion: "1.0.0", createdAt: ISO, worklist: { ... } }

import type { Accession } from "../../domain/types";
import { getASTPanel, getAntibiotic } from "../../config/antibiotics";
import {
  ZONE_READER_CONTRACT_VERSION,
  ZONE_READER_SOURCE_SYSTEM,
  type ZoneReaderStandard,
  type ZoneReaderWorklistExport,
  type ZoneReaderWorklistEnvelope,
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

export function buildWorklistExport(input: BuildWorklistInput): ZoneReaderWorklistEnvelope {
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
      // Zone Reader importer rejects null for discPotency — emit an empty
      // string when the LIMS does not hold the potency yet.
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

  const worklist: ZoneReaderWorklistExport = {
    contractVersion: ZONE_READER_CONTRACT_VERSION,
    sourceSystem: ZONE_READER_SOURCE_SYSTEM,
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
    // Zone Reader importer rejects null for organismGroup — emit "" when
    // the LIMS cannot derive a coarse group.
    organismGroup: deriveOrganismGroup(isolate.organismCode),
    organismDisplay: isolate.organismDisplay,

    astPanelId: panel.id,
    astPanelLabel: panel.label,
    astPanelName: panel.label,
    standard,

    method: "disk_diffusion",
    expectedDiscs,
  };

  return {
    schemaVersion: ZONE_READER_CONTRACT_VERSION,
    createdAt: now,
    worklist,
  };
}
