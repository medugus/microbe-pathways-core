import type { IPCDecision } from "../../../logic/ipcEngine";

interface IPCRuleExplanationProps {
  decision: IPCDecision;
  specimenContext: string;
  ward?: string;
  ruleVersion?: string;
}

function showValue(value?: string | number | null): string {
  if (value === undefined || value === null || value === "") return "not available";
  return String(value);
}

export function IPCRuleExplanation({
  decision,
  specimenContext,
  ward,
  ruleVersion,
}: IPCRuleExplanationProps) {
  const priorEpisodeLogic = decision.isNewEpisode
    ? "new episode (no prior same-rule accession in rolling window)"
    : `repeat episode (${decision.priorAccessionIds?.length ?? 0} prior accession(s) in rolling window)`;

  const localCohortLogic = decision.priorAccessionIds?.length
    ? `local comparable cohort found: ${decision.priorAccessionIds.length}`
    : "no local comparable cohort found";

  return (
    <details className="rounded-md border border-border bg-background/70 p-3">
      <summary className="cursor-pointer text-xs font-medium text-foreground">
        Why this fired
      </summary>
      <dl className="mt-2 grid gap-1 text-xs text-muted-foreground sm:grid-cols-2">
        <div>
          <dt className="font-medium text-foreground">Matched rule</dt>
          <dd>{showValue(decision.ruleCode)}</dd>
        </div>
        <div>
          <dt className="font-medium text-foreground">Organism trigger</dt>
          <dd>{showValue(decision.organismCode)}</dd>
        </div>
        <div>
          <dt className="font-medium text-foreground">Phenotype trigger</dt>
          <dd>{decision.phenotypes.length ? decision.phenotypes.join(", ") : "not available"}</dd>
        </div>
        <div>
          <dt className="font-medium text-foreground">Specimen trigger</dt>
          <dd>{showValue(specimenContext)}</dd>
        </div>
        <div>
          <dt className="font-medium text-foreground">Ward/location trigger</dt>
          <dd>{showValue(ward)}</dd>
        </div>
        <div>
          <dt className="font-medium text-foreground">Prior episode logic</dt>
          <dd>{priorEpisodeLogic}</dd>
        </div>
        <div>
          <dt className="font-medium text-foreground">Local cohort logic</dt>
          <dd>{localCohortLogic}</dd>
        </div>
        <div>
          <dt className="font-medium text-foreground">Rule version</dt>
          <dd>{showValue(ruleVersion)}</dd>
        </div>
      </dl>
    </details>
  );
}
