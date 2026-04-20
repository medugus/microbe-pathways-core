// Validation engine — pure. Returns blocking issues + warnings + releaseAllowed.
//
// Phase-2 contract corrections:
// - Required phone-out for critical-comm pathways is a BLOCKER, not a warning.
// - Consultant-required release is a BLOCKER until ReleaseRecord.consultantApproval is set.
// - Specimen resolver invalidity remains a blocker.

import type { Accession, ValidationIssue } from "../domain/types";
import { resolveSpecimen } from "./specimenResolver";
import { newId } from "../domain/ids";
import { pendingRestrictedRowCount } from "./amsEngine";
import { evaluateIPC } from "./ipcEngine";
import { SPECIMEN_FAMILIES } from "../config/specimenFamilies";

/**
 * IPC rule codes that constitute a critical alert. When any of these fires on a
 * sterile-site specimen, an acknowledged phone-out is mandatory before release
 * (DEF-001 contract).
 */
const IPC_CRITICAL_RULE_CODES: ReadonlySet<string> = new Set([
  "MRSA_ALERT",
  "VRE_ALERT",
  "CRE_ALERT",
  "CRAB_ALERT",
  "CRPA_ALERT",
  "CAURIS_ALERT",
]);

/**
 * True when the specimen subtype carries the `sterile_site` tag in the coded
 * family dictionary. Resolver-derived gating already covers CSF/pericardial via
 * `criticalCommunicationRequired`; this check extends the contract to ALL
 * sterile-site subtypes (pleural, ascitic, synovial, SPA, image-guided, etc.)
 * but only when paired with an IPC critical alert (see DEF-001).
 */
function isSterileSiteSubtype(familyCode: string, subtypeCode: string): boolean {
  const fam = SPECIMEN_FAMILIES.find((f) => f.code === familyCode);
  const sub = fam?.subtypes.find((s) => s.code === subtypeCode);
  return !!sub?.tags?.includes("sterile_site");
}

export interface ValidationReport {
  issues: ValidationIssue[];
  blockers: ValidationIssue[];
  warnings: ValidationIssue[];
  info: ValidationIssue[];
  releaseAllowed: boolean;
  /** True when this specimen requires consultant sign-off before release. */
  consultantReleaseRequired: boolean;
  /** True when phone-out is required and not yet documented. */
  phoneOutRequiredPending: boolean;
  /** True when consultant approval is required and not yet recorded. */
  consultantApprovalPending: boolean;
  /** Count of restricted AST rows still awaiting AMS approval (warning, not blocking). */
  amsPendingRestrictedCount: number;
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

  if (!accession.patient.mrn) issues.push(block("PT_MRN_MISSING", "patient", "MRN is required."));
  if (!accession.patient.familyName)
    issues.push(block("PT_NAME_MISSING", "patient", "Patient name is required."));

  const r = resolveSpecimen(accession.specimen.familyCode, accession.specimen.subtypeCode);
  if (!r.ok) {
    issues.push(block("SP_UNRESOLVED", "specimen", `Specimen could not be resolved (${r.reason}).`));
  }
  const profile = r.ok ? r.profile : null;

  if (profile && profile.microscopy.required.length > 0 && accession.microscopy.length === 0) {
    issues.push(
      warn(
        "MIC_REQUIRED_MISSING",
        "microscopy",
        `Required microscopy not recorded (${profile.microscopy.required.join(", ")}).`,
      ),
    );
  }

  if (profile && profile.gating.pathway === "diagnostic" && accession.isolates.length === 0) {
    issues.push(
      warn("ISO_NONE", "isolate", "No isolate recorded — record an explicit no-growth finding if appropriate."),
    );
  }

  for (const a of accession.ast) {
    if (!a.finalInterpretation) {
      issues.push(
        block("AST_INCOMPLETE", "ast", `AST row ${a.antibioticCode} has no final S/I/R interpretation.`),
      );
    } else if (a.governance === "draft") {
      issues.push(
        warn("AST_NOT_APPROVED", "ast", `AST row ${a.antibioticCode} still in draft governance — approve before release.`),
      );
    }
  }

  // ---- Phone-out: now a BLOCKER for critical-pathway specimens with significant findings.
  let phoneOutRequiredPending = false;
  if (profile?.gating.criticalCommunicationRequired) {
    const hasAck = accession.phoneOuts.some((p) => p.acknowledged);
    const hasSignificantIsolate = accession.isolates.some((i) => i.significance === "significant");
    // Blood culture: any growth at all triggers required phone-out (positivity itself is critical).
    const bloodAnyGrowth =
      accession.specimen.familyCode === "BLOOD" &&
      accession.isolates.some((i) => i.organismCode !== "NOGRO");
    const phoneOutRequired = hasSignificantIsolate || bloodAnyGrowth;
    if (phoneOutRequired && !hasAck) {
      phoneOutRequiredPending = true;
      issues.push(
        block(
          "PHONE_OUT_REQUIRED",
          "release",
          "Critical-communication specimen with reportable result — acknowledged phone-out required before release.",
        ),
      );
    } else if (!hasAck) {
      issues.push(
        info("PHONE_OUT_HINT", "release", "Critical-pathway specimen — phone-out workflow available."),
      );
    }
  }

  // ---- DEF-001: sterile-site specimen + ANY IPC critical alert
  // (CRE/MRSA/VRE/CAURIS/CRAB/CRPA) ⇒ acknowledged phone-out required before
  // release, regardless of whether the resolver flagged
  // criticalCommunicationRequired. This catches pleural/ascitic/synovial/SPA/
  // image-guided sterile-site cultures that grow an alert organism — those
  // were silently exportable before this branch existed.
  if (
    !phoneOutRequiredPending &&
    isSterileSiteSubtype(accession.specimen.familyCode, accession.specimen.subtypeCode)
  ) {
    const ipc = evaluateIPC(accession);
    const hasCriticalIPC = ipc.decisions.some((d) => IPC_CRITICAL_RULE_CODES.has(d.ruleCode));
    if (hasCriticalIPC) {
      const hasAck = accession.phoneOuts.some((p) => p.acknowledged);
      if (!hasAck) {
        phoneOutRequiredPending = true;
        issues.push(
          block(
            "PHONE_OUT_REQUIRED",
            "release",
            "Sterile-site specimen with IPC critical alert — acknowledged phone-out required before release.",
          ),
        );
      }
    }
  }
  let consultantApprovalPending = false;
  if (profile?.gating.consultantReleaseRequired) {
    if (!accession.release.consultantApproval) {
      consultantApprovalPending = true;
      issues.push(
        block(
          "CONSULTANT_APPROVAL_REQUIRED",
          "release",
          "Consultant approval required for this specimen type — record sign-off before release.",
        ),
      );
    }
  }

  // ---- Stage 6: AMS restricted-drug approvals (warning surface).
  // Restricted rows are hidden from the clinician report by stewardship until
  // approved, so this is informational/warn — not a release blocker.
  const amsPendingRestrictedCount = pendingRestrictedRowCount(accession);
  if (amsPendingRestrictedCount > 0) {
    issues.push(
      warn(
        "AMS_PENDING_RESTRICTED",
        "release",
        `${amsPendingRestrictedCount} restricted antimicrobial row(s) hidden from clinician report pending AMS approval.`,
      ),
    );
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
    phoneOutRequiredPending,
    consultantApprovalPending,
    amsPendingRestrictedCount,
  };
}
