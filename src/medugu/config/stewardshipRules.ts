// Stewardship rule configuration. Pure data; consumed by stewardshipEngine.
// AWaRe categorisation, release classes, syndrome-aware preferences.

export type AWaRe = "Access" | "Watch" | "Reserve" | "NotClassified";
export type ReleaseClass =
  | "unrestricted"
  | "first_line_preferred"
  | "cascade_suppressed"
  | "restricted"
  | "screening_only";

export interface AntibioticStewardship {
  code: string;
  aware: AWaRe;
  defaultReleaseClass: ReleaseClass;
  /** Preferred route hints used by the engine for IV→PO suggestions. */
  oralAvailable?: boolean;
  /** Coarse stewardship spectrum hint for mismatch checks. */
  spectrum?: "gram_positive_only" | "gram_negative_only" | "broad" | "mixed";
  /** Conservative narrower options to consider when this agent is under review. */
  narrowerPreferred?: string[];
}

export const STEWARDSHIP_RULES_CONFIG_VERSION = "local-ams-rules.v1.0.0";
export const STEWARDSHIP_RULES_SOURCE_LABEL = "Local AMS stewardship baseline ruleset";

export const AB_STEWARDSHIP: AntibioticStewardship[] = [
  {
    code: "AMP",
    aware: "Access",
    defaultReleaseClass: "first_line_preferred",
    oralAvailable: true,
    spectrum: "gram_positive_only",
  },
  {
    code: "AMC",
    aware: "Access",
    defaultReleaseClass: "first_line_preferred",
    oralAvailable: true,
    spectrum: "mixed",
  },
  {
    code: "TZP",
    aware: "Watch",
    defaultReleaseClass: "restricted",
    spectrum: "broad",
    narrowerPreferred: ["AMC", "CXM", "SXT"],
  },
  {
    code: "CXM",
    aware: "Watch",
    defaultReleaseClass: "first_line_preferred",
    oralAvailable: true,
    spectrum: "gram_negative_only",
  },
  {
    code: "CRO",
    aware: "Watch",
    defaultReleaseClass: "restricted",
    spectrum: "broad",
    narrowerPreferred: ["CXM", "AMC", "SXT"],
  },
  {
    code: "CAZ",
    aware: "Watch",
    defaultReleaseClass: "restricted",
    spectrum: "gram_negative_only",
    narrowerPreferred: ["CIP", "SXT"],
  },
  {
    code: "FEP",
    aware: "Watch",
    defaultReleaseClass: "restricted",
    spectrum: "broad",
    narrowerPreferred: ["CRO", "CXM", "SXT"],
  },
  {
    code: "MEM",
    aware: "Watch",
    defaultReleaseClass: "restricted",
    spectrum: "broad",
    narrowerPreferred: ["TZP", "CRO", "CXM", "SXT"],
  },
  {
    code: "ETP",
    aware: "Watch",
    defaultReleaseClass: "restricted",
    spectrum: "broad",
    narrowerPreferred: ["CRO", "CXM", "SXT"],
  },
  {
    code: "GEN",
    aware: "Access",
    defaultReleaseClass: "unrestricted",
    spectrum: "gram_negative_only",
  },
  {
    code: "AMK",
    aware: "Access",
    defaultReleaseClass: "restricted",
    spectrum: "gram_negative_only",
  },
  {
    code: "CIP",
    aware: "Watch",
    defaultReleaseClass: "cascade_suppressed",
    oralAvailable: true,
    spectrum: "mixed",
  },
  {
    code: "LVX",
    aware: "Watch",
    defaultReleaseClass: "cascade_suppressed",
    oralAvailable: true,
    spectrum: "mixed",
  },
  {
    code: "VAN",
    aware: "Watch",
    defaultReleaseClass: "restricted",
    spectrum: "gram_positive_only",
  },
  {
    code: "TEC",
    aware: "Watch",
    defaultReleaseClass: "restricted",
    spectrum: "gram_positive_only",
  },
  {
    code: "LZD",
    aware: "Reserve",
    defaultReleaseClass: "restricted",
    oralAvailable: true,
    spectrum: "gram_positive_only",
  },
  {
    code: "CLI",
    aware: "Access",
    defaultReleaseClass: "unrestricted",
    oralAvailable: true,
    spectrum: "gram_positive_only",
  },
  {
    code: "ERY",
    aware: "Watch",
    defaultReleaseClass: "unrestricted",
    oralAvailable: true,
    spectrum: "gram_positive_only",
  },
  {
    code: "TET",
    aware: "Access",
    defaultReleaseClass: "unrestricted",
    oralAvailable: true,
    spectrum: "mixed",
  },
  {
    code: "SXT",
    aware: "Access",
    defaultReleaseClass: "first_line_preferred",
    oralAvailable: true,
    spectrum: "mixed",
  },
  {
    code: "CST",
    aware: "Reserve",
    defaultReleaseClass: "restricted",
    spectrum: "gram_negative_only",
  },
  {
    code: "NIT",
    aware: "Access",
    defaultReleaseClass: "first_line_preferred",
    oralAvailable: true,
    spectrum: "gram_negative_only",
  },
  {
    code: "FOS",
    aware: "Access",
    defaultReleaseClass: "first_line_preferred",
    oralAvailable: true,
    spectrum: "mixed",
  },
];

