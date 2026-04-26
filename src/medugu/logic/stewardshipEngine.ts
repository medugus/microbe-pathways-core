// Stewardship engine — pure.
// Determines per-AST-row release class, AWaRe category, route bias, and
// whether a row should remain hidden from clinician release until approval
// conditions are satisfied.

import type { ASTResult, Accession, Isolate, StewardshipNote } from "../domain/types";
import { resolveSpecimen } from "./specimenResolver";
import {
  getStewardship,
  getSyndromePref,
  type AWaRe,
  type ReleaseClass,
} from "../config/stewardshipRules";
import { newId } from "../domain/ids";
import { approvalStatusForRow, isRestrictedRow } from "./amsEngine";
import { getOrganism } from "../config/organisms";
import { evaluateASTReportability } from "./reportability";

export interface StewardshipDecision {
  astId: string;
  antibioticCode: string;
  isolateId: string;
  releaseClass: ReleaseClass;
  aware: AWaRe;
  /** Whether this row is hidden from the clinician-facing report. */
  visibleToClinician: boolean;
  /** Reason rendered alongside suppressed rows so users understand why. */
  suppressionReason?: string;
  /** Approval requirement: when true, row is hidden until approval is granted. */
  approvalRequired: boolean;
  /** Computed advisory note (de-escalation, IV→PO, syndrome guidance). */
  advisory?: string;
}

export interface StewardshipReport {
  decisions: StewardshipDecision[];
  notes: StewardshipNote[];
  /** Convenient lookup by AST row id. */
  byAst: Record<string, StewardshipDecision>;
}

export type AMSRecommendationCategory =
  | "bug_drug_mismatch"
  | "resistant_result_review"
  | "de_escalation_opportunity"
  | "restricted_approval_required"
  | "reserve_review"
  | "continue_or_no_action"
  | "insufficient_data";

export interface AMSRecommendationExplanation {
  matchedRuleCode: string;
  antibioticUnderReview: string;
  awareCategory: AWaRe;
  restrictionStatus: string;
  astInterpretation: string;
  organismContext: string;
  specimenOrSyndromeContext: string;
  reportabilityGovernanceState: string;
  missingData: string[];
  safetyNote: string;
}

export interface AMSRecommendationResult {
  category: AMSRecommendationCategory;
  recommendation: string;
  reason: string;
  releaseImpact: string;
  explanation: AMSRecommendationExplanation;
}

const nowIso = () => new Date().toISOString();

export function isResultedASTRow(row: ASTResult): boolean {
  return row.rawValue !== undefined
    || row.zoneMm !== undefined
    || row.micMgL !== undefined
    || !!row.interpretedSIR
    || !!row.rawInterpretation
    || !!row.finalInterpretation
    || !!row.consultantOverride
    || !!row.expertRulesFired?.length
    || (row.governance !== "draft" && row.governance !== undefined);
}

export function isReleaseRelevantASTRow(row: ASTResult): boolean {
  if (isResultedASTRow(row)) return true;
  return row.governance === "interpreted" || row.governance === "approved" || row.governance === "released";
}

export function isAMSReleaseRelevantASTResult(accession: Accession, row: ASTResult): boolean {
  const isolateLinked = accession.isolates.some((iso) => iso.id === row.isolateId);
  if (!isolateLinked) return false;
  if (!isReleaseRelevantASTRow(row)) return false;

  const reportability = evaluateASTReportability(row, accession);
  if (reportability.isSuppressed) return false;

  return reportability.isReportable || reportability.needsApproval || reportability.isRestricted;
}

