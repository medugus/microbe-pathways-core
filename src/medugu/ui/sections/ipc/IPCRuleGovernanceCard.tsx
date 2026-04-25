import type { IPCRule } from "../../../config/ipcRules";
import { describeIPCRule, severityForRule } from "../../../logic/ipcRuleGovernance";

interface IPCRuleGovernanceCardProps {
  rule: IPCRule;
}

export function IPCRuleGovernanceCard({ rule }: IPCRuleGovernanceCardProps) {
  const severity = severityForRule(rule);

  const triggerSummary = [
    rule.organismCodes?.length ? `organisms: ${rule.organismCodes.join(", ")}` : undefined,
    rule.phenotypeFlags?.length ? `phenotypes: ${rule.phenotypeFlags.join(", ")}` : undefined,
    rule.wardScopes?.length ? `wards: ${rule.wardScopes.join(", ")}` : undefined,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <article
      id={`ipc-rule-${rule.ruleCode}`}
      className="space-y-2 rounded-md border border-border bg-card p-3"
    >
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <code className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
          {rule.ruleCode}
        </code>
        <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
          category: {rule.ruleCategory ?? "review"}
        </span>
        <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
          governance: {rule.governanceStatus ?? "active"}
        </span>
        <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
          severity: {severity}
        </span>
      </div>

      <p className="text-xs text-muted-foreground">
        Trigger summary: {triggerSummary || "trigger metadata not configured"}
      </p>
      <p className="text-xs text-muted-foreground">
        Action summary:{" "}
        {rule.actions.length
          ? rule.actions.map((a) => a.replaceAll("_", " ")).join(", ")
          : "action metadata not configured"}
      </p>
      <p className="text-xs text-muted-foreground">
        Notification targets:{" "}
        {rule.notify.length ? rule.notify.join(", ") : "notification targets not configured"}
      </p>
      <p className="text-xs text-muted-foreground">
        Escalation timing: {rule.timing.replaceAll("_", " ")}
      </p>
      <p className="text-xs text-muted-foreground">
        Source/rationale:{" "}
        {[rule.sourceLabel, rule.rationale].filter(Boolean).join(" · ") || "not available"}
      </p>
      <p className="text-xs text-muted-foreground">
        Owner/version:{" "}
        {[rule.ruleOwner, rule.version].filter(Boolean).join(" · ") || "not available"}
      </p>
      <p className="text-xs text-muted-foreground">
        Review metadata:{" "}
        {[rule.reviewDate ? `review date ${rule.reviewDate}` : undefined, rule.lastReviewedBy]
          .filter(Boolean)
          .join(" · ") || "not available"}
      </p>
      <p className="text-xs text-muted-foreground">
        Local policy reference: {rule.localPolicyRef || "not available"}
      </p>
      {rule.limitation && (
        <p className="text-xs text-muted-foreground">Limitation: {rule.limitation}</p>
      )}
      {(rule.governanceStatus ?? "active") === "disabled" && (
        <p className="text-xs text-muted-foreground">
          Disabled support is metadata only pending engine enforcement.
        </p>
      )}
      <p className="text-[11px] text-muted-foreground">{describeIPCRule(rule)}</p>
    </article>
  );
}
