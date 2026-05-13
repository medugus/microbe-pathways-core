// Pure builder for the Zone Reader worklist export.
// No I/O, no engine calls — given an accession + isolate + panel, produce
// the canonical export envelope enriched with patient/specimen/organism
// context (all nullable when the LIMS does not yet hold the value).

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
      discPotency: null,
      antibioticClass: ab?.class ?? null,
      awareCategory: null,
      reportabilityDefault: null,
      plateHint: ab?.display,
    };
  });

  // Derive standard from the first AST row of this isolate (if any),
  // otherwise fall back to caller override or null.
  const standardFromAst = accession.ast.find((a) => a.isolateId === isolateId)?.standard;
  const standard: ZoneReaderStandard | null =
    input.standard ?? (standardFromAst as ZoneReaderStandard | undefined) ?? null;

  const patient = accession.patient;
  const specimen = accession.specimen;
  const patientName =
    patient && (patient.givenName || patient.familyName)
      ? `${patient.givenName ?? ""} ${patient.familyName ?? ""}`.trim()
      : null;

  return {
    contractVersion: ZONE_READER_CONTRACT_VERSION,
    sourceSystem: ZONE_READER_SOURCE_SYSTEM,
    generatedAt: (input.now ?? new Date()).toISOString(),

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
    organismGroup: null,
    organismDisplay: isolate.organismDisplay,

    astPanelId: panel.id,
    astPanelLabel: panel.label,
    astPanelName: panel.label,
    standard,

    method: "disk_diffusion",
    expectedDiscs,
  };
}