export function getStewardship(code: string): AntibioticStewardship | undefined {
  return AB_STEWARDSHIP.find((a) => a.code === code);
}

/** Syndrome-aware preferences: agents that should be promoted/suppressed for a syndrome. */
export interface SyndromePreference {
  syndrome: string;
  prefer: string[]; // agent codes to promote to first-line
  suppress: string[]; // agent codes to suppress unless escalated
  note: string;
}

export const SYNDROME_PREFERENCES: SyndromePreference[] = [
  {
    syndrome: "uti",
    prefer: ["NIT", "FOS", "SXT", "AMC"],
    suppress: ["CRO", "TZP", "MEM", "ETP", "FEP"],
    note: "Uncomplicated UTI: prefer oral first-line; broad-spectrum agents suppressed unless escalated.",
  },
  {
    syndrome: "cauti",
    prefer: ["SXT", "AMC", "CIP"],
    suppress: ["MEM", "ETP"],
    note: "CAUTI: review device necessity; reserve carbapenems for ESBL/CRE.",
  },
  {
    syndrome: "bsi",
    prefer: [],
    suppress: [],
    note: "BSI: broader review — full panel released for clinician decision; consultant input encouraged.",
  },
  {
    syndrome: "meningitis",
    prefer: ["CRO", "VAN", "MEM"],
    suppress: ["NIT", "FOS", "TET"],
    note: "Meningitis: report only CNS-penetrating agents.",
  },
  {
    syndrome: "cap",
    prefer: ["AMC", "CRO", "CXM"],
    suppress: ["MEM"],
    note: "CAP: prefer narrow β-lactams; carbapenems reserved for HAP/VAP context.",
  },
  {
    syndrome: "hap",
    prefer: ["TZP", "FEP", "MEM"],
    suppress: ["AMP"],
    note: "HAP: empirical broader cover acceptable; de-escalate when AST returns.",
  },
  {
    syndrome: "vap",
    prefer: ["TZP", "FEP", "MEM", "AMK"],
    suppress: ["AMP", "CXM"],
    note: "VAP: cover MDR Pseudomonas/Acinetobacter; consider double-cover empirically.",
  },
  {
    syndrome: "colonisation_screen",
    prefer: [],
    suppress: [
      "AMP",
      "AMC",
      "TZP",
      "CXM",
      "CRO",
      "CAZ",
      "FEP",
      "MEM",
      "ETP",
      "GEN",
      "AMK",
      "CIP",
      "LVX",
      "VAN",
      "TEC",
      "LZD",
      "CLI",
      "ERY",
      "TET",
      "SXT",
      "CST",
      "NIT",
      "FOS",
    ],
    note: "Screening specimen: AST not reported clinically — flag IPC only.",
  },
];

