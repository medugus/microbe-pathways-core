import { useMemo } from "react";
import { IPC_RULES } from "../../../config/ipcRules";
import {
  getActiveIPCRules,
  getIPCRuleCoverageSummary,
  getIPCRuleGovernanceSummary,
  getRuleConfigVersionLabel,
  getRulesByCategory,
} from "../../../logic/ipcRuleGovernance";
import { IPCRuleGovernanceCard } from "./IPCRuleGovernanceCard";

const CATEGORY_LABELS: Record<string, string> = {
  organism_alert: "organism alert",
  phenotype_alert: "phenotype alert",
  colonisation_screen: "colonisation screen",
  clearance: "clearance",
  outbreak_watch: "outbreak watch",
  review: "review",
};

const ORDERED_CATEGORIES = [
  "organism_alert",
  "phenotype_alert",
  "colonisation_screen",
  "clearance",
  "outbreak_watch",
  "review",
];

export function IPCRuleGovernancePanel() {
  const model = useMemo(() => {
    const summary = getIPCRuleGovernanceSummary(IPC_RULES);
    const grouped = getRulesByCategory(IPC_RULES);
    const activeRules = getActiveIPCRules(IPC_RULES);
    const coverage = getIPCRuleCoverageSummary(IPC_RULES);

    return {
      summary,
      grouped,
      activeRules,
      coverage,
      configVersion: getRuleConfigVersionLabel(),
    };
  }, []);

  return (
    <section className="space-y-3 rounded-md border border-border bg-card p-4">
      <div className="space-y-1">
        <h3 className="text-sm font-semibold text-foreground">IPC rule governance</h3>
        <p className="text-xs text-muted-foreground">
          {model.summary.limitationNote} This panel provides browser-phase visibility for local rule
          configuration.
        </p>
        <p className="text-xs text-muted-foreground">Rule/config version: {model.configVersion}</p>
      </div>

      <dl className="grid gap-2 text-xs text-muted-foreground sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded border border-border p-2">Total rules: {model.summary.totalRules}</div>
        <div className="rounded border border-border p-2">Active rules: {model.summary.activeRules}</div>
        <div className="rounded border border-border p-2">Review-only rules: {model.summary.reviewOnlyRules}</div>
        <div className="rounded border border-border p-2">Rules needing review: {model.summary.rulesNeedingReview.length}</div>
        <div className="rounded border border-border p-2">Rules missing action metadata: {model.summary.rulesWithoutActions}</div>
        <div className="rounded border border-border p-2">Rules missing notification targets: {model.summary.rulesWithoutNotificationTargets}</div>
      </dl>

      <p className="text-xs text-muted-foreground">
        Coverage summary: organisms {model.coverage.organismCodesCovered.length}, phenotypes {model.coverage.phenotypeFlagsCovered.length},
        ward scopes {model.coverage.wardScopesCovered.length}, active rule count {model.activeRules.length}.
      </p>

      <div className="space-y-3">
        {ORDERED_CATEGORIES.map((category) => {
          const rules = model.grouped[category] ?? [];
          if (!rules.length) return null;

          return (
            <section key={category} className="space-y-2">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {CATEGORY_LABELS[category]} ({rules.length})
              </h4>
              <div className="space-y-2">
                {rules.map((rule) => (
                  <IPCRuleGovernanceCard key={rule.ruleCode} rule={rule} />
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </section>
  );
}
