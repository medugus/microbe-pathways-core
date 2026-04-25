import type { ASTResult } from "../../../domain/types";
import type { StewardshipDecision } from "../../../logic/stewardshipEngine";

function Item({ label, value }: { label: string; value?: string }) {
  return (
    <li className="grid grid-cols-[170px_1fr] gap-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-foreground">{value && value.length > 0 ? value : "not available"}</span>
    </li>
  );
}

export function AMSRuleExplanation({
  row,
  decision,
  specimenContext,
  syndrome,
  organism,
  approvalState,
  releaseImpact,
}: {
  row: ASTResult;
  decision: StewardshipDecision;
  specimenContext?: string;
  syndrome?: string;
  organism?: string;
  approvalState: string;
  releaseImpact: string;
}) {
  const firstRule = row.expertRulesFired?.[0]?.ruleCode ?? row.ruleAppliedCode;
  const phenotype = row.phenotypeFlags?.join(", ") ?? row.cascadeDecision;
  const missing: string[] = [];
  if (!row.finalInterpretation && !row.interpretedSIR) missing.push("AST interpretation");
  if (!row.governance) missing.push("governance state");

  return (
    <details className="rounded-md border border-border bg-background p-2 text-xs">
      <summary className="cursor-pointer font-medium text-foreground">Why this recommendation?</summary>
      <ul className="mt-2 space-y-1.5">
        <Item label="Matched rule" value={firstRule} />
        <Item label="Antibiotic/AWaRe" value={`${row.antibioticCode} · ${decision.aware}`} />
        <Item label="Organism trigger" value={organism} />
        <Item label="Phenotype/AST trigger" value={phenotype} />
        <Item label="Specimen/syndrome trigger" value={[specimenContext, syndrome].filter(Boolean).join(" · ")} />
        <Item label="Governance/reportability" value={`${row.governance} · ${decision.visibleToClinician ? "reportable" : "withheld"}`} />
        <Item label="Approval requirement" value={approvalState} />
        <Item label="Release impact" value={releaseImpact} />
        <Item label="Missing data" value={missing.join(", ")} />
      </ul>
    </details>
  );
}
