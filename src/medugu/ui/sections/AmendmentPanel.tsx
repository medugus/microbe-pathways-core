import { useState } from "react";
import { Sparkles, Check, X } from "lucide-react";
import type { Accession } from "../../domain/types";
import { ReleaseState } from "../../domain/enums";
import { aiAssist } from "../../ai/aiAssist.functions";

interface AmendmentPanelProps {
  accession: Accession;
  /** Cloud row id, when the case has been hydrated. Required for AI suggest
   *  so the audit trail can be tenant-scoped. */
  accessionRowId?: string | null;
  amendmentReason: string;
  amending: boolean;
  amendError: string | null;
  setAmendmentReason: (value: string) => void;
  onAmend: () => void;
}

export function AmendmentPanel({
  accession,
  accessionRowId,
  amendmentReason,
  amending,
  amendError,
  setAmendmentReason,
  onAmend,
}: AmendmentPanelProps) {
  const released =
    accession.release.state === ReleaseState.Released ||
    accession.release.state === ReleaseState.Amended;

  // ----- AI suggest state (purely UI; nothing persists until user accepts) -----
  const [suggestion, setSuggestion] = useState<string | null>(null);
  const [suggestModel, setSuggestModel] = useState<string | null>(null);
  const [suggesting, setSuggesting] = useState(false);
  const [suggestError, setSuggestError] = useState<string | null>(null);

  if (!released) return null;

  const draftTooShort = amendmentReason.trim().length < 4;
  const canSuggest = !draftTooShort && !!accessionRowId && !suggesting;

  async function handleSuggest() {
    setSuggestError(null);
    setSuggestion(null);
    setSuggesting(true);
    try {
      const res = await aiAssist({
        data: {
          task: "amendment_reason_polish",
          draft: amendmentReason.trim(),
          accessionRowId: accessionRowId ?? undefined,
        },
      });
      if (!res.ok) {
        setSuggestError(res.reason ?? "AI suggestion failed.");
      } else {
        setSuggestion(res.text);
        setSuggestModel(res.model ?? null);
      }
    } catch (err) {
      setSuggestError(err instanceof Error ? err.message : "AI request failed.");
    } finally {
      setSuggesting(false);
    }
  }

  function acceptSuggestion() {
    if (suggestion) setAmendmentReason(suggestion);
    setSuggestion(null);
    setSuggestModel(null);
  }

  function dismissSuggestion() {
    setSuggestion(null);
    setSuggestModel(null);
  }

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

      {/* AI suggestion preview — never auto-applied; user must accept. */}
      {suggestion && (
        <div className="mt-2 rounded border border-primary/40 bg-primary/5 p-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-primary">
              AI-polished draft
            </span>
            <span className="text-[10px] text-muted-foreground">
              {suggestModel ?? "ai"} · review before accepting
            </span>
          </div>
          <p className="mt-1 text-xs text-foreground">{suggestion}</p>
          <div className="mt-2 flex gap-1">
            <button
              type="button"
              onClick={acceptSuggestion}
              className="inline-flex items-center gap-1 rounded bg-primary px-2 py-0.5 text-[11px] font-medium text-primary-foreground"
            >
              <Check className="h-3 w-3" /> Use this
            </button>
            <button
              type="button"
              onClick={dismissSuggestion}
              className="inline-flex items-center gap-1 rounded border border-border bg-background px-2 py-0.5 text-[11px]"
            >
              <X className="h-3 w-3" /> Dismiss
            </button>
          </div>
        </div>
      )}

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onAmend}
          disabled={amending || draftTooShort}
          className="rounded bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-50"
        >
          {amending ? "Amending on server…" : "Issue amendment"}
        </button>
        <button
          type="button"
          onClick={handleSuggest}
          disabled={!canSuggest}
          title={
            draftTooShort
              ? "Type your draft first (min 4 chars)"
              : !accessionRowId
                ? "Available once the case has synced"
                : "Polish the wording with AI (audited)"
          }
          className="inline-flex items-center gap-1 rounded border border-border bg-background px-2 py-1 text-[11px] font-medium hover:bg-accent disabled:opacity-50"
        >
          <Sparkles className="h-3 w-3" />
          {suggesting ? "Polishing…" : "Polish wording with AI"}
        </button>
        {amendError && <span className="text-[11px] text-destructive">{amendError}</span>}
        {suggestError && <span className="text-[11px] text-destructive">{suggestError}</span>}
      </div>
      <p className="mt-1 text-[10px] text-muted-foreground">
        AI suggestions are language-only — they never recommend organisms, antibiotics, or
        interpretations. Every suggestion is audited; nothing is applied until you click "Use
        this".
      </p>
    </section>
  );
}
