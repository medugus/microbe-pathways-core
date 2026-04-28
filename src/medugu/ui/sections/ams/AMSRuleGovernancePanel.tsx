import { useMemo, useState } from "react";
import {
  AMS_RULE_CONFIG_VERSION,
  AMS_RULES,
  type AMSRuleCategory,
  type AMSRuleDefinition,
} from "../../../config/stewardshipRules";
import {
  getAMSRuleCoverageSummary,
  getAMSRuleGovernanceSummary,
  getAMSRulesByCategory,
} from "../../../logic/amsRuleGovernance";
import { AMSRuleGovernanceCard } from "./AMSRuleGovernanceCard";

const FILTERS: Array<{ key: AMSRuleCategory; label: string }> = [
  { key: "restricted_approval", label: "restricted approval" },
  { key: "reserve_review", label: "Reserve review" },
  { key: "bug_drug_mismatch", label: "bug-drug mismatch" },
  { key: "de_escalation", label: "de-escalation" },
  { key: "syndrome_specific", label: "syndrome-specific" },
  { key: "reportability", label: "reportability" },
  { key: "safety_review", label: "safety review" },
];

export function AMSRuleGovernancePanel({
  linkedRuleCodes,
}: {
  linkedRuleCodes?: string[];
}) {
  const [filter, setFilter] = useState<AMSRuleCategory | "all">("all");
  const summary = useMemo(() => getAMSRuleGovernanceSummary(AMS_RULES), []);
  const grouped = useMemo(() => getAMSRulesByCategory(AMS_RULES), []);
  const coverage = useMemo(() => getAMSRuleCoverageSummary(AMS_RULES), []);

  const displayRules: AMSRuleDefinition[] = filter === "all" ? AMS_RULES : grouped[filter] ?? [];

  return (
    <section className="space-y-3 rounded-md border border-border bg-card p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-foreground">AMS rule governance</h3>
        <span className="text-[11px] text-muted-foreground">Config version: {AMS_RULE_CONFIG_VERSION}</span>
      </div>

      <div className="rounded-md border border-amber-200 bg-amber-50 p-2 text-[11px] text-amber-900">
        {summary.limitationNote} This is browser-phase visibility for local stewardship configuration.
      </div>

      <div className="grid gap-2 text-xs sm:grid-cols-3 lg:grid-cols-6">
        <div className="rounded border border-border bg-background p-2">Total rules: <span className="font-semibold">{summary.totalRules}</span></div>
        <div className="rounded border border-border bg-background p-2">Active rules: <span className="font-semibold">{summary.activeRules}</span></div>
        <div className="rounded border border-border bg-background p-2">Review-only rules: <span className="font-semibold">{summary.reviewOnlyRules}</span></div>
        <div className="rounded border border-border bg-background p-2">Draft rules: <span className="font-semibold">{summary.draftRules}</span></div>
        <div className="rounded border border-border bg-background p-2">Rules needing review: <span className="font-semibold">{summary.rulesNeedingReview.length}</span></div>
        <div className="rounded border border-border bg-background p-2">Missing source/rationale: <span className="font-semibold">{summary.rulesWithoutSource + summary.rulesWithoutRationale}</span></div>
      </div>

      <div className="text-[11px] text-muted-foreground">
        Coverage summary · antibiotics: {coverage.antibioticCodes.length || 0} · classes: {coverage.antibioticClasses.length || 0} · AWaRe scopes: {coverage.awareScopes.length || 0}
      </div>

      <div className="flex flex-wrap gap-1">
        <button
          type="button"
          onClick={() => setFilter("all")}
          className={`rounded border px-2 py-1 text-[11px] ${filter === "all" ? "border-primary bg-primary/10 text-primary" : "border-border"}`}
        >
          all ({summary.totalRules})
        </button>
        {FILTERS.map((entry) => (
          <button
            key={entry.key}
            type="button"
            onClick={() => setFilter(entry.key)}
            className={`rounded border px-2 py-1 text-[11px] ${filter === entry.key ? "border-primary bg-primary/10 text-primary" : "border-border"}`}
          >
            {entry.label} ({summary.rulesByCategory[entry.key] ?? 0})
          </button>
        ))}
      </div>

      <div className="space-y-2">
        {displayRules.map((rule) => (
          <AMSRuleGovernanceCard
            key={rule.ruleCode}
            rule={rule}
            linked={Boolean(linkedRuleCodes?.includes(rule.ruleCode))}
          />
        ))}
      </div>
    </section>
  );
}
