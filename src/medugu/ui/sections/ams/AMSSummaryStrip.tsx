export interface AMSSummaryCounts {
  reviewItems: number;
  restrictedOrReserve: number;
  pendingApproval: number;
  deEscalation: number;
  mismatch: number;
  withheld: number;
}

export function AMSSummaryStrip({ counts }: { counts: AMSSummaryCounts }) {
  const statusText =
    counts.reviewItems === 0 ? "No AMS actions" :
    counts.pendingApproval > 0 && counts.reviewItems === 1 ? "1 restricted antimicrobial requires approval" :
    `${counts.reviewItems} AMS review items · ${counts.pendingApproval} approval pending`;

  const topTone =
    counts.reviewItems === 0 ? "chip chip-square chip-success"
    : counts.pendingApproval > 0 ? "chip chip-square chip-danger"
    : counts.restrictedOrReserve > 0 ? "chip chip-square chip-warning"
    : "chip chip-square chip-neutral";

  return (
    <section className="space-y-2 rounded-md border border-border bg-card p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className={topTone}>{statusText}</span>
        <span className="chip chip-square chip-restricted">Restricted/Reserve · {counts.restrictedOrReserve}</span>
        <span className="chip chip-square chip-ams-pending">Approval pending · {counts.pendingApproval}</span>
        <span className="chip chip-square chip-success">De-escalation opportunities · {counts.deEscalation}</span>
        <span className="chip chip-square chip-warning">Drug-result mismatch · {counts.mismatch}</span>
        <span className="chip chip-square chip-withheld">Release impact · {counts.withheld} withheld</span>
      </div>
    </section>
  );
}
