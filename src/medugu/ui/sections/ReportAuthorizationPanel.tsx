import { useEffect, useMemo, useState } from "react";
import type { Accession } from "../../domain/types";
import { buildPathologistCommentSuggestion, signOffLabel } from "../../logic/pathologistComments";
import { meduguActions } from "../../store/useAccessionStore";

function formatDateTime(value?: string): string {
  if (!value) return "Not recorded";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

export function ReportAuthorizationPanel({ accession }: { accession: Accession }) {
  const suggestion = useMemo(() => buildPathologistCommentSuggestion(accession), [accession]);
  const storedComment = accession.release.pathologistComment;
  const [scientistName, setScientistName] = useState("");
  const [scientistNote, setScientistNote] = useState("");
  const [pathologistName, setPathologistName] = useState("");
  const [pathologistNote, setPathologistNote] = useState("");
  const [commentText, setCommentText] = useState(storedComment?.text ?? suggestion.text);

  useEffect(() => {
    setCommentText(storedComment?.text ?? suggestion.text);
    setScientistName("");
    setScientistNote("");
    setPathologistName("");
    setPathologistNote("");
  }, [accession.id, storedComment?.text, storedComment?.updatedAt, suggestion.text]);

  const commentChanged = commentText.trim() !== (storedComment?.text ?? suggestion.text).trim();
  const editedFromAuto = commentText.trim() !== suggestion.text.trim();
  const canScientistSign = scientistName.trim().length > 0;
  const canPathologistAuthorize =
    pathologistName.trim().length > 0 &&
    commentText.trim().length > 0 &&
    Boolean(accession.release.medicalLabScientistSignOff);

  function saveComment() {
    if (!commentText.trim()) return;
    meduguActions.savePathologistComment(accession.id, {
      text: commentText.trim(),
      generatedText: suggestion.text,
      scenarioCodes: suggestion.scenarioCodes,
    });
  }

  function useSuggestion() {
    setCommentText(suggestion.text);
  }

  function signScientist() {
    if (!canScientistSign) return;
    meduguActions.recordScientistSignOff(accession.id, {
      signedBy: scientistName.trim(),
      note: scientistNote.trim() || undefined,
    });
  }

  function authorizePathologist() {
    if (!canPathologistAuthorize) return;
    meduguActions.recordPathologistAuthorization(accession.id, {
      signedBy: pathologistName.trim(),
      note: pathologistNote.trim() || undefined,
      commentText: commentText.trim(),
      generatedText: suggestion.text,
      scenarioCodes: suggestion.scenarioCodes,
    });
  }

  return (
    <section className="rounded-md border border-border bg-card p-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Result sign-off and pathologist authorization
          </h4>
          <p className="mt-1 text-xs text-muted-foreground">
            Auto-comment is generated from specimen, organism, AST phenotype, IPC and AMS state.
            Edit it before final authorization.
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5 text-[10px]">
          {suggestion.scenarioCodes.map((code) => (
            <span key={code} className="chip chip-square chip-neutral">
              {code}
            </span>
          ))}
          {editedFromAuto && <span className="chip chip-square chip-warning">edited</span>}
        </div>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="space-y-2">
          <label className="block text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            Pathologist final comment
          </label>
          <textarea
            value={commentText}
            onChange={(event) => setCommentText(event.target.value)}
            rows={7}
            className="w-full rounded border border-border bg-background px-3 py-2 text-sm text-foreground"
          />
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={saveComment}
              disabled={!commentText.trim() || !commentChanged}
              className="rounded bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-50"
            >
              Save comment
            </button>
            <button
              type="button"
              onClick={useSuggestion}
              className="rounded border border-border px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted"
            >
              Use auto suggestion
            </button>
            {storedComment && (
              <span className="text-[11px] text-muted-foreground">
                saved {formatDateTime(storedComment.updatedAt)} by {storedComment.updatedBy}
              </span>
            )}
          </div>
        </div>

        <div className="space-y-3">
          <div className="rounded border border-border bg-background p-3">
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
              Medical laboratory scientist
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {signOffLabel(
                accession.release.medicalLabScientistSignOff,
                "MLS result verification",
              )}
            </p>
            {!accession.release.medicalLabScientistSignOff && (
              <div className="mt-2 space-y-1.5">
                <input
                  value={scientistName}
                  onChange={(event) => setScientistName(event.target.value)}
                  placeholder="Scientist name"
                  className="w-full rounded border border-border bg-background px-2 py-1 text-xs"
                />
                <input
                  value={scientistNote}
                  onChange={(event) => setScientistNote(event.target.value)}
                  placeholder="Optional verification note"
                  className="w-full rounded border border-border bg-background px-2 py-1 text-xs"
                />
                <button
                  type="button"
                  onClick={signScientist}
                  disabled={!canScientistSign}
                  className="rounded bg-primary px-2 py-1 text-xs text-primary-foreground disabled:opacity-50"
                >
                  Sign result section
                </button>
              </div>
            )}
          </div>

          <div className="rounded border border-border bg-background p-3">
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
              Pathologist final authorization
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {signOffLabel(accession.release.pathologistAuthorization, "Pathologist")}
            </p>
            {!accession.release.pathologistAuthorization && (
              <div className="mt-2 space-y-1.5">
                {!accession.release.medicalLabScientistSignOff && (
                  <p className="text-[11px] text-amber-700 dark:text-amber-500">
                    MLS verification is required before pathologist authorization.
                  </p>
                )}
                <input
                  value={pathologistName}
                  onChange={(event) => setPathologistName(event.target.value)}
                  placeholder="Pathologist name"
                  className="w-full rounded border border-border bg-background px-2 py-1 text-xs"
                />
                <input
                  value={pathologistNote}
                  onChange={(event) => setPathologistNote(event.target.value)}
                  placeholder="Optional authorization note"
                  className="w-full rounded border border-border bg-background px-2 py-1 text-xs"
                />
                <button
                  type="button"
                  onClick={authorizePathologist}
                  disabled={!canPathologistAuthorize}
                  className="rounded bg-primary px-2 py-1 text-xs text-primary-foreground disabled:opacity-50"
                >
                  Authorize final report
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
