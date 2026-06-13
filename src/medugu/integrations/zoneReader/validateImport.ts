// Semantic validation of a parsed Zone Reader import payload against the
// active accession state. Structural validation (and alias normalisation)
// is done by the zod schemas first; by the time validateImport runs, every
// row is in canonical ZoneResult shape.
//
// Findings:
//   info     — observational, never blocks accept
//   warning  — row requires explicit human review before write
//   blocker  — payload (or row) cannot be accepted at all

import type { Accession } from "../../domain/types";
import { ASTMethod } from "../../domain/enums";
import { getASTPanel } from "../../config/antibiotics";
import type {
  ImportFinding,
  ZoneReaderResultImport,
  ZoneReaderWorklistExport,
} from "./types";

export interface ValidateImportInput {
  accession: Accession;
  payload: ZoneReaderResultImport;
  /** Optional source worklist to cross-check against (round-trip). */
  worklist?: ZoneReaderWorklistExport;
  /** Lab policy: require an image reference for every reader-supplied row. */
  requireImageReference?: boolean;
}

const LOW_CONFIDENCE_THRESHOLD = 0.75;
const IMPLAUSIBLE_LOW_MM = 6;
const IMPLAUSIBLE_HIGH_MM = 50;

export function validateImport(input: ValidateImportInput): ImportFinding[] {
  const { accession, payload, worklist, requireImageReference } = input;
  const findings: ImportFinding[] = [];

  // 1. Accession identity (id + number when provided).
  if (payload.accessionId !== accession.id) {
    findings.push({
      severity: "blocker",
      code: "ACCESSION_MISMATCH",
      message: `Payload accessionId ${payload.accessionId} does not match active accession ${accession.id}.`,
    });
  }
  if (
    typeof payload.accessionNumber === "string" &&
    payload.accessionNumber.length > 0 &&
    payload.accessionNumber !== accession.accessionNumber
  ) {
    findings.push({
      severity: "blocker",
      code: "ACCESSION_NUMBER_MISMATCH",
      message: `Payload accessionNumber ${payload.accessionNumber} does not match active accession ${accession.accessionNumber}.`,
    });
  }

  // 2. Isolate exists on accession.
  const isolate = accession.isolates.find((i) => i.id === payload.isolateId);
  if (!isolate) {
    findings.push({
      severity: "blocker",
      code: "ISOLATE_NOT_FOUND",
      message: `Isolate ${payload.isolateId} not present on this accession.`,
    });
  }

  // 3. Panel exists.
  const panel = getASTPanel(payload.astPanelId);
  if (!panel) {
    findings.push({
      severity: "blocker",
      code: "PANEL_NOT_FOUND",
      message: `AST panel ${payload.astPanelId} not found in registry.`,
    });
  }

  // 4. Round-trip cross-check against the originating worklist if supplied.
  if (worklist) {
    if (worklist.accessionId !== payload.accessionId) {
      findings.push({
        severity: "blocker",
        code: "WORKLIST_ACCESSION_MISMATCH",
        message: "Worklist accessionId differs from import accessionId.",
      });
    }
    if (worklist.isolateId !== payload.isolateId) {
      findings.push({
        severity: "blocker",
        code: "WORKLIST_ISOLATE_MISMATCH",
        message: "Worklist isolateId differs from import isolateId.",
      });
    }
    if (worklist.astPanelId !== payload.astPanelId) {
      findings.push({
        severity: "blocker",
        code: "WORKLIST_PANEL_MISMATCH",
        message: "Worklist astPanelId differs from import astPanelId.",
      });
    }
  }

  // 5. Method must be disk diffusion (only method supported by zone readers).
  if (payload.method !== "disk_diffusion") {
    findings.push({
      severity: "blocker",
      code: "UNSUPPORTED_METHOD",
      message: `Method ${payload.method} not supported — Zone Reader is disk diffusion only.`,
    });
  }

  // 5b. ZoneResultEnvelope safety assertions. Zone Reader must stamp every
  //     envelope with notForClinicalRelease=true and releaseAuthority="LIS"
  //     so it can never be mistaken for an authoritative clinical release.
  if (payload.notForClinicalRelease !== true) {
    findings.push({
      severity: "blocker",
      code: "MISSING_NOT_FOR_CLINICAL_RELEASE",
      message:
        "Envelope must assert notForClinicalRelease === true. Medugu (the LIS) is the sole release authority.",
    });
  }
  if (payload.releaseAuthority !== "LIS") {
    findings.push({
      severity: "blocker",
      code: "INVALID_RELEASE_AUTHORITY",
      message:
        'Envelope must assert releaseAuthority === "LIS". Medugu is the sole release authority for clinical results.',
    });
  }

  // 6. Reader / device metadata.
  if (!payload.readerDeviceId && !payload.sourceSystem) {
    findings.push({
      severity: "warning",
      code: "MISSING_DEVICE_METADATA",
      message: "Reader did not declare a device identifier or source system.",
    });
  }

  // 7. Per-row checks.
  const seen = new Set<string>();
  const panelCodes = new Set(panel?.codes ?? []);

  for (const r of payload.results) {
    // 7a. Duplicate row in payload.
    if (seen.has(r.antibioticCode)) {
      findings.push({
        severity: "warning",
        code: "DUPLICATE_ROW",
        antibioticCode: r.antibioticCode,
        message: `Duplicate antibiotic ${r.antibioticCode} in payload — choose one candidate value or reject the duplicate group before import.`,
      });
    }
    seen.add(r.antibioticCode);

    // 7b. Antibiotic not on panel.
    if (panel && !panelCodes.has(r.antibioticCode)) {
      findings.push({
        severity: "warning",
        code: "ANTIBIOTIC_OFF_PANEL",
        antibioticCode: r.antibioticCode,
        message: `Antibiotic ${r.antibioticCode} is not part of panel ${payload.astPanelId}.`,
      });
    }

    // 7c. Implausible zone diameter.
    if (r.zoneDiameterMm < IMPLAUSIBLE_LOW_MM || r.zoneDiameterMm > IMPLAUSIBLE_HIGH_MM) {
      findings.push({
        severity: "warning",
        code: "IMPLAUSIBLE_ZONE",
        antibioticCode: r.antibioticCode,
        message: `Zone ${r.zoneDiameterMm} mm is outside the plausible 6–50 mm range — review required.`,
      });
    }

    // 7d. Low reader confidence (numeric or band).
    if (typeof r.confidenceNumeric === "number" && r.confidenceNumeric < LOW_CONFIDENCE_THRESHOLD) {
      findings.push({
        severity: "warning",
        code: "LOW_CONFIDENCE",
        antibioticCode: r.antibioticCode,
        message: `Reader confidence ${(r.confidenceNumeric * 100).toFixed(0)}% below ${(LOW_CONFIDENCE_THRESHOLD * 100).toFixed(0)}% threshold.`,
      });
    } else if (r.readerConfidence === "low") {
      findings.push({
        severity: "warning",
        code: "LOW_CONFIDENCE",
        antibioticCode: r.antibioticCode,
        message: "Reader reported low confidence band.",
      });
    }

    // 7e. Reader notes / comment present — info.
    if (r.notes) {
      findings.push({
        severity: "info",
        code: "READER_NOTE",
        antibioticCode: r.antibioticCode,
        message: r.notes,
      });
    }

    // 7f. Manual edit without override reason.
    if (r.manualEdited && !r.overrideReason) {
      findings.push({
        severity: "warning",
        code: "MANUAL_EDIT_WITHOUT_REASON",
        antibioticCode: r.antibioticCode,
        message: "Reader value was manually edited but no override reason was supplied.",
      });
    }

    // 7g. Image required by lab policy.
    if (requireImageReference && !r.imageReference && !r.imageUrl) {
      findings.push({
        severity: "warning",
        code: "MISSING_IMAGE_REFERENCE",
        antibioticCode: r.antibioticCode,
        message: "Lab policy requires an image reference for every zone result.",
      });
    }

    // 7h. Existing AST row already has a different rawValue — flag for review.
    if (isolate) {
      const existing = accession.ast.find(
        (a) =>
          a.isolateId === payload.isolateId &&
          a.antibioticCode === r.antibioticCode &&
          a.method === ASTMethod.DiskDiffusion,
      );
      if (
        existing &&
        typeof existing.rawValue === "number" &&
        existing.rawValue !== r.zoneDiameterMm
      ) {
        findings.push({
          severity: "warning",
          code: "OVERWRITE_EXISTING_VALUE",
          antibioticCode: r.antibioticCode,
          message: `Existing zone ${existing.rawValue} mm will be overwritten by reader value ${r.zoneDiameterMm} mm.`,
        });
      }
    }
  }

  // 8. Worklist coverage — antibiotics requested but not returned.
  if (worklist) {
    const returned = new Set(payload.results.map((r) => r.antibioticCode));
    for (const d of worklist.expectedDiscs) {
      if (!returned.has(d.antibioticCode)) {
        findings.push({
          severity: "warning",
          code: "MISSING_EXPECTED_DISC",
          antibioticCode: d.antibioticCode,
          message: `Reader did not return a zone for ${d.antibioticCode} (was on the worklist).`,
        });
      }
    }
  }

  return findings;
}

export function hasBlockers(findings: ImportFinding[]): boolean {
  return findings.some((f) => f.severity === "blocker");
}
