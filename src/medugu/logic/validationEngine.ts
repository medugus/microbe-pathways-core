// Validation engine — pure. Returns blocking issues + warnings + releaseAllowed.
//
// Phase-2 scope: completeness checks across patient, specimen/resolver,
// microscopy, isolates, AST and phone-out placeholders for critical specimens.
// Full clinical/expert-rule validation lands in Phase 3.

import type { Accession, ValidationIssue } from "../domain/types";
import { resolveSpecimen } from "./specimenResolver";
import { newId } from "../domain/ids";

export interface ValidationReport {
  issues: ValidationIssue[];
  blockers: ValidationIssue[];
  warnings: ValidationIssue[];
  info: ValidationIssue[];
  releaseAllowed: boolean;
  /** True when this specimen requires consultant sign-off before release. */
  consultantReleaseRequired: boolean;
  /** True when phone-out is expected but not yet recorded. */
  phoneOutPending: boolean;
}

function block(code: string, section: string, message: string): ValidationIssue {
  return { id: newId("vi"), severity: "block", code, section, message };
}
function warn(code: string, section: string, message: string): ValidationIssue {
  return { id: newId("vi"), severity: "warn", code, section, message };
}
function info(code: string, section: string, message: string): ValidationIssue {
  return { id: newId("vi"), severity: "info", code, section, message };
}

export function runValidation(accession: Accession): ValidationReport {
  const issues: ValidationIssue[] = [];

  // Patient
  if (!accession.patient.mrn) issues.push(block("PT_MRN_MISSING", "patient", "MRN is required."));
  if (!accession.patient.familyName)
    issues.push(block("PT_NAME_MISSING", "patient", "Patient name is required."));

  // Specimen + resolver
  const r = resolveSpecimen(accession.specimen.familyCode, accession.specimen.subtypeCode);
  if (!r.ok) {
    issues.push(block("SP_UNRESOLVED", "specimen", `Specimen could not be resolved (${r.reason}).`));
  }
  const profile = r.ok ? r.profile : null;

  // Microscopy required by resolver
  if (profile && profile.microscopy.required.length > 0 && accession.microscopy.length === 0) {
    issues.push(
      warn(
        "MIC_REQUIRED_MISSING",
        "microscopy",
        `Required microscopy not recorded (${profile.microscopy.required.join(", ")}).`,
      ),
    );
  }

  // Isolates: diagnostic specimens should have at least one isolate row
  // (which may be an explicit "no growth" finding) before release.
  if (profile && profile.gating.pathway === "diagnostic" && accession.isolates.length === 0) {
    issues.push(
      warn("ISO_NONE", "isolate", "No isolate recorded — record an explicit no-growth finding if appropriate."),
    );
  }

  // AST completeness — if any AST rows exist, every row must have a final interpretation
  // and must be approved-or-better governance to release.
  for (const a of accession.ast) {
    if (!a.finalInterpretation) {
      issues.push(
        block(
          "AST_INCOMPLETE",
          "ast",
          `AST row ${a.antibioticCode} has no final S/I/R interpretation.`,
        ),
      );
    } else if (a.governance === "draft") {
      issues.push(
        warn(
          "AST_NOT_APPROVED",
          "ast",
          `AST row ${a.antibioticCode} still in draft governance — approve before release.`,
        ),
      );
    }
  }

  // Phone-out placeholder logic for critical pathways
  let phoneOutPending = false;
  if (profile?.gating.criticalCommunicationRequired) {
    const hasPhoneOut = accession.phoneOuts.some((p) => p.acknowledged);
    const hasSignificantIsolate = accession.isolates.some((i) => i.significance === "significant");
    if (hasSignificantIsolate && !hasPhoneOut) {
      phoneOutPending = true;
      issues.push(
        warn(
          "PHONE_OUT_PENDING",
          "release",
          "Critical specimen with significant isolate — phone-out to clinician not yet acknowledged.",
        ),
      );
    } else if (!hasPhoneOut) {
      issues.push(
        info(
          "PHONE_OUT_HINT",
          "release",
          "Critical-pathway specimen — phone-out workflow available.",
        ),
      );
    }
  }

  const blockers = issues.filter((i) => i.severity === "block");
  const warnings = issues.filter((i) => i.severity === "warn");
  const infos = issues.filter((i) => i.severity === "info");

  return {
    issues,
    blockers,
    warnings,
    info: infos,
    releaseAllowed: blockers.length === 0,
    consultantReleaseRequired: !!profile?.gating.consultantReleaseRequired,
    phoneOutPending,
  };
}
