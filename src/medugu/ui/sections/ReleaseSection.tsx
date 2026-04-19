// ReleaseSection — finalisation surface.
// Phone-out is now a blocker for critical-comm pathways; consultant approval
// is now a blocker for consultant-controlled specimens (e.g. CSF). Both must
// be documented before the Release button enables.

import { useState } from "react";
import { useActiveAccession, meduguActions } from "../../store/useAccessionStore";
import { runValidation } from "../../logic/validationEngine";
import { attemptRelease } from "../../logic/releaseEngine";
import { transition, nextSuggested } from "../../logic/workflowEngine";
import { WorkflowStage, ReleaseState } from "../../domain/enums";
import { newId } from "../../domain/ids";

export function ReleaseSection() {
  const accession = useActiveAccession();
  const [consultantName, setConsultantName] = useState("");
  const [consultantReason, setConsultantReason] = useState("");

  if (!accession) {
    return (
      <div className="rounded-lg border border-border bg-card p-8 text-center text-sm text-muted-foreground">
        No active accession.
      </div>
    );
  }

  const v = runValidation(accession);
  const suggestedNext = nextSuggested(accession.workflowStatus);
  const released = accession.release.state === ReleaseState.Released;

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

  function release() {
    if (!accession) return;
    const result = attemptRelease(accession);
    if (!result.ok || !result.package || !result.nextReleaseState) return;
    meduguActions.finaliseRelease(accession.id, result.package, result.nextReleaseState);
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
            disabled={!v.releaseAllowed || released}
            onClick={release}
            className="rounded bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            {released ? "Released" : v.releaseAllowed ? "Release report" : "Release blocked"}
          </button>
        </div>
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
  },
  null,
  2,
)}
          </pre>
          <p className="mt-1 text-[10px] text-muted-foreground">
            Snapshot is immutable; subsequent live edits do not affect this package.
          </p>
        </section>
      )}
    </div>
  );
}
