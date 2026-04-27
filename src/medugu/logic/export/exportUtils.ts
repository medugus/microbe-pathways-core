import type { Accession } from "../../domain/types";
import { buildReportPreview, type ReportPreviewDoc } from "../reportPreview";

/** Use the frozen ReleasePackage body when available; otherwise a live preview. */
export function sourceDoc(accession: Accession): ReportPreviewDoc {
  if (accession.releasePackage?.body) {
    return accession.releasePackage.body as ReportPreviewDoc;
  }
  return buildReportPreview(accession);
}

export function sirToFhirInterp(s?: string): string {
  switch (s) {
    case "S":
      return "S";
    case "I":
      return "I";
    case "R":
      return "R";
    case "SDD":
      return "SDD";
    case "NS":
      return "NS";
    default:
      return "IND";
  }
}
