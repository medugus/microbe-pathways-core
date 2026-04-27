// Export engine facade — pure, framework-agnostic, client-side only.
//
// Public entry point preserved for existing imports. Format-specific builders,
// gate logic, and helpers are split into focused modules under ./export.

import type { Accession } from "../domain/types";
import { buildFhirBundle } from "./export/fhirExport";
import { buildHL7 } from "./export/hl7Export";
import { buildNormalisedJson } from "./export/jsonExport";
import { evaluateExportGate } from "./export/exportGate";
import type { ExportFormat, ExportPayload } from "./export/exportTypes";
import { sourceDoc } from "./export/exportUtils";

export type {
  ExportFormat,
  ExportGate,
  ExportPayload,
  NormalisedExport,
} from "./export/exportTypes";
export { evaluateExportGate, buildFhirBundle, buildHL7, buildNormalisedJson };

export function buildExport(accession: Accession, format: ExportFormat): ExportPayload {
  const gate = evaluateExportGate(accession);
  const v = doc(accession);
  const base = `${accession.accessionNumber}_v${v.reportVersion}`;
  if (format === "fhir") {
    const bundle = buildFhirBundle(accession);
    return {
      format,
      filename: `${base}.fhir.json`,
      mime: "application/fhir+json",
      content: JSON.stringify(bundle, null, 2),
      gate,
    };
  }
  if (format === "hl7") {
    return {
      format,
      filename: `${base}.hl7`,
      mime: "application/hl7-v2",
      content: buildHL7(accession),
      gate,
    };
  }
  return {
    format,
    filename: `${base}.json`,
    mime: "application/json",
    content: JSON.stringify(buildNormalisedJson(accession), null, 2),
    gate,
  };
}

function doc(accession: Accession) {
  return sourceDoc(accession);
}