export function evaluateStewardship(accession: Accession): StewardshipReport {
  const r = resolveSpecimen(accession.specimen.familyCode, accession.specimen.subtypeCode);
  const profile = r.ok ? r.profile : null;
  const syndromePref = getSyndromePref(profile?.syndrome ?? null);

  const decisions: StewardshipDecision[] = [];
  const notes: StewardshipNote[] = [];

  for (const row of accession.ast) {
    const iso = accession.isolates.find((i) => i.id === row.isolateId);
    const sw = getStewardship(row.antibioticCode);
    const aware: AWaRe = sw?.aware ?? "NotClassified";
    let releaseClass: ReleaseClass = sw?.defaultReleaseClass ?? "unrestricted";
    let visibleToClinician = true;
    let suppressionReason: string | undefined;
    let approvalRequired = false;
    let advisory: string | undefined;

    // Syndrome-aware overrides
    if (syndromePref) {
      if (syndromePref.suppress.includes(row.antibioticCode)) {
        releaseClass = "cascade_suppressed";
        visibleToClinician = false;
        suppressionReason = `Suppressed for ${syndromePref.syndrome}: ${syndromePref.note}`;
      }
      if (syndromePref.prefer.includes(row.antibioticCode)) {
        advisory = `Preferred first-line for ${syndromePref.syndrome}.`;
      }
    }

    // Restricted agents require AMS approval before clinician release.
    // Browser-phase Stage 6: consult amsApprovals on the accession.
    if ((releaseClass === "restricted" || isRestrictedRow(row)) && isAMSReleaseRelevantASTResult(accession, row)) {
      const amsStatus = approvalStatusForRow(accession, row.id);
      if (amsStatus === "approved") {
        approvalRequired = false;
        // Released for clinician view because AMS pharmacist approved.
        // visibleToClinician stays true unless suppressed for other reasons.
      } else {
        approvalRequired = true;
        visibleToClinician = false;
        const stateLabel =
          amsStatus === "pending" ? "approval pending"
          : amsStatus === "denied" ? "approval denied"
          : amsStatus === "expired" ? "approval expired"
          : "approval not requested";
        suppressionReason = suppressionReason ?? `Restricted agent (${aware}) — AMS ${stateLabel}.`;
      }
    }

    // Phenotype-driven cascade suppression already encoded on the row
    if (row.cascadeDecision === "suppressed_by_phenotype") {
      visibleToClinician = false;
      suppressionReason = row.stewardshipNote ?? "Suppressed by phenotype rule.";
    }
    if (row.cascadeDecision === "hidden_until_promoted") {
      visibleToClinician = false;
      suppressionReason = suppressionReason ?? "Cascade-tier agent — hidden until first-line resistance is confirmed.";
    }

    // Screen pathway: never release AST clinically
    if (profile?.gating.pathway === "screen") {
      visibleToClinician = false;
      suppressionReason = "Screening specimen — antimicrobial guidance not reported clinically.";
      releaseClass = "screening_only";
    }

    // IV→PO de-escalation hint
    if (sw?.oralAvailable && row.finalInterpretation === "S") {
      advisory = advisory
        ? `${advisory} Oral formulation available — consider IV→PO switch.`
        : "Oral formulation available — consider IV→PO switch.";
    }

    decisions.push({
      astId: row.id,
      antibioticCode: row.antibioticCode,
      isolateId: row.isolateId,
      releaseClass,
      aware,
      visibleToClinician,
      suppressionReason,
      approvalRequired,
      advisory,
    });

    if (advisory || suppressionReason) {
      notes.push({
        id: newId("sw"),
        flag: approvalRequired ? "restricted_agent" : "de_escalation_candidate",
        message:
          (suppressionReason ? `[${row.antibioticCode}] ${suppressionReason}` : "") +
          (advisory ? ` ${advisory}` : ""),
        raisedAt: nowIso(),
      });
    }

    void iso;
  }

  // Bug-drug mismatch (simple heuristic): any row marked R but listed as preferred.
  if (syndromePref) {
    for (const code of syndromePref.prefer) {
      const matching = accession.ast.filter((a) => a.antibioticCode === code && (a.finalInterpretation === "R" || a.interpretedSIR === "R"));
      if (matching.length > 0) {
        notes.push({
          id: newId("sw"),
          flag: "bug_drug_mismatch",
          message: `Preferred first-line ${code} resistant — escalate per ${syndromePref.syndrome} pathway.`,
          raisedAt: nowIso(),
        });
      }
    }
  }

  const byAst: Record<string, StewardshipDecision> = {};
  for (const d of decisions) byAst[d.astId] = d;

  return { decisions, notes, byAst };
}

export function isAstApproved(row: ASTResult): boolean {
  return row.governance === "approved" || row.governance === "released";
}

export function isolateOfRow(accession: Accession, row: ASTResult): Isolate | undefined {
  return accession.isolates.find((i) => i.id === row.isolateId);
}

