import type { ASTResult } from "../../../domain/types";
import type {
  AMSRecommendationExplanation,
  StewardshipDecision,
} from "../../../logic/stewardshipEngine";

function Item({ label, value }: { label: string; value?: string }) {
  return (
    <li className="grid grid-cols-[170px_1fr] gap-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-foreground">{value && value.length > 0 ? value : "not available"}</span>
    </li>
  );
}

export function AMSRuleExplanation({
  explanation,
}: {
  row: ASTResult;
  decision: StewardshipDecision;
  explanation: AMSRecommendationExplanation;
}) {
  return (
    <details className="rounded-md border border-border bg-background p-2 text-xs">
      <summary className="cursor-pointer font-medium text-foreground">
        Why this recommendation?
      </summary>
      <ul className="mt-2 space-y-1.5">
        <Item label="Matched rule" value={explanation.matchedRuleCode} />
        <Item label="Antibiotic under review" value={explanation.antibioticUnderReview} />
        <Item label="AWaRe category" value={explanation.awareCategory} />
        <Item label="Restriction status" value={explanation.restrictionStatus} />
        <Item label="AST interpretation" value={explanation.astInterpretation} />
        <Item label="Organism context" value={explanation.organismContext} />
        <Item label="Specimen/syndrome context" value={explanation.specimenOrSyndromeContext} />
        <Item label="Governance/reportability" value={explanation.reportabilityGovernanceState} />
        <Item label="Missing data" value={explanation.missingData.join(", ")} />
        <Item label="Safety note" value={explanation.safetyNote} />
      </ul>
    </details>
  );
}