export function getSyndromePref(syndrome?: string | null): SyndromePreference | undefined {
  if (!syndrome) return undefined;
  return SYNDROME_PREFERENCES.find((s) => s.syndrome === syndrome);
}

export type AMSRuleGovernanceStatus = "active" | "review_only" | "draft" | "disabled";
export type AMSRuleCategory =
  | "restricted_approval"
  | "reserve_review"
  | "bug_drug_mismatch"
  | "de_escalation"
  | "syndrome_specific"
  | "reportability"
  | "safety_review"
  | "insufficient_data";
export type AMSRuleOwner = "AMS" | "Microbiology" | "IPC" | "Joint";

export type AMSReleaseImpact = "none" | "warning" | "blocker";
export type AMSValidationSeverity = "info" | "warning" | "blocker";
export type AMSReportVisibility = "internal_only" | "clinician_report" | "none";

export interface AMSRuleDefinition {
  ruleCode: string;
  ruleCategory?: AMSRuleCategory;
  governanceStatus?: AMSRuleGovernanceStatus;
  ruleOwner?: AMSRuleOwner;
  version?: string;
  sourceLabel?: string;
  reviewDate?: string;
  lastReviewedBy?: string;
  localPolicyRef?: string;
  rationale?: string;
  limitation?: string;
  antibiotics?: string[];
  awareScopes?: AWaRe[];
  classes?: string[];
  organismScopes?: string[];
  phenotypeScopes?: string[];
  specimenScopes?: string[];
  syndromeScopes?: string[];
  recommendationCategory?: string;
  approvalRequired?: boolean;
  releaseReportImpact?: string;
  releaseImpact?: AMSReleaseImpact;
  validationSeverity?: AMSValidationSeverity;
  reportVisibility?: AMSReportVisibility;
  clinicianReportText?: string;
}

export const AMS_RULE_CONFIG_VERSION = "local-stewardship-2026.04";

