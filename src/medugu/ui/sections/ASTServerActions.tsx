type ASTServerActionsProps = {
  applying: boolean;
  applyError: string | null;
  appliedSummary: string | null;
  onApplyExpertRules: () => void;
};

export function ASTServerActions({
  applying,
  applyError,
  appliedSummary,
  onApplyExpertRules,
}: ASTServerActionsProps) {
  return (
    <>
      <div className="md:col-span-6 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onApplyExpertRules}
          disabled={applying}
          className="rounded border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted disabled:opacity-50"
        >
          {applying ? "Applying on server…" : "Apply expert rules"}
        </button>
        <span className="text-[11px] text-muted-foreground">
          Server re-runs MRSA / ESBL / CRE / VRE / ICR / intrinsic / AmpC inference and writes
          phenotype + cascade decisions.
        </span>
      </div>
      {applyError && (
        <p className="md:col-span-6 text-[11px] text-destructive">Server rejected: {applyError}</p>
      )}
      {appliedSummary && (
        <p className="md:col-span-6 text-[11px] text-muted-foreground">{appliedSummary}</p>
      )}
    </>
  );
}
