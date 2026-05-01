// Validation engine — pure. Returns blocking issues + warnings + releaseAllowed.
//
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
import { validateBloodIsolates } from "./bloodIsolateRules";
import { deriveIPCValidationIssues } from "./ipcReportGovernance";
import { getBottleResults, isPositiveBottle } from "./bloodBottles";

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
    if (a.breakpointSpeciesViolation) {
      const allowed = a.breakpointFlags?.restrictedSpecies?.join(", ") ?? "restricted species";
      issues.push(
        block(
          "AST_SPECIES_RESTRICTED",
          "ast",
          `${a.antibioticCode}: EUCAST breakpoint is restricted to ${allowed}. Remove or change drug — interpretation suppressed.`,
        ),
      );
      continue;
    }
    if (a.breakpointFlags?.bracketed && a.rawValue !== undefined) {
      issues.push(
        warn(
          "AST_BRACKETED_BREAKPOINT",
          "ast",
          `${a.antibioticCode}: EUCAST bracketed breakpoint applied (${a.indicationUsed ?? "general"}). Use with caution; not a routine breakpoint.`,
        ),
      );
    }
    if (a.breakpointFlags?.screeningOnly && a.rawValue !== undefined) {
      issues.push(
        warn(
          "AST_SCREENING_ONLY",
          "ast",
          `${a.antibioticCode}: EUCAST screening-only breakpoint (${a.indicationUsed ?? "general"}). Confirmatory MIC recommended.`,
        ),
      );
    }
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

  // ---- Blood culture per-set completeness (BLOCKERS, one per missing field per set).
  if (accession.specimen.familyCode === "BLOOD") {
    const details = (accession.specimen.details ?? {}) as Record<string, unknown>;
    const sets = Array.isArray(details.sets) ? (details.sets as Array<Record<string, unknown>>) : [];
    if (sets.length === 0) {
      issues.push(
        block(
          "BC_SETS_MISSING",
          "specimen",
          "Blood culture: at least one set must be recorded with draw site, bottle type and draw time before release.",
        ),
      );
    } else {
      sets.forEach((s, idx) => {
        const setNo = idx + 1;
        const drawSite = typeof s.drawSite === "string" ? s.drawSite.trim() : "";
        const bottleTypes = Array.isArray(s.bottleTypes)
          ? (s.bottleTypes as unknown[]).filter((b) => typeof b === "string" && b)
          : [];
        const drawTime = typeof s.drawTime === "string" ? s.drawTime.trim() : "";
        if (!drawSite) {
          issues.push(
            block(`BC_SET_${setNo}_DRAWSITE_MISSING`, "specimen", `Blood culture set ${setNo}: draw site is required.`),
          );
        }
        if (bottleTypes.length === 0) {
          issues.push(
            block(`BC_SET_${setNo}_BOTTLES_MISSING`, "specimen", `Blood culture set ${setNo}: at least one bottle type is required.`),
          );
        }
        if (!drawTime) {
          issues.push(
            block(`BC_SET_${setNo}_DRAWTIME_MISSING`, "specimen", `Blood culture set ${setNo}: draw time is required.`),
          );
        }
      });

      // Soft warning: a single adult blood culture set is sub-optimal
      // sensitivity. IDSA / CLSI recommend ≥2 sets from separate venepunctures
      // for adults. Skip for neonatal/paediatric where 1 set is acceptable.
      const subtype = accession.specimen.subtypeCode ?? "";
      const isPaedSubtype = subtype === "BC_NEONATAL" || subtype === "BC_PAEDIATRIC";
      if (sets.length === 1 && !isPaedSubtype) {
        issues.push(
          warn(
            "BC_SINGLE_SET_ADULT",
            "specimen",
            "Only one blood culture set submitted — consider a repeat draw from a second site to improve sensitivity (IDSA recommends ≥2 sets for adults).",
          ),
        );
      }
    }

    // Per-rule blood culture isolate allocation (1–3, source linkage,
    // significance, senior-review on triple pathogen, contaminant carry).
    for (const r of validateBloodIsolates(accession)) {
      const issue = r.severity === "block"
        ? block(r.code, "isolate", r.message)
        : warn(r.code, "isolate", r.message);
      issues.push(issue);
    }

    // Beaker-style gating: every flagged_positive / removed bottle must have a
    // direct-from-bottle Gram stain AND a documented critical call before
    // release. Walks every isolate's bottleResults regardless of source link.
    for (const iso of accession.isolates) {
      for (const b of iso.bottleResults ?? []) {
        const isPositive = b.status === "flagged_positive" || b.status === "removed" || b.growth === "growth";
        if (!isPositive) continue;
        const tag = `set ${b.setNo} ${b.bottleType.toLowerCase()}`;
        if (!b.gramStain || !b.gramStain.result) {
          issues.push(
            block(
              `BC_BOTTLE_GRAM_MISSING_${b.setNo}_${b.bottleType}`,
              "isolate",
              `Positive blood culture bottle (${tag}) requires a direct-from-bottle Gram stain before release.`,
            ),
          );
        }
        if (!b.criticalCall || !b.criticalCall.calledAt || !b.criticalCall.calledTo) {
          issues.push(
            block(
              `BC_BOTTLE_CRITCALL_MISSING_${b.setNo}_${b.bottleType}`,
              "isolate",
              `Positive blood culture bottle (${tag}) requires a documented critical call (clinician contacted, time, read-back) before release.`,
            ),
          );
        } else if (!b.criticalCall.readBack) {
          issues.push(
            warn(
              `BC_BOTTLE_CRITCALL_NO_READBACK_${b.setNo}_${b.bottleType}`,
              "isolate",
              `Critical call for ${tag} recorded without read-back acknowledgement — confirm clinician understood the result.`,
            ),
          );
        }
      }
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

  // ---- Consultant-required release: now a BLOCKER until consultantApproval is recorded.
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


  // ---- IPC governance warnings/blockers (non-clinician-facing by default).
  issues.push(...deriveIPCValidationIssues(accession));

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
