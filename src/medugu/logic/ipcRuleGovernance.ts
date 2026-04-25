import type { IPCSignal } from "../domain/types";
import {
  IPC_RULES_CONFIG_VERSION,
  type IPCRule,
  type IPCRuleCategory,
  type IPCRuleGovernanceStatus,
} from "../config/ipcRules";

export interface IPCRuleGovernanceSummary {
  totalRules: number;
  activeRules: number;
  reviewOnlyRules: number;
  draftRules: number;
  disabledRules: number;
  rulesByCategory: Record<string, number>;
  highSeverityRules: number;
  rulesWithoutActions: number;
  rulesWithoutNotificationTargets: number;
  rulesNeedingReview: string[];
  limitationNote: string;
}

export interface IPCRuleCoverageSummary {
  organismCodesCovered: string[];
  phenotypeFlagsCovered: string[];
  wardScopesCovered: string[];
}

const CATEGORY_ORDER: IPCRuleCategory[] = [
  "organism_alert",
  "phenotype_alert",
  "colonisation_screen",
  "clearance",
  "outbreak_watch",
  "review",
];

function governanceStatusFor(rule: IPCRule): IPCRuleGovernanceStatus {
  return rule.governanceStatus ?? "active";
}

export function severityForRule(rule: IPCRule): "high" | "review" | "routine" {
  if (rule.timing === "immediate") return "high";
  if (rule.timing === "same_shift" || rule.timing === "within_24h") return "review";
  return "routine";
}

export function getActiveIPCRules(rules: IPCRule[]): IPCRule[] {
  return rules.filter((rule) => governanceStatusFor(rule) === "active");
}

export function getRulesByCategory(rules: IPCRule[]): Record<string, IPCRule[]> {
  return rules.reduce<Record<string, IPCRule[]>>((acc, rule) => {
    const category = rule.ruleCategory ?? "review";
    if (!acc[category]) acc[category] = [];
    acc[category].push(rule);
    return acc;
  }, {});
}

export function getRulesNeedingReview(rules: IPCRule[]): IPCRule[] {
  return rules.filter((rule) => {
    if (!rule.reviewDate) return true;
    const reviewAt = new Date(rule.reviewDate).getTime();
    if (Number.isNaN(reviewAt)) return true;
    return reviewAt < Date.now();
  });
}

export function getRuleForSignal(signal: IPCSignal, rules: IPCRule[]): IPCRule | undefined {
  return rules.find((rule) => rule.ruleCode === signal.ruleCode);
}

export function describeIPCRule(rule: IPCRule): string {
  const triggerParts = [
    rule.organismCodes?.length ? `organisms: ${rule.organismCodes.join(", ")}` : undefined,
    rule.phenotypeFlags?.length ? `phenotypes: ${rule.phenotypeFlags.join(", ")}` : undefined,
    rule.wardScopes?.length ? `ward scopes: ${rule.wardScopes.join(", ")}` : undefined,
  ].filter(Boolean);

  const actionSummary = rule.actions.length
    ? rule.actions.map((action) => action.replaceAll("_", " ")).join(", ")
    : "action metadata not configured";

  const notificationSummary = rule.notify.length
    ? rule.notify.join(", ")
    : "notification targets not configured";

  return [
    `Rule ${rule.ruleCode}`,
    triggerParts.length ? `triggers ${triggerParts.join("; ")}` : "trigger metadata not configured",
    `severity ${severityForRule(rule)}`,
    `actions ${actionSummary}`,
    `notify ${notificationSummary}`,
    `timing ${rule.timing.replaceAll("_", " ")}`,
  ].join(" · ");
}

export function getIPCRuleCoverageSummary(rules: IPCRule[]): IPCRuleCoverageSummary {
  const organismCodes = new Set<string>();
  const phenotypeFlags = new Set<string>();
  const wardScopes = new Set<string>();

  for (const rule of rules) {
    rule.organismCodes?.forEach((code) => organismCodes.add(code));
    rule.phenotypeFlags?.forEach((flag) => phenotypeFlags.add(flag));
    rule.wardScopes?.forEach((ward) => wardScopes.add(ward));
  }

  return {
    organismCodesCovered: [...organismCodes].sort(),
    phenotypeFlagsCovered: [...phenotypeFlags].sort(),
    wardScopesCovered: [...wardScopes].sort(),
  };
}

export function getIPCRuleGovernanceSummary(rules: IPCRule[]): IPCRuleGovernanceSummary {
  const rulesByCategory = getRulesByCategory(rules);
  const needingReview = getRulesNeedingReview(rules);

  const countsByCategory = CATEGORY_ORDER.reduce<Record<string, number>>((acc, category) => {
    acc[category] = rulesByCategory[category]?.length ?? 0;
    return acc;
  }, {});

  return {
    totalRules: rules.length,
    activeRules: rules.filter((r) => governanceStatusFor(r) === "active").length,
    reviewOnlyRules: rules.filter((r) => governanceStatusFor(r) === "review_only").length,
    draftRules: rules.filter((r) => governanceStatusFor(r) === "draft").length,
    disabledRules: rules.filter((r) => governanceStatusFor(r) === "disabled").length,
    rulesByCategory: countsByCategory,
    highSeverityRules: rules.filter((r) => severityForRule(r) === "high").length,
    rulesWithoutActions: rules.filter((r) => r.actions.length === 0).length,
    rulesWithoutNotificationTargets: rules.filter((r) => r.notify.length === 0).length,
    rulesNeedingReview: needingReview.map((rule) => rule.ruleCode),
    limitationNote:
      "IPC rule governance is browser-phase visibility for local rule configuration; production editing requires backend audit and permissions.",
  };
}

export function getRuleConfigVersionLabel(): string {
  return IPC_RULES_CONFIG_VERSION;
}
