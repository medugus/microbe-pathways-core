import type { AMSReleaseContext } from "../../../logic/amsReleaseGovernance";

export function AMSReleaseContextPanel({ context }: { context: AMSReleaseContext }) {
  if (context.totalItems === 0) return null;

  return (
    <section className="rounded-md border border-border bg-card p-3">
      <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        AMS release context
      </h4>
      <div className="mt-2 flex flex-wrap gap-2 text-xs">
        <span className="rounded bg-muted px-2 py-1 text-muted-foreground">
          {context.totalItems} AMS item(s)
        </span>
        <span className="rounded bg-muted px-2 py-1 text-muted-foreground">
          {context.pendingApprovalCount} pending approval
        </span>
        <span className="rounded bg-muted px-2 py-1 text-muted-foreground">
          {context.restrictedOrReserveCount} restricted/Reserve
        </span>
        <span className="rounded bg-muted px-2 py-1 text-muted-foreground">
          {context.bugDrugMismatchCount} bug-drug/review
        </span>
        <span className="rounded bg-muted px-2 py-1 text-muted-foreground">
          {context.deEscalationOrReviewCount} de-escalation
        </span>
        {context.hasReleaseBlocker ? (
          <span className="rounded bg-destructive/15 px-2 py-1 text-destructive">
            AMS release blocker present
          </span>
        ) : (
          <span className="rounded bg-secondary px-2 py-1 text-secondary-foreground">
            No AMS release blocker
          </span>
        )}
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        Next action: {context.recommendedNextAction}
      </p>
    </section>
  );
}
