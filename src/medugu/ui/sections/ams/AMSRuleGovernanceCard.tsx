import { getAntibiotic } from "../../../config/antibiotics";
import type { AMSRuleDefinition } from "../../../config/stewardshipRules";
import { describeAMSRule } from "../../../logic/amsRuleGovernance";

function joinOrFallback(values: string[] | undefined, fallback = "not specified") {
  if (!values || values.length === 0) return fallback;
  return values.join(", ");
}

export function AMSRuleGovernanceCard({
  rule,
  linked,
}: {
  rule: AMSRuleDefinition;
  linked?: boolean;
}) {
  const classScope = (rule.antibiotics ?? [])
    .map((code) => getAntibiotic(code)?.class)
    .filter(Boolean) as string[];
  const classAndAwareScope = [...classScope, ...(rule.awareScopes ?? [])];

  return (
    <article
      id={`ams-rule-${rule.ruleCode}`}
      className={`space-y-2 rounded-md border p-3 text-xs ${linked ? "border-primary bg-primary/5" : "border-border bg-card"}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="font-semibold text-foreground">{rule.ruleCode}</div>
          <div className="text-[11px] text-muted-foreground">{describeAMSRule(rule)}</div>
        </div>
        <div className="text-right text-[11px]">
          <div>
            <span className="font-medium text-foreground">Status:</span>{" "}
            {(rule.governanceStatus ?? "active").replace("_", "-")}
          </div>
          <div>
            <span className="font-medium text-foreground">Owner:</span> {rule.ruleOwner ?? "AMS"}
          </div>
        </div>
      </div>

      <div className="grid gap-1 sm:grid-cols-2">
        <div>
          <span className="font-medium text-foreground">Category:</span>{" "}
          {rule.ruleCategory ?? "uncategorized"}
        </div>
        <div>
          <span className="font-medium text-foreground">Recommendation category:</span>{" "}
          {rule.recommendationCategory ?? "not specified"}
        </div>
        <div>
          <span className="font-medium text-foreground">Approval requirement:</span>{" "}
          {rule.approvalRequired ? "required" : "not required"}
        </div>
        <div>
          <span className="font-medium text-foreground">Release/report impact:</span>{" "}
          {rule.releaseReportImpact ?? "not specified"}
        </div>
        <div>
          <span className="font-medium text-foreground">Antibiotic scope:</span>{" "}
          {joinOrFallback(rule.antibiotics)}
        </div>
        <div>
          <span className="font-medium text-foreground">Class/AWaRe scope:</span>{" "}
          {joinOrFallback(classAndAwareScope)}
        </div>
        <div>
          <span className="font-medium text-foreground">Organism/phenotype scope:</span>{" "}
          {joinOrFallback([...(rule.organismScopes ?? []), ...(rule.phenotypeScopes ?? [])])}
        </div>
        <div>
          <span className="font-medium text-foreground">Specimen/syndrome scope:</span>{" "}
          {joinOrFallback([...(rule.specimenScopes ?? []), ...(rule.syndromeScopes ?? [])])}
        </div>
      </div>

      <div className="rounded border border-border bg-background p-2">
        <div>
          <span className="font-medium text-foreground">Version/source:</span>{" "}
          {rule.version ?? "not configured"} · {rule.sourceLabel ?? "source not configured"}
        </div>
        <div className="mt-1">
          <span className="font-medium text-foreground">Review:</span>{" "}
          {rule.reviewDate ?? "not configured"} · {rule.lastReviewedBy ?? "not configured"}
        </div>
        <div className="mt-1">
          <span className="font-medium text-foreground">Policy ref:</span>{" "}
          {rule.localPolicyRef ?? "not configured"}
        </div>
        <div className="mt-1">
          <span className="font-medium text-foreground">Source/rationale:</span>{" "}
          {rule.rationale ?? "rationale not configured"}
        </div>
        {rule.limitation ? (
          <div className="mt-1">
            <span className="font-medium text-foreground">Limitation:</span> {rule.limitation}
          </div>
        ) : null}
      </div>
    </article>
  );
}
