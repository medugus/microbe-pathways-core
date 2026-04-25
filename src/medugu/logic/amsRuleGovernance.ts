import { getAntibiotic } from "../config/antibiotics";
import type { AMSRecommendationResult } from "./stewardshipEngine";
import type { AMSRuleCategory, AMSRuleDefinition } from "../config/stewardshipRules";

export interface AMSRuleGovernanceSummary {
  totalRules: number;
  activeRules: number;
  reviewOnlyRules: number;
  draftRules: number;
  disabledRules: number;
  rulesByCategory: Record<string, number>;
  restrictedApprovalRules: number;
  reserveReviewRules: number;
  deEscalationRules: number;
  mismatchRules: number;
  rulesWithoutRationale: number;
  rulesWithoutSource: number;
  rulesNeedingReview: string[];
  limitationNote: string;
}

export interface AMSRuleCoverageSummary {
  antibioticCodes: string[];
  antibioticClasses: string[];
  awareScopes: string[];
  organismScopes: string[];
  phenotypeScopes: string[];
  specimenScopes: string[];
  syndromeScopes: string[];
}

export function getActiveAMSRules(rules: AMSRuleDefinition[]): AMSRuleDefinition[] {
  return rules.filter((rule) => rule.governanceStatus === "active");
}

export function getAMSRulesByCategory(rules: AMSRuleDefinition[]): Record<string, AMSRuleDefinition[]> {
  return rules.reduce<Record<string, AMSRuleDefinition[]>>((acc, rule) => {
    const key = rule.ruleCategory ?? "uncategorized";
    acc[key] = acc[key] ?? [];
    acc[key].push(rule);
    return acc;
  }, {});
}

export function getAMSRulesNeedingReview(rules: AMSRuleDefinition[]): string[] {
  return rules
    .filter((rule) => rule.governanceStatus === "review_only" || rule.governanceStatus === "draft")
    .map((rule) => rule.ruleCode);
}

export function getRuleForAMSRecommendation(
  recommendation: Pick<AMSRecommendationResult, "explanation">,
  rules: AMSRuleDefinition[],
): AMSRuleDefinition | undefined {
  const code = recommendation.explanation.matchedRuleCode;
  return rules.find((rule) => rule.ruleCode === code);
}

export function describeAMSRule(rule: AMSRuleDefinition): string {
  const category = rule.ruleCategory ?? "uncategorized";
  const status = rule.governanceStatus ?? "active";
  const owner = rule.ruleOwner ?? "AMS";
  const rationale = rule.rationale?.trim() || "rationale not configured";
  const source = rule.sourceLabel?.trim() || "source not configured";
  return `${rule.ruleCode} · ${category} · ${status} · owner ${owner} · source/rationale: ${source} / ${rationale}`;
}

export function getAMSRuleCoverageSummary(rules: AMSRuleDefinition[]): AMSRuleCoverageSummary {
  const antibioticCodes = new Set<string>();
  const antibioticClasses = new Set<string>();
  const awareScopes = new Set<string>();
  const organismScopes = new Set<string>();
  const phenotypeScopes = new Set<string>();
  const specimenScopes = new Set<string>();
  const syndromeScopes = new Set<string>();

  for (const rule of rules) {
    for (const code of rule.antibiotics ?? []) {
      antibioticCodes.add(code);
      const antibiotic = getAntibiotic(code);
      if (antibiotic?.class) antibioticClasses.add(antibiotic.class);
    }
    for (const aware of rule.awareScopes ?? []) awareScopes.add(aware);
    for (const organism of rule.organismScopes ?? []) organismScopes.add(organism);
    for (const phenotype of rule.phenotypeScopes ?? []) phenotypeScopes.add(phenotype);
    for (const specimen of rule.specimenScopes ?? []) specimenScopes.add(specimen);
    for (const syndrome of rule.syndromeScopes ?? []) syndromeScopes.add(syndrome);
  }

  return {
    antibioticCodes: Array.from(antibioticCodes),
    antibioticClasses: Array.from(antibioticClasses),
    awareScopes: Array.from(awareScopes),
    organismScopes: Array.from(organismScopes),
    phenotypeScopes: Array.from(phenotypeScopes),
    specimenScopes: Array.from(specimenScopes),
    syndromeScopes: Array.from(syndromeScopes),
  };
}

function countCategory(rules: AMSRuleDefinition[], category: AMSRuleCategory): number {
  return rules.filter((rule) => rule.ruleCategory === category).length;
}

export function getAMSRuleGovernanceSummary(rules: AMSRuleDefinition[]): AMSRuleGovernanceSummary {
  const rulesByCategory = rules.reduce<Record<string, number>>((acc, rule) => {
    const key = rule.ruleCategory ?? "uncategorized";
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});

  return {
    totalRules: rules.length,
    activeRules: rules.filter((rule) => rule.governanceStatus === "active").length,
    reviewOnlyRules: rules.filter((rule) => rule.governanceStatus === "review_only").length,
    draftRules: rules.filter((rule) => rule.governanceStatus === "draft").length,
    disabledRules: rules.filter((rule) => rule.governanceStatus === "disabled").length,
    rulesByCategory,
    restrictedApprovalRules: countCategory(rules, "restricted_approval"),
    reserveReviewRules: countCategory(rules, "reserve_review"),
    deEscalationRules: countCategory(rules, "de_escalation"),
    mismatchRules: countCategory(rules, "bug_drug_mismatch"),
    rulesWithoutRationale: rules.filter((rule) => !rule.rationale?.trim()).length,
    rulesWithoutSource: rules.filter((rule) => !rule.sourceLabel?.trim()).length,
    rulesNeedingReview: getAMSRulesNeedingReview(rules),
    limitationNote:
      "AMS rule governance is browser-phase visibility for local stewardship configuration. Production editing requires backend audit and permissions.",
  };
}