export const AMS_RULES: AMSRuleDefinition[] = [
  {
    ruleCode: "AMS_RESTRICTED_APPROVAL",
    ruleCategory: "restricted_approval",
    governanceStatus: "active",
    ruleOwner: "AMS",
    version: "1.0.0",
    sourceLabel: "Local stewardship configuration",
    reviewDate: "2026-03-20",
    lastReviewedBy: "AMS pharmacist",
    localPolicyRef: "AMS-Restricted-Release-v1",
    rationale: "Restricted agents require AMS approval before clinician release where configured.",
    limitation:
      "Browser-phase visibility only; production editing requires backend audit and permissions.",
    awareScopes: ["Watch", "Reserve"],
    recommendationCategory: "restricted_approval_required",
    approvalRequired: true,
    releaseReportImpact: "Clinician release may be withheld pending AMS decision.",
    releaseImpact: "blocker",
    validationSeverity: "blocker",
    reportVisibility: "internal_only",
  },
  {
    ruleCode: "AMS_RESERVE_REVIEW",
    ruleCategory: "reserve_review",
    governanceStatus: "active",
    ruleOwner: "AMS",
    version: "1.0.0",
    sourceLabel: "Local stewardship configuration",
    reviewDate: "2026-03-20",
    lastReviewedBy: "AMS pharmacist",
    localPolicyRef: "AMS-Reserve-Review-v1",
    rationale: "Reserve agents receive additional AMS review signals.",
    awareScopes: ["Reserve"],
    recommendationCategory: "reserve_review",
    approvalRequired: true,
    releaseReportImpact: "Reserve rows are highlighted for review and may require approval.",
    releaseImpact: "blocker",
    validationSeverity: "blocker",
    reportVisibility: "internal_only",
  },
  {
    ruleCode: "AMS_BUG_DRUG_R",
    ruleCategory: "bug_drug_mismatch",
    governanceStatus: "active",
    ruleOwner: "Joint",
    version: "1.0.0",
    sourceLabel: "Local stewardship configuration",
    reviewDate: "2026-03-20",
    lastReviewedBy: "AMS pharmacist",
    rationale: "Therapy under review with resistant result should trigger mismatch review.",
    recommendationCategory: "bug_drug_mismatch",
    releaseReportImpact: "No direct report suppression; stewardship review signal.",
    releaseImpact: "warning",
    validationSeverity: "warning",
    reportVisibility: "internal_only",
  },
  {
    ruleCode: "AMS_BUG_DRUG_SPECTRUM",
    ruleCategory: "bug_drug_mismatch",
    governanceStatus: "review_only",
    ruleOwner: "Joint",
    version: "1.0.0",
    sourceLabel: "Local stewardship configuration",
    reviewDate: "2026-03-20",
    lastReviewedBy: "Microbiology consultant",
    rationale: "Spectrum mismatch between organism gram context and selected therapy.",
    recommendationCategory: "bug_drug_mismatch",
    releaseReportImpact: "No direct report suppression; stewardship review signal.",
    releaseImpact: "warning",
    validationSeverity: "warning",
    reportVisibility: "internal_only",
  },
  {
    ruleCode: "AMS_DE_ESCALATION_ACTIVE_NARROW",
    ruleCategory: "de_escalation",
    governanceStatus: "active",
    ruleOwner: "AMS",
    version: "1.0.0",
    sourceLabel: "Local stewardship configuration",
    reviewDate: "2026-03-20",
    lastReviewedBy: "AMS pharmacist",
    rationale: "Narrower active options are highlighted where clinically appropriate.",
    recommendationCategory: "de_escalation_opportunity",
    releaseReportImpact: "Advisory only; no automatic prescribing changes.",
    releaseImpact: "warning",
    validationSeverity: "info",
    reportVisibility: "internal_only",
  },
  {
    ruleCode: "AMS_RESISTANT_REVIEW",
    ruleCategory: "safety_review",
    governanceStatus: "active",
    ruleOwner: "Joint",
    version: "1.0.0",
    sourceLabel: "Local stewardship configuration",
    reviewDate: "2026-03-20",
    lastReviewedBy: "Microbiology consultant",
    rationale: "Intermediate or increased-exposure interpretations require review.",
    recommendationCategory: "resistant_result_review",
    releaseReportImpact: "No direct report suppression; review signal.",
    releaseImpact: "warning",
    validationSeverity: "warning",
    reportVisibility: "internal_only",
  },
  {
    ruleCode: "AMS_CONTINUE_OR_NO_ACTION",
    ruleCategory: "insufficient_data",
    governanceStatus: "draft",
    ruleOwner: "AMS",
    version: "1.0.0-draft",
    sourceLabel: "Local stewardship configuration",
    reviewDate: "2026-03-20",
    lastReviewedBy: "AMS pharmacist",
    recommendationCategory: "continue_or_no_action",
    releaseReportImpact: "No additional release impact.",
    releaseImpact: "none",
    validationSeverity: "info",
    reportVisibility: "internal_only",
  },
  {
    ruleCode: "AMS_REVIEW_RULE",
    ruleCategory: "reportability",
    governanceStatus: "disabled",
    ruleOwner: "AMS",
    version: "0.9.0",
    sourceLabel: "Legacy fallback",
    reviewDate: "2026-03-20",
    lastReviewedBy: "AMS pharmacist",
    limitation: "Disabled support is metadata only pending engine enforcement.",
    recommendationCategory: "insufficient_data",
    releaseReportImpact: "Fallback metadata only.",
    releaseImpact: "none",
    validationSeverity: "info",
    reportVisibility: "internal_only",
  },
];
