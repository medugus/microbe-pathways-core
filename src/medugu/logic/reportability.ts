import type { Accession, ASTResult } from "../domain/types";
import { isRestrictedRow } from "./amsEngine";

export type ClinicianVisibility = "Suppressed" | "Needs approval" | "Lab-only" | "Will report" | "Unknown";

function normalize(value: string | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

function hasPhenotypeFlags(row: ASTResult): boolean {
  return Array.isArray(row.phenotypeFlags) && row.phenotypeFlags.length > 0;
}

export interface ASTReportabilityEvaluation {
  clinicianVisibility: ClinicianVisibility;
  explanation: string;
  isSuppressed: boolean;
  isLabOnly: boolean;
  needsApproval: boolean;
  isReportable: boolean;
  isRestricted: boolean;
  hasPhenotypeFlags: boolean;
  missingGovernance: boolean;
}

export function evaluateASTReportability(row: ASTResult, accession: Accession): ASTReportabilityEvaluation {
  void accession;
  const governance = normalize(row.governance);
  const cascadeDecision = normalize(row.cascadeDecision);

  const isSuppressed =
    cascadeDecision.includes("suppress") ||
    cascadeDecision.includes("withheld") ||
    cascadeDecision.includes("hidden");

  const needsApproval = governance.includes("approval required") || governance === "approval_required";
  const isLabOnly = governance === "lab-only" || governance === "lab_only";
  const rawGovernanceReportable = new Set(["reportable", "report", "interpreted", "approved", "released"]).has(governance);
  const isRestricted = isRestrictedRow(row);
  const phenotypePresent = hasPhenotypeFlags(row);
  const missingGovernance = governance === "";

  let clinicianVisibility: ClinicianVisibility;
  let explanation: string;

  if (isSuppressed) {
    clinicianVisibility = "Suppressed";
    explanation = "Suppressed by cascade";
  } else if (needsApproval) {
    clinicianVisibility = "Needs approval";
    explanation = "Approval required before release";
  } else if (isLabOnly) {
    clinicianVisibility = "Lab-only";
    explanation = "Lab-only result";
  } else if (rawGovernanceReportable) {
    clinicianVisibility = "Will report";
    explanation = "Reportable";
  } else {
    clinicianVisibility = "Unknown";
    explanation = "No rule reason available";
  }

  const explanationExtras: string[] = [];
  if (isRestricted) explanationExtras.push("Restricted antimicrobial");
  if (phenotypePresent) explanationExtras.push("Phenotype flag present");

  if (explanationExtras.length > 0) {
    explanation = `${explanation}; ${explanationExtras.join("; ")}`;
  }

  const isReportable = clinicianVisibility === "Will report";

  return {
    clinicianVisibility,
    explanation,
    isSuppressed,
    isLabOnly,
    needsApproval,
    isReportable,
    isRestricted,
    hasPhenotypeFlags: phenotypePresent,
    missingGovernance,
  };
}
