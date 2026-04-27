import type { Accession } from "../../domain/types";
import { ReleaseState } from "../../domain/enums";

interface AmendmentPanelProps {
  accession: Accession;
  amendmentReason: string;
  amending: boolean;
  amendError: string | null;
  setAmendmentReason: (value: string) => void;
  onAmend: () => void;
}

export function AmendmentPanel({
  accession,
  amendmentReason,
  amending,
  amendError,
  setAmendmentReason,
  onAmend,
}: AmendmentPanelProps) {
  const released =
    accession.release.state === ReleaseState.Released ||
    accession.release.state === ReleaseState.Amended;

  if (!released) return null;

  return (
    <section className="rounded-md border border-border bg-muted/30 p-3">
      <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Amend released report
      </h4>
      <p className="mt-1 text-[11px] text-muted-foreground">
        Amendments do not overwrite history. A new immutable release package will be sealed at v
        {(accession.release.reportVersion ?? 1) + 1} (HL7 result-status equivalent: corrected).
        Validation is re-run on the server.
      </p>
      {accession.release.amendmentReason && (
        <p className="mt-2 text-[11px] text-foreground">
          <span className="text-muted-foreground">Last reason:</span>{" "}
          <span className="italic">{accession.release.amendmentReason}</span>
        </p>
      )}
      <textarea
        value={amendmentReason}
        onChange={(e) => setAmendmentReason(e.target.value)}
        placeholder="Reason for amendment (required, min 4 chars)"
        rows={2}
        className="mt-2 w-full rounded border border-border bg-background px-2 py-1 text-xs"
      />
      <div className="mt-2 flex items-center gap-2">
        <button
          type="button"
          onClick={onAmend}
          disabled={amending || amendmentReason.trim().length < 4}
          className="rounded bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-50"
        >
          {amending ? "Amending on server…" : "Issue amendment"}
        </button>
        {amendError && <span className="text-[11px] text-destructive">{amendError}</span>}
      </div>
    </section>
  );
}
