// Semantic validation of a parsed Zone Reader import payload against the
// active accession state. Structural validation is done by zod schemas first.
//
// Findings are returned with severity:
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
}

const LOW_CONFIDENCE_THRESHOLD = 0.75;
const IMPLAUSIBLE_LOW_MM = 5;
const IMPLAUSIBLE_HIGH_MM = 50;

export function validateImport(input: ValidateImportInput): ImportFinding[] {
  const { accession, payload, worklist } = input;
  const findings: ImportFinding[] = [];

  // 1. Accession identity.
  if (payload.accessionId !== accession.id) {
    findings.push({
      severity: "blocker",
      code: "ACCESSION_MISMATCH",
      message: `Payload accessionId ${payload.accessionId} does not match active accession ${accession.id}.`,
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

  // 6. Per-row checks.
  const seen = new Set<string>();
  const panelCodes = new Set(panel?.codes ?? []);

  for (const r of payload.results) {
    // 6a. Duplicate row in payload.
    if (seen.has(r.antibioticCode)) {
      findings.push({
        severity: "warning",
        code: "DUPLICATE_ROW",
        antibioticCode: r.antibioticCode,
        message: `Duplicate antibiotic ${r.antibioticCode} in payload — last value wins.`,
      });
    }
    seen.add(r.antibioticCode);

    // 6b. Antibiotic not on panel.
    if (panel && !panelCodes.has(r.antibioticCode)) {
      findings.push({
        severity: "warning",
        code: "ANTIBIOTIC_OFF_PANEL",
        antibioticCode: r.antibioticCode,
        message: `Antibiotic ${r.antibioticCode} is not part of panel ${payload.astPanelId}.`,
      });
    }

    // 6c. Implausible zone diameter.
    if (r.zoneMm < IMPLAUSIBLE_LOW_MM || r.zoneMm > IMPLAUSIBLE_HIGH_MM) {
      findings.push({
        severity: "warning",
        code: "IMPLAUSIBLE_ZONE",
        antibioticCode: r.antibioticCode,
        message: `Zone ${r.zoneMm} mm is outside the plausible 5–50 mm range — review required.`,
      });
    }

    // 6d. Low reader confidence.
    if (typeof r.confidence === "number" && r.confidence < LOW_CONFIDENCE_THRESHOLD) {
      findings.push({
        severity: "warning",
        code: "LOW_CONFIDENCE",
        antibioticCode: r.antibioticCode,
        message: `Reader confidence ${(r.confidence * 100).toFixed(0)}% below ${(LOW_CONFIDENCE_THRESHOLD * 100).toFixed(0)}% threshold.`,
      });
    }

    // 6e. Reader notes — surface as info.
    if (r.notes) {
      findings.push({
        severity: "info",
        code: "READER_NOTE",
        antibioticCode: r.antibioticCode,
        message: r.notes,
      });
    }

    // 6f. Existing AST row already has a different rawValue — flag for review.
    if (isolate) {
      const existing = accession.ast.find(
        (a) =>
          a.isolateId === payload.isolateId &&
          a.antibioticCode === r.antibioticCode &&
          a.method === ASTMethod.DiskDiffusion,
      );
      if (existing && typeof existing.rawValue === "number" && existing.rawValue !== r.zoneMm) {
        findings.push({
          severity: "warning",
          code: "OVERWRITE_EXISTING_VALUE",
          antibioticCode: r.antibioticCode,
          message: `Existing zone ${existing.rawValue} mm will be overwritten by reader value ${r.zoneMm} mm.`,
        });
      }
    }
  }

  // 7. Worklist coverage — antibiotics requested but not returned.
  if (worklist) {
    const returned = new Set(payload.results.map((r) => r.antibioticCode));
    for (const d of worklist.expectedDiscs) {
      if (!returned.has(d.antibioticCode)) {
        findings.push({
          severity: "info",
          code: "WORKLIST_ROW_MISSING_FROM_RESULT",
          antibioticCode: d.antibioticCode,
          message: `Reader did not return a zone for ${d.antibioticCode}.`,
        });
      }
    }
  }

  return findings;
}

export function hasBlockers(findings: ImportFinding[]): boolean {
  return findings.some((f) => f.severity === "blocker");
}
