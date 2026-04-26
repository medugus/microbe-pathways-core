import type { Accession } from "../domain/types";
import { AMS_RULES, type AMSRuleDefinition } from "../config/stewardshipRules";
import { evaluateStewardship, evaluateAMSRecommendation, type AMSRecommendationResult } from "./stewardshipEngine";
import { approvalStatusForRow } from "./amsEngine";

export type AMSReleaseImpact = "none" | "warning" | "blocker";
export type AMSValidationSeverity = "info" | "warning" | "blocker";
export type AMSReportVisibility = "internal_only" | "clinician_report" | "none";

export interface AMSGovernanceAssessment {
  astId: string;
  antibioticCode: string;
  category: AMSRecommendationResult["category"];
  recommendation: AMSRecommendationResult;
  releaseImpact: AMSReleaseImpact;
  validationSeverity: AMSValidationSeverity;
  reportVisibility: AMSReportVisibility;
  clinicianReportText?: string;
  isRestrictedOrReserve: boolean;
  requiresApproval: boolean;
  approvalPending: boolean;
}

export interface AMSGovernanceIssue {
  code: string;
  severity: AMSValidationSeverity;
  message: string;
  astId: string;
}

export interface AMSReleaseContext {
  totalItems: number;
  pendingApprovalCount: number;
  restrictedOrReserveCount: number;
  bugDrugMismatchCount: number;
  deEscalationOrReviewCount: number;
  hasReleaseBlocker: boolean;
  recommendedNextAction: string;
}

function findRule(rec: AMSRecommendationResult): AMSRuleDefinition | undefined {
  const ruleCode = rec.explanation.matchedRuleCode;
  return AMS_RULES.find((rule) => rule.ruleCode === ruleCode)
    ?? AMS_RULES.find((rule) => rule.recommendationCategory === rec.category);
}

export function getAMSReleaseImpact(recommendation: AMSRecommendationResult): AMSReleaseImpact {
  const rule = findRule(recommendation);
  if (rule?.releaseImpact) return rule.releaseImpact;

  switch (recommendation.category) {
    case "restricted_approval_required":
    case "reserve_review":
      return recommendation.explanation.restrictionStatus.includes("approval required") ? "blocker" : "warning";
    case "bug_drug_mismatch":
    case "resistant_result_review":
      return "warning";
    case "de_escalation_opportunity":
      return "warning";
    case "insufficient_data":
      return recommendation.explanation.restrictionStatus.includes("approval required") ? "warning" : "none";
    default:
      return "none";
  }
}

function getValidationSeverity(recommendation: AMSRecommendationResult): AMSValidationSeverity {
  const rule = findRule(recommendation);
  if (rule?.validationSeverity) return rule.validationSeverity;

  switch (recommendation.category) {
    case "restricted_approval_required":
      return getAMSReleaseImpact(recommendation) === "blocker" ? "blocker" : "warning";
    case "bug_drug_mismatch":
    case "resistant_result_review":
      return "warning";
    case "de_escalation_opportunity":
      return "info";
    case "insufficient_data":
      return recommendation.explanation.restrictionStatus.includes("approval required") ? "warning" : "info";
    default:
      return "info";
  }
}

function getReportVisibility(recommendation: AMSRecommendationResult): AMSReportVisibility {
  const rule = findRule(recommendation);
  return rule?.reportVisibility ?? "internal_only";
}

function toIssueMessage(assessment: AMSGovernanceAssessment): string {
  const { recommendation, antibioticCode } = assessment;
  switch (recommendation.category) {
    case "restricted_approval_required":
    case "reserve_review":
      return `AMS approval required: ${antibioticCode.toLowerCase()} is restricted/Reserve and approval is not documented.`;
    case "bug_drug_mismatch":
    case "resistant_result_review":
      return `Open AMS review: ${antibioticCode.toLowerCase()} is resistant for the active isolate. Review stewardship recommendation before release.`;
    case "de_escalation_opportunity":
      return `AMS review suggested: ${antibioticCode.toLowerCase()} has a de-escalation or review opportunity. Consider stewardship review before release.`;
    case "insufficient_data":
      return `AMS context incomplete: ${antibioticCode.toLowerCase()} lacks therapy-under-review context. Review if stewardship input is needed.`;
    default:
      return `AMS review available for ${antibioticCode.toLowerCase()}.`;
  }
}

