// AMS queue dashboard — tenant-wide pending restricted-drug approvals.
//
// Workflow is real (not a visibility flag):
//   - Approver identity is the signed-in profile + tenant role.
//   - Approve / Deny are gated to ams_pharmacist | consultant | admin.
//   - Denial requires a structured denial reason code.
//   - On mount we sweep SLAs (escalate overdue, expire past-grace).

import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { RequireAuth } from "@/auth/RequireAuth";
import { meduguActions, useMeduguState } from "../medugu/store/useAccessionStore";
import { buildAMSQueue } from "../medugu/logic/amsEngine";
import { getAntibiotic } from "../medugu/config/antibiotics";
import { AMS_DENIAL_REASONS, getDenialReason } from "../medugu/config/amsDenialReasons";
import { useAMSActor } from "../medugu/store/useAMSActor";
import type { AMSDenialReasonCode } from "../medugu/domain/types";

export const Route = createFileRoute("/ams")({
  component: AMSQueuePage,
});

function AMSQueuePage() {
  return (
    <RequireAuth>
      <AMSQueueInner />
    </RequireAuth>
  );
}

function AMSQueueInner() {
  const state = useMeduguState();
  const navigate = useNavigate();
  const actor = useAMSActor();
  const [noteByReq, setNoteByReq] = useState<Record<string, string>>({});
  const [denialByReq, setDenialByReq] = useState<Record<string, AMSDenialReasonCode>>({});
  const [sweepResult, setSweepResult] = useState<{ escalated: number; expired: number } | null>(null);

  useEffect(() => {
    const r = meduguActions.sweepAMSSlas(actor.label);
    if (r.escalated || r.expired) setSweepResult(r);
  }, [actor.label]);

  const queue = useMemo(() => buildAMSQueue(state.accessions), [state.accessions]);

  function decide(
    accessionId: string,
    requestId: string,
    status: "approved" | "denied",
  ) {
    if (status === "denied" && !denialByReq[requestId]) return;
    meduguActions.decideAMSApproval(accessionId, requestId, {
      status,
      actor: actor.label,
      actorUserId: actor.userId,
      actorRole: actor.role,
      note: noteByReq[requestId]?.trim() || undefined,
      denialReasonCode: status === "denied" ? denialByReq[requestId] : undefined,
    });
    setNoteByReq((s) => ({ ...s, [requestId]: "" }));
    setDenialByReq((s) => {
      const next = { ...s };
      delete next[requestId];
      return next;
    });
  }

  function runSweep() {
    setSweepResult(meduguActions.sweepAMSSlas(actor.label));
  }

  function openAccession(accessionCode: string) {
    meduguActions.setActive(accessionCode);
    void navigate({ to: "/" });
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-card px-6 py-3">
        <div className="flex items-baseline justify-between gap-4">
          <div>
            <h1 className="text-lg font-semibold">AMS approval queue</h1>
            <p className="text-xs text-muted-foreground">
              Tenant-wide pending restricted-antimicrobial approvals.
            </p>
          </div>
          <nav className="text-xs">
            <Link to="/" className="rounded border border-border px-2 py-1 hover:bg-muted">
              ← Workspace
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-4 p-6">
        <div className="flex flex-wrap items-center gap-3 rounded-md border border-border bg-card p-3 text-xs">
          <span className="text-muted-foreground uppercase tracking-wide text-[10px]">
            Approver
          </span>
          <span className="font-medium text-foreground">{actor.label}</span>
          {actor.role ? (
            <span className="chip chip-square chip-neutral">{actor.role}</span>
          ) : (
            <span className="chip chip-square chip-warning">no tenant role</span>
          )}
          {actor.canApprove ? (
            <span className="chip chip-square chip-success">may approve</span>
          ) : (
            <span className="chip chip-square chip-neutral">read-only</span>
          )}
          <span className="ml-auto text-[11px] text-muted-foreground">
            {queue.length} pending request(s)
          </span>
          <button
            type="button"
            onClick={runSweep}
            className="rounded border border-border px-2 py-1 hover:bg-muted"
          >
            Run SLA sweep
          </button>
        </div>

        {sweepResult ? (
          <div className="callout callout-info text-[11px]">
            SLA sweep: {sweepResult.escalated} escalated · {sweepResult.expired} expired.
          </div>
        ) : null}

        {queue.length === 0 ? (
          <p className="rounded-md border border-border bg-card p-6 text-center text-sm text-muted-foreground">
            No pending restricted-drug approval requests in the local cohort.
          </p>
        ) : (
          <ul className="space-y-2">
            {queue.map((item) => {
              const ab = getAntibiotic(item.request.antibioticCode);
              const denial = getDenialReason(item.request.denialReasonCode);
              return (
                <li key={item.request.id} className="rounded-md border border-border bg-card p-3">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <div>
                      <div className="text-sm font-medium text-foreground">
                        {ab?.display ?? item.request.antibioticCode}
                        <span className="ml-2 text-[10px] text-muted-foreground">
                          {item.request.antibioticCode}
                        </span>
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        <span className="font-mono">{item.accessionNumber}</span>
                        {" · "}
                        {item.patientLabel}
                        {item.ward ? ` · ${item.ward}` : ""}
                        {item.organismDisplay ? ` · ${item.organismDisplay}` : ""}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {item.request.escalated ? (
                        <span className="chip chip-square chip-danger uppercase">ESCALATED</span>
                      ) : null}
                      {item.overdue ? (
                        <span className="chip chip-square chip-danger uppercase">
                          OVERDUE
                        </span>
                      ) : (
                        <span className="chip chip-square chip-ams-pending uppercase">
                          PENDING
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => openAccession(item.accessionNumber)}
                        className="rounded border border-border px-2 py-0.5 text-[11px] hover:bg-muted"
                      >
                        Open accession →
                      </button>
                    </div>
                  </div>

                  <div className="mt-2 grid grid-cols-1 gap-1 text-[11px] text-muted-foreground md:grid-cols-2">
                    {item.request.requested && (
                      <div>
                        Requested by{" "}
                        <span className="text-foreground">{item.request.requested.actor}</span>
                        {item.request.requested.actorRole ? (
                          <span className="ml-1 chip chip-square chip-neutral">
                            {item.request.requested.actorRole}
                          </span>
                        ) : null}
                        {" · "}
                        {new Date(item.request.requested.at).toLocaleString()}
                        {item.request.clinicalJustification && (
                          <div className="italic">"{item.request.clinicalJustification}"</div>
                        )}
                      </div>
                    )}
                    {item.request.dueBy && (
                      <div>
                        Due by{" "}
                        <span className={item.overdue ? "text-destructive" : "text-foreground"}>
                          {new Date(item.request.dueBy).toLocaleString()}
                        </span>
                        {item.hoursToDue !== null && (
                          <span className="ml-1 text-muted-foreground">
                            ({item.hoursToDue >= 0
                              ? `${item.hoursToDue.toFixed(1)}h left`
                              : `${Math.abs(item.hoursToDue).toFixed(1)}h overdue`})
                          </span>
                        )}
                      </div>
                    )}
                    {denial ? (
                      <div>Last denial reason: <span className="chip chip-square chip-danger">{denial.label}</span></div>
                    ) : null}
                  </div>

                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <input
                      value={noteByReq[item.request.id] ?? ""}
                      onChange={(e) =>
                        setNoteByReq((s) => ({ ...s, [item.request.id]: e.target.value }))
                      }
                      placeholder="Decision note (optional)"
                      className="flex-1 min-w-[200px] rounded border border-border bg-background px-2 py-1 text-xs"
                      disabled={!actor.canApprove}
                    />
                    <select
                      value={denialByReq[item.request.id] ?? ""}
                      onChange={(e) =>
                        setDenialByReq((s) => ({
                          ...s,
                          [item.request.id]: e.target.value as AMSDenialReasonCode,
                        }))
                      }
                      disabled={!actor.canApprove}
                      className="rounded border border-border bg-background px-2 py-1 text-xs"
                      aria-label="Denial reason"
                    >
                      <option value="">Denial reason…</option>
                      {AMS_DENIAL_REASONS.map((r) => (
                        <option key={r.code} value={r.code}>{r.label}</option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => decide(item.accessionId, item.request.id, "approved")}
                      disabled={!actor.canApprove}
                      className="rounded bg-primary px-3 py-1 text-xs font-medium text-primary-foreground hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Approve
                    </button>
                    <button
                      type="button"
                      onClick={() => decide(item.accessionId, item.request.id, "denied")}
                      disabled={!actor.canApprove || !denialByReq[item.request.id]}
                      className="rounded bg-destructive px-3 py-1 text-xs font-medium text-destructive-foreground hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                      title={!denialByReq[item.request.id] ? "Pick a denial reason" : undefined}
                    >
                      Deny
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </main>
    </div>
  );
}
