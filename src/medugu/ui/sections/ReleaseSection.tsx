// ReleaseSection — finalisation surface.
// Release sealing now runs on the server: the client calls sealRelease(),
// the server re-validates against the persisted accession, computes the
// SHA-256 seal, and writes both the immutable release_packages row and the
// updated accession in one trip. The browser cannot bypass releaseAllowed.

import { useEffect, useState } from "react";
import { useActiveAccession, meduguActions } from "../../store/useAccessionStore";
import { runValidation } from "../../logic/validationEngine";
import { transition, nextSuggested } from "../../logic/workflowEngine";
import { WorkflowStage, ReleaseState } from "../../domain/enums";
import { newId } from "../../domain/ids";
import { sealRelease, amendRelease } from "../../store/release.functions";
import type { AutoDispatchResult } from "../../store/export.functions";
import { supabase } from "@/integrations/supabase/client";
import type { Accession } from "../../domain/types";
import { ReleaseHistoryPanel } from "./ReleaseHistoryPanel";

export function ReleaseSection() {
  const accession = useActiveAccession();
  const [consultantName, setConsultantName] = useState("");
  const [consultantReason, setConsultantReason] = useState("");
  const [sealing, setSealing] = useState(false);
  const [sealError, setSealError] = useState<string | null>(null);
  const [amendmentReason, setAmendmentReason] = useState("");
  const [amending, setAmending] = useState(false);
  const [amendError, setAmendError] = useState<string | null>(null);
  const [accessionRowId, setAccessionRowId] = useState<string | null>(null);
  const [historyKey, setHistoryKey] = useState(0);
  const [autoDispatch, setAutoDispatch] = useState<AutoDispatchResult[] | null>(null);

  // Resolve the postgres row id once per accession so the history panel can
  // query release_packages by FK without re-issuing the lookup on every render.
  const accessionCode = accession?.accessionNumber ?? null;
  useEffect(() => {
    let cancelled = false;
    if (!accessionCode) {
      setAccessionRowId(null);
      return;
    }
    void supabase
      .from("accessions")
      .select("id")
      .eq("accession_code", accessionCode)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return;
        setAccessionRowId((data?.id as string | null) ?? null);
      });
    return () => {
      cancelled = true;
    };
  }, [accessionCode]);

  if (!accession) {
    return (
      <div className="rounded-lg border border-border bg-card p-8 text-center text-sm text-muted-foreground">
        No active accession.
      </div>
    );
  }

  const v = runValidation(accession);
  const suggestedNext = nextSuggested(accession.workflowStatus);
  const released =
    accession.release.state === ReleaseState.Released ||
    accession.release.state === ReleaseState.Amended;
  const amended = accession.release.state === ReleaseState.Amended;

  function advance(to: WorkflowStage) {
    if (!accession) return;
    const r = transition(accession, to);
    if (r.audit) {
      // Persist audit even when blocked, but only change stage on success.
      if (r.ok) {
        meduguActions.setWorkflowStage(accession.id, to, r.audit);
      }
    }
  }

  function recordPhoneOut() {
    if (!accession) return;
    meduguActions.recordPhoneOut(accession.id, {
      id: newId("po"),
      at: new Date().toISOString(),
      calledBy: "local",
      recipient: accession.patient.attendingClinician ?? "On-call clinician",
      reasonCode: "critical_value",
      message: `Significant result on ${accession.accessionNumber}`,
      acknowledged: true,
      acknowledgedAt: new Date().toISOString(),
    });
  }

  function approveConsultant() {
    if (!accession || !consultantName.trim()) return;
    meduguActions.recordConsultantApproval(accession.id, {
      approvedBy: consultantName.trim(),
      reason: consultantReason.trim() || undefined,
    });
    setConsultantName("");
    setConsultantReason("");
  }

  async function release() {
    if (!accession) return;
    setSealError(null);
    setSealing(true);
    try {
      // Find the postgres row id for this accession (cloudSync uses
      // accession_code as the natural key per tenant).
      const { data: row, error: lookupErr } = await supabase
        .from("accessions")
        .select("id")
        .eq("accession_code", accession.accessionNumber)
        .maybeSingle();
      if (lookupErr) throw new Error(lookupErr.message);
      if (!row) throw new Error("Accession not found in cloud — try again in a moment.");

      const result = await sealRelease({ data: { accessionRowId: row.id as string } });
      if (!result.ok || !result.accessionJson) {
        const codes = result.blockerCodes?.length ? ` (${result.blockerCodes.join(", ")})` : "";
        setSealError((result.reason ?? "Release blocked") + codes);
        return;
      }
      // Replace the local copy with the server-issued sealed accession.
      const sealed = JSON.parse(result.accessionJson) as Accession;
      meduguActions.upsertAccession(sealed);
      setHistoryKey((k) => k + 1);
    } catch (err) {
      setSealError(err instanceof Error ? err.message : String(err));
    } finally {
      setSealing(false);
    }
  }

  async function amend() {
    if (!accession) return;
    setAmendError(null);
    if (amendmentReason.trim().length < 4) {
      setAmendError("Amendment reason is required (min 4 characters).");
      return;
    }
    setAmending(true);
    try {
      const { data: row, error: lookupErr } = await supabase
        .from("accessions")
        .select("id")
        .eq("accession_code", accession.accessionNumber)
        .maybeSingle();
      if (lookupErr) throw new Error(lookupErr.message);
      if (!row) throw new Error("Accession not found in cloud.");

      const result = await amendRelease({
        data: {
          accessionRowId: row.id as string,
          amendmentReason: amendmentReason.trim(),
        },
      });
      if (!result.ok || !result.accessionJson) {
        const codes = result.blockerCodes?.length ? ` (${result.blockerCodes.join(", ")})` : "";
        setAmendError((result.reason ?? "Amendment blocked") + codes);
        return;
      }
      const amended = JSON.parse(result.accessionJson) as Accession;
      meduguActions.upsertAccession(amended);
      setAmendmentReason("");
      setHistoryKey((k) => k + 1);
    } catch (err) {
      setAmendError(err instanceof Error ? err.message : String(err));
    } finally {
      setAmending(false);
    }
  }

  return (
    <div className="space-y-5">
      {/* Workflow */}
      <section className="rounded-md border border-border bg-background p-3">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Workflow
        </h4>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
          <span className="rounded bg-muted px-2 py-1 text-foreground">
            current: <span className="font-mono">{accession.workflowStatus}</span>
          </span>
          {suggestedNext && !released && (
            <button
              type="button"
              onClick={() => advance(suggestedNext)}
              className="rounded border border-border px-2 py-1 hover:bg-muted"
            >
              advance → {suggestedNext}
            </button>
          )}
          {!released && (
            <button
              type="button"
              onClick={() => advance(WorkflowStage.Validation)}
              className="rounded border border-border px-2 py-1 hover:bg-muted"
            >
              jump → validation
            </button>
          )}
        </div>
      </section>

      {/* Finalisation board */}
      <section className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <div className="rounded-md border border-border bg-card p-3">
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Blockers</div>
          <div className={`mt-1 text-2xl font-semibold ${v.blockers.length ? "text-destructive" : "text-foreground"}`}>
            {v.blockers.length}
          </div>
          <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
            {v.blockers.slice(0, 6).map((b) => (
              <li key={b.id}>· {b.message}</li>
            ))}
          </ul>
        </div>
        <div className="rounded-md border border-border bg-card p-3">
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Phone-out</div>
          <div className="mt-1 text-sm text-foreground">
            {accession.phoneOuts.length === 0 ? "none recorded" : `${accession.phoneOuts.length} event(s)`}
          </div>
          {v.phoneOutRequiredPending && (
            <>
              <p className="mt-1 text-[11px] text-destructive">
                Required for this pathway — release blocked until acknowledged.
              </p>
              <button
                type="button"
                onClick={recordPhoneOut}
                className="mt-2 rounded bg-destructive/10 px-2 py-1 text-xs text-destructive hover:bg-destructive/20"
              >
                record acknowledged phone-out
              </button>
            </>
          )}
        </div>
        <div className="rounded-md border border-border bg-card p-3">
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Consultant</div>
          {v.consultantReleaseRequired ? (
            accession.release.consultantApproval ? (
              <div className="mt-1 text-xs text-foreground">
                Approved by{" "}
                <span className="font-medium">{accession.release.consultantApproval.approvedBy}</span>
                <div className="text-[10px] text-muted-foreground">
                  {new Date(accession.release.consultantApproval.approvedAt).toLocaleString()}
                </div>
              </div>
            ) : (
              <div className="mt-1 space-y-1.5">
                <p className="text-[11px] text-destructive">
                  Required for {accession.specimen.subtypeCode}.
                </p>
                <input
                  value={consultantName}
                  onChange={(e) => setConsultantName(e.target.value)}
                  placeholder="Consultant name"
                  className="w-full rounded border border-border bg-background px-2 py-1 text-xs"
                />
                <input
                  value={consultantReason}
                  onChange={(e) => setConsultantReason(e.target.value)}
                  placeholder="Reason / note (optional)"
                  className="w-full rounded border border-border bg-background px-2 py-1 text-xs"
                />
                <button
                  type="button"
                  onClick={approveConsultant}
                  disabled={!consultantName.trim()}
                  className="rounded bg-primary px-2 py-1 text-xs text-primary-foreground disabled:opacity-50"
                >
                  Record consultant approval
                </button>
              </div>
            )
          ) : (
            <div className="mt-1 text-xs text-muted-foreground">Not required.</div>
          )}
        </div>
      </section>

      {/* Release action */}
      <section className="rounded-md border border-border bg-background p-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-xs text-muted-foreground">Release state</div>
            <div className="font-mono text-sm text-foreground">
              {accession.release.state} · v{accession.release.reportVersion}
            </div>
            {accession.releasedAt && (
              <div className="mt-0.5 text-[10px] text-muted-foreground">
                released by {accession.releasingActor} @ {new Date(accession.releasedAt).toLocaleString()}
              </div>
            )}
          </div>
          <button
            type="button"
            disabled={!v.releaseAllowed || released || sealing}
            onClick={release}
            className="rounded bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            {amended
              ? `Amended · v${accession.release.reportVersion}`
              : released
                ? "Released"
                : sealing
                  ? "Sealing on server…"
                  : v.releaseAllowed
                    ? "Release report"
                    : "Release blocked"}
          </button>
        </div>
        {sealError && (
          <p className="mt-2 text-[11px] text-destructive">
            Server rejected release: {sealError}
          </p>
        )}
        {!v.releaseAllowed && !released && (
          <ul className="mt-2 space-y-1 text-[11px] text-destructive">
            {v.blockers.map((b) => (
              <li key={b.id}>· {b.message}</li>
            ))}
          </ul>
        )}
      </section>

      {accession.releasePackage && (
        <section>
          <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Frozen release package
          </h4>
          <pre className="overflow-auto rounded-md bg-muted p-3 font-mono text-[11px] text-foreground">
{JSON.stringify(
  {
    builtAt: accession.releasePackage.builtAt,
    version: accession.releasePackage.version,
    ruleVersion: accession.releasePackage.ruleVersion,
    breakpointVersion: accession.releasePackage.breakpointVersion,
    exportVersion: accession.releasePackage.exportVersion,
    buildVersion: accession.releasePackage.buildVersion,
    sealHash: accession.release.sealHash,
  },
  null,
  2,
)}
          </pre>
          <p className="mt-1 text-[10px] text-muted-foreground">
            Snapshot is immutable; the SHA-256 seal is server-issued and stored
            in the append-only release_packages table.
          </p>
        </section>
      )}

      {released && (
        <section className="rounded-md border border-border bg-muted/30 p-3">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Amend released report
          </h4>
          <p className="mt-1 text-[11px] text-muted-foreground">
            Amendments do not overwrite history. A new immutable release
            package will be sealed at v{(accession.release.reportVersion ?? 1) + 1}{" "}
            (HL7 result-status equivalent: corrected). Validation is re-run
            on the server.
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
              onClick={amend}
              disabled={amending || amendmentReason.trim().length < 4}
              className="rounded bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-50"
            >
              {amending ? "Amending on server…" : "Issue amendment"}
            </button>
            {amendError && (
              <span className="text-[11px] text-destructive">{amendError}</span>
            )}
          </div>
        </section>
      )}

      {accessionRowId && (
        <ReleaseHistoryPanel
          key={`${accessionRowId}-${historyKey}`}
          accessionRowId={accessionRowId}
        />
      )}
    </div>
  );
}