function deriveAssessments(accession: Accession): AMSGovernanceAssessment[] {
  const stewardship = evaluateStewardship(accession);

  return accession.ast.map((row) => {
    const decision = stewardship.byAst[row.id];
    const recommendation = evaluateAMSRecommendation(accession, row, decision, stewardship.byAst);
    const releaseImpact = getAMSReleaseImpact(recommendation);
    const validationSeverity = getValidationSeverity(recommendation);
    const reportVisibility = getReportVisibility(recommendation);
    const approvalState = approvalStatusForRow(accession, row.id);
    const isRestrictedOrReserve =
      decision.releaseClass === "restricted" || decision.aware === "Reserve" || decision.approvalRequired;

    return {
      astId: row.id,
      antibioticCode: row.antibioticCode,
      category: recommendation.category,
      recommendation,
      releaseImpact,
      validationSeverity,
      reportVisibility,
      clinicianReportText: findRule(recommendation)?.clinicianReportText,
      isRestrictedOrReserve,
      requiresApproval: decision.approvalRequired,
      approvalPending: decision.approvalRequired && approvalState !== "approved",
    };
  });
}

export function shouldBlockReleaseForAMS(recommendation: AMSRecommendationResult): boolean {
  return getAMSReleaseImpact(recommendation) === "blocker";
}

export function shouldShowAMSOnClinicianReport(recommendation: AMSRecommendationResult): boolean {
  const reportVisibility = getReportVisibility(recommendation);
  if (reportVisibility !== "clinician_report") return false;
  const text = findRule(recommendation)?.clinicianReportText;
  return typeof text === "string" && text.trim().length > 0;
}

export function deriveAMSValidationIssues(accession: Accession): AMSGovernanceIssue[] {
  const assessments = deriveAssessments(accession);
  return assessments
    .filter((item) => item.category !== "continue_or_no_action")
    .filter((item) => item.validationSeverity !== "info" || item.category === "insufficient_data" || item.category === "de_escalation_opportunity")
    .map((item) => ({
      code: `AMS_${item.category.toUpperCase()}`,
      severity: item.validationSeverity,
      message: toIssueMessage(item),
      astId: item.astId,
    }));
}

export function deriveAMSReleaseContext(accession: Accession): AMSReleaseContext {
  const assessments = deriveAssessments(accession).filter((item) => item.category !== "continue_or_no_action");
  const pendingApprovalCount = assessments.filter((item) => item.approvalPending).length;
  const restrictedOrReserveCount = assessments.filter((item) => item.isRestrictedOrReserve).length;
  const bugDrugMismatchCount = assessments.filter((item) => item.category === "bug_drug_mismatch" || item.category === "resistant_result_review").length;
  const deEscalationOrReviewCount = assessments.filter((item) => item.category === "de_escalation_opportunity").length;
  const hasReleaseBlocker = assessments.some((item) => item.releaseImpact === "blocker");

  const recommendedNextAction = hasReleaseBlocker
    ? "Resolve AMS approval-required items before release."
    : pendingApprovalCount > 0 || bugDrugMismatchCount > 0
      ? "Review open AMS items in stewardship/approval queue before release."
      : assessments.length > 0
        ? "AMS review advisory noted; continue validation checks."
        : "No AMS governance action required.";

  return {
    totalItems: assessments.length,
    pendingApprovalCount,
    restrictedOrReserveCount,
    bugDrugMismatchCount,
    deEscalationOrReviewCount,
    hasReleaseBlocker,
    recommendedNextAction,
  };
}

export function deriveAMSInternalNotes(accession: Accession): string[] {
  return deriveAssessments(accession)
    .filter((item) => item.reportVisibility !== "none")
    .filter((item) => item.category !== "continue_or_no_action")
    .map((item) => `[AMS ${item.validationSeverity}] ${toIssueMessage(item)}`);
}
