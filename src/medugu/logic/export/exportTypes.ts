import type { Accession } from "../../domain/types";
import type { ReportPreviewDoc } from "../reportPreview";

export type ExportFormat = "fhir" | "hl7" | "json";

export interface ExportGate {
  available: boolean;
  reason?: string;
  /** True when an immutable ReleasePackage exists and is the source. */
  fromReleasePackage: boolean;
  versions: { rule: string; breakpoint: string; export: string; build: string };
}

export interface ExportPayload {
  format: ExportFormat;
  filename: string;
  mime: string;
  content: string;
  gate: ExportGate;
}

export interface NormalisedExport {
  schema: "medugu.normalised/1";
  exportedAt: string;
  versions: ReportPreviewDoc["versions"];
  releaseState: string;
  reportVersion: number;
  /**
   * Correction block (HL7 OBR-25=C / FHIR DiagnosticReport.status=amended).
   * Present and `isCorrection: true` when this export represents an amendment;
   * receivers should treat it as a correction superseding `supersedesVersion`.
   */
  correction: {
    isCorrection: boolean;
    supersedesVersion?: number;
    reason?: string;
  };
  patient: Accession["patient"];
  accession: {
    id: string;
    accessionNumber: string;
    workflowStatus: string;
    priority: string;
    createdAt: string;
    releasedAt?: string;
  };
  specimen: Accession["specimen"] & { display: string; pathway: string; syndrome?: string };
  bloodSets?: ReportPreviewDoc["bloodSets"];
  isolates: ReportPreviewDoc["isolates"];
  /**
   * Normalised blood-culture linkage block. Stable, deterministic shape ready
   * for downstream FHIR (Observation.component / Observation.specimen) and
   * HL7 (NTE under each ORG OBX) extensions. Present only when the specimen
   * family is BLOOD and at least one set has been recorded.
   *
   * Schema:
   *  - bottles[]: one row per (setNo, bottleType) the lab loaded — the
   *    canonical bottle-level inventory with growth state and TTP.
   *  - isolateLinks[]: one row per (isolateNo, setNo, bottleType) — the
   *    explicit isolate→source linkage. Same isolate appears once per
   *    positive bottle it was recovered from. No nesting, no duplication of
   *    bottle metadata, so receivers can join on (setNo, bottleType).
   *
   * Both arrays are sorted by (setNo, bottleType, isolateNo) so the output
   * is byte-stable across runs (canonical-friendly for sealing).
   */
  bloodLinkage?: {
    bottles: {
      setNo: number;
      bottleType: string;
      drawSite?: string;
      lumenLabel?: string;
      drawTime?: string;
      growth: string;
      positiveAt?: string;
      ttpHours?: number;
    }[];
    isolateLinks: {
      isolateNo: number;
      organismCode: string;
      organismDisplay: string;
      setNo: number;
      bottleType: string;
    }[];
  };
  ast: {
    isolateNo: number;
    antibioticCode: string;
    antibioticDisplay: string;
    method: string;
    rawValue?: number;
    rawUnit?: string;
    interpretation?: string;
    governance: string;
    visibleToClinician: boolean;
    suppressionReason?: string;
    releaseClass?: string;
    aware?: string;
    phenotypeFlags?: string[];
  }[];
  stewardship: { source: string; code: string; text: string }[];
  ipc: {
    ruleCode: string;
    message: string;
    actions: string[];
    timing: string;
    visibility: string;
  }[];
  validation: { code: string; severity: string; message: string; section: string }[];
  release: {
    state: string;
    reportVersion: number;
    releasedAt?: string;
    releasedBy?: string;
    amendmentReason?: string;
    consultantApproval?: { approvedBy: string; approvedAt: string; reason?: string };
    fromReleasePackage: boolean;
  };
}