export function evaluateAMSRecommendation(
  accession: Accession,
  row: ASTResult,
  decision: StewardshipDecision,
  byAst?: Record<string, StewardshipDecision>,
): AMSRecommendationResult {
  const specimen = resolveSpecimen(accession.specimen.familyCode, accession.specimen.subtypeCode);
  const syndrome = specimen.ok ? specimen.profile.syndrome ?? undefined : undefined;
  const specimenLabel = specimen.ok ? specimen.profile.displayName : accession.specimen.subtypeCode;
  const isolate = isolateOfRow(accession, row);
  const organism = isolate ? getOrganism(isolate.organismCode) : undefined;
  const sw = getStewardship(row.antibioticCode);
  const interpretation = row.finalInterpretation ?? row.interpretedSIR;
  const approvalState = approvalStatusForRow(accession, row.id);
  const therapyUnderReview = approvalState !== "not_requested";
  const ruleCode = row.expertRulesFired?.[0]?.ruleCode ?? row.ruleAppliedCode ?? "AMS_REVIEW_RULE";
  const missingData: string[] = [];
  if (!therapyUnderReview) missingData.push("therapy under review");
  if (!interpretation) missingData.push("AST interpretation");
  if (!organism) missingData.push("organism");

  const releaseImpact = decision.visibleToClinician
    ? "No clinician release block."
    : `Clinician report withheld${decision.suppressionReason ? `: ${decision.suppressionReason}` : "."}`;

  const explanation: AMSRecommendationExplanation = {
    matchedRuleCode: ruleCode,
    antibioticUnderReview: row.antibioticCode,
    awareCategory: decision.aware,
    restrictionStatus: decision.approvalRequired ? "approval required" : "not restricted",
    astInterpretation: interpretation ?? "not available",
    organismContext: organism ? `${isolate?.organismDisplay ?? organism.display} (${organism.gram})` : "not available",
    specimenOrSyndromeContext: [specimenLabel, syndrome].filter(Boolean).join(" · ") || "not available",
    reportabilityGovernanceState: `${row.governance} · ${decision.visibleToClinician ? "reportable" : "withheld"} · approval ${approvalState}`,
    missingData,
    safetyNote: "Stewardship decision support only — review required; no automatic prescribing or therapy changes.",
  };

  if (!therapyUnderReview) {
    return {
      category: "insufficient_data",
      recommendation: "Insufficient data for therapy-specific AMS review.",
      reason: "No therapy under review is recorded in AMS context.",
      releaseImpact,
      explanation,
    };
  }

  if (!interpretation || !organism) {
    return {
      category: "insufficient_data",
      recommendation: "Insufficient data for therapy-specific AMS review.",
      reason: `Missing required inputs: ${missingData.join(", ")}.`,
      releaseImpact,
      explanation,
    };
  }

  const isolateRows = accession.ast.filter((a) => a.isolateId === row.isolateId);
  const isNarrowerOption = (candidateCode: string) => sw?.narrowerPreferred?.includes(candidateCode) ?? false;
  const narrowerActiveOptions = isolateRows.filter((candidate) => {
    if (!isNarrowerOption(candidate.antibioticCode)) return false;
    const candidateInterpretation = candidate.finalInterpretation ?? candidate.interpretedSIR;
    if (candidateInterpretation !== "S") return false;
    const candidateSw = getStewardship(candidate.antibioticCode);
    const candidateVisible = byAst?.[candidate.id]?.visibleToClinician ?? true;
    if (!candidateVisible) return false;
    if (candidateSw?.defaultReleaseClass === "cascade_suppressed") return false;
    return true;
  });

  const severeContext = syndrome === "meningitis" || accession.specimen.subtypeCode.toLowerCase().includes("csf");

  if (interpretation === "R") {
    return {
      category: "bug_drug_mismatch",
      recommendation: `Review therapy: organism is reported resistant to ${row.antibioticCode}.`,
      reason: "Therapy under review has resistant AST interpretation.",
      releaseImpact,
      explanation: { ...explanation, matchedRuleCode: "AMS_BUG_DRUG_R" },
    };
  }

  const spectrumMismatch =
    (sw?.spectrum === "gram_positive_only" && organism.gram === "gram_negative")
    || (sw?.spectrum === "gram_negative_only" && organism.gram === "gram_positive");
  if (spectrumMismatch) {
    return {
      category: "bug_drug_mismatch",
      recommendation: "Review therapy: organism/drug spectrum mismatch detected.",
      reason: `Drug spectrum (${sw?.spectrum}) does not align with organism gram context (${organism.gram}).`,
      releaseImpact,
      explanation: { ...explanation, matchedRuleCode: "AMS_BUG_DRUG_SPECTRUM" },
    };
  }

  if (interpretation === "I") {
    return {
      category: "resistant_result_review",
      recommendation: `Review therapy: ${row.antibioticCode} has increased-exposure/intermediate AST interpretation.`,
      reason: "Result requires stewardship review in current therapy context.",
      releaseImpact,
      explanation: { ...explanation, matchedRuleCode: "AMS_RESISTANT_REVIEW" },
    };
  }

  const broadOrRestrictedContext =
    decision.aware === "Watch" || decision.aware === "Reserve" || decision.approvalRequired || decision.releaseClass === "restricted";
  if (!severeContext && broadOrRestrictedContext && narrowerActiveOptions.length > 0) {
    return {
      category: "de_escalation_opportunity",
      recommendation: "De-escalation opportunity: narrower active option available. Review with clinical context.",
      reason: `Active narrower option(s): ${narrowerActiveOptions.map((n) => n.antibioticCode).join(", ")}.`,
      releaseImpact,
      explanation: { ...explanation, matchedRuleCode: "AMS_DE_ESCALATION_ACTIVE_NARROW" },
    };
  }

  if (decision.aware === "Reserve") {
    return {
      category: "reserve_review",
      recommendation: "Reserve antimicrobial requires AMS review; approval required before release where configured.",
      reason: "AWaRe Reserve category is under review.",
      releaseImpact,
      explanation: { ...explanation, matchedRuleCode: "AMS_RESERVE_REVIEW" },
    };
  }

  if (decision.approvalRequired || (isRestrictedRow(row) && approvalState !== "approved")) {
    return {
      category: "restricted_approval_required",
      recommendation: "Restricted antimicrobial requires AMS review and approval before release where configured.",
      reason: `Current approval state: ${approvalState.replace("_", " ")}.`,
      releaseImpact,
      explanation: { ...explanation, matchedRuleCode: "AMS_RESTRICTED_APPROVAL" },
    };
  }

  return {
    category: "continue_or_no_action",
    recommendation: "Continue current review pathway; no additional AMS action signal detected.",
    reason: "Active result with no mismatch or restricted escalation trigger.",
    releaseImpact,
    explanation: { ...explanation, matchedRuleCode: "AMS_CONTINUE_OR_NO_ACTION" },
  };
}
