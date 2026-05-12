// Pure builder for the Zone Reader worklist export.
// No I/O, no engine calls — given an accession + isolate + panel, produce
// the canonical export envelope.

import type { Accession } from "../../domain/types";
import { getASTPanel, getAntibiotic } from "../../config/antibiotics";
import {
  ZONE_READER_CONTRACT_VERSION,
  ZONE_READER_SOURCE_SYSTEM,
  type ZoneReaderWorklistExport,
} from "./types";

export interface BuildWorklistInput {
  accession: Accession;
  isolateId: string;
  astPanelId: string;
  /** Override clock for tests. Defaults to new Date(). */
  now?: Date;
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
      discContent: undefined,
      plateHint: ab?.label,
    };
  });

  return {
    contractVersion: ZONE_READER_CONTRACT_VERSION,
    sourceSystem: ZONE_READER_SOURCE_SYSTEM,
    generatedAt: (input.now ?? new Date()).toISOString(),
    accessionId: accession.id,
    accessionNumber: accession.accessionNumber,
    isolateId: isolate.id,
    isolateNo: isolate.isolateNo,
    organismDisplay: isolate.organismDisplay,
    astPanelId: panel.id,
    astPanelLabel: panel.label,
    method: "disk_diffusion",
    expectedDiscs,
  };
}
