// PolishButton — reusable "Polish wording with AI" surface.
//
// Wraps the same governed pattern used by the amendment panel:
//   1. Operator types a draft into a free-text field.
//   2. They click the button — we send the draft to the audited aiAssist
//      gateway with a server-side system prompt scoped by `task`.
//   3. The suggestion is shown in a preview card. NOTHING is auto-applied;
//      the operator must explicitly click "Use this".
//
// Regulatory note: this component is intentionally a thin language-polish
// surface. It must not be repurposed to render AI-driven clinical
// recommendations. New `task` values must be added to ALLOWED_TASKS in the
// server function and reviewed before being wired up here.

import { useState } from "react";
import { Sparkles, Check, X } from "lucide-react";
import { aiAssist } from "../ai/aiAssist.functions";

type AssistTask = "amendment_reason_polish" | "ams_request_reason_polish";

interface PolishButtonProps {
  task: AssistTask;
  draft: string;
  /** Cloud row id — required for tenant-scoped audit. Button is disabled when missing. */
  accessionRowId?: string | null;
  onAccept: (suggestion: string) => void;
  /** Minimum characters before the button is enabled. Defaults to 4. */
  minChars?: number;
  /** Compact = smaller font / tighter padding for inline use in cards. */
  compact?: boolean;
  className?: string;
}

export function PolishButton({
  task,
  draft,
  accessionRowId,
  onAccept,
  minChars = 4,
  compact = false,
  className = "",
}: PolishButtonProps) {
  const [suggestion, setSuggestion] = useState<string | null>(null);
  const [model, setModel] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const tooShort = draft.trim().length < minChars;
  const canSuggest = !tooShort && !!accessionRowId && !busy;

  async function handleSuggest() {
    setError(null);
    setSuggestion(null);
    setBusy(true);
    try {
      const res = await aiAssist({
        data: {
          task,
          draft: draft.trim(),
          accessionRowId: accessionRowId ?? undefined,
        },
      });
      if (!res.ok) {
        setError(res.reason ?? "AI suggestion failed.");
      } else {
        setSuggestion(res.text);
        setModel(res.model ?? null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "AI request failed.");
    } finally {
      setBusy(false);
    }
  }

  function accept() {
    if (suggestion) onAccept(suggestion);
    setSuggestion(null);
    setModel(null);
  }

  function dismiss() {
    setSuggestion(null);
    setModel(null);
  }

  const btnSize = compact ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-1 text-[11px]";

  return (
    <div className={className}>
      <button
        type="button"
        onClick={handleSuggest}
        disabled={!canSuggest}
        title={
          tooShort
            ? `Type your draft first (min ${minChars} chars)`
            : !accessionRowId
              ? "Available once the case has synced"
              : "Polish the wording with AI (audited)"
        }
        className={`inline-flex items-center gap-1 rounded border border-border bg-background ${btnSize} font-medium hover:bg-accent disabled:opacity-50`}
      >
        <Sparkles className="h-3 w-3" />
        {busy ? "Polishing…" : "Polish with AI"}
      </button>
      {error && <span className="ml-2 text-[10px] text-destructive">{error}</span>}

      {suggestion && (
        <div className="mt-2 rounded border border-primary/40 bg-primary/5 p-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-primary">
              AI-polished draft
            </span>
            <span className="text-[10px] text-muted-foreground">
              {model ?? "ai"} · review before accepting
            </span>
          </div>
          <p className="mt-1 text-xs text-foreground">{suggestion}</p>
          <div className="mt-2 flex gap-1">
            <button
              type="button"
              onClick={accept}
              className="inline-flex items-center gap-1 rounded bg-primary px-2 py-0.5 text-[11px] font-medium text-primary-foreground"
            >
              <Check className="h-3 w-3" /> Use this
            </button>
            <button
              type="button"
              onClick={dismiss}
              className="inline-flex items-center gap-1 rounded border border-border bg-background px-2 py-0.5 text-[11px]"
            >
              <X className="h-3 w-3" /> Dismiss
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
