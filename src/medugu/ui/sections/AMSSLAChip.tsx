export function AMSSLAChip({ dueBy, escalated }: { dueBy?: string; escalated?: boolean }) {
  if (!dueBy) return null;
  const overdue = new Date(dueBy).getTime() < Date.now();
  return (
    <div>
      Due by <span className={overdue ? "text-destructive" : "text-foreground"}>{new Date(dueBy).toLocaleString()}</span>
      {escalated ? (
        <span className="ml-1 rounded bg-destructive/15 px-1 py-0.5 text-[10px] text-destructive">
          escalated
        </span>
      ) : null}
    </div>
  );
}
