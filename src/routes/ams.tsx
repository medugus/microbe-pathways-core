// AMS queue dashboard — tenant-wide pending restricted-drug approvals.
//
// Browser-phase only:
// - actor identity is a manual placeholder
// - no real notification transport
// - SLA / overdue badges are informational hints, not enforcement
// - no production role-gating yet (RequireAuth only checks signed-in)

import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { RequireAuth } from "@/auth/RequireAuth";
import { meduguActions, useMeduguState } from "../medugu/store/useAccessionStore";
import { buildAMSQueue } from "../medugu/logic/amsEngine";
import { getAntibiotic } from "../medugu/config/antibiotics";

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
  const [actor, setActor] = useState("AMS pharmacist");
  const [noteByReq, setNoteByReq] = useState<Record<string, string>>({});

  const queue = useMemo(() => buildAMSQueue(state.accessions), [state.accessions]);

  function decide(accessionId: string, requestId: string, status: "approved" | "denied") {
    meduguActions.decideAMSApproval(accessionId, requestId, {
      status,
      actor,
      note: noteByReq[requestId]?.trim() || undefined,
    });
    setNoteByReq((s) => ({ ...s, [requestId]: "" }));
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
        <div className="callout callout-warning text-[11px]">
          Browser-phase AMS workflow — actor is a manual placeholder, no external notifications are
          delivered, SLA values are informational only, and production role enforcement is out of
          scope for this stage.
        </div>

        <div className="flex flex-wrap items-end gap-2 rounded-md border border-border bg-card p-3">
          <label className="text-xs">
            <span className="block text-[10px] uppercase tracking-wide text-muted-foreground">
              Actor (placeholder)
            </span>
            <input
              value={actor}
              onChange={(e) => setActor(e.target.value)}
              className="mt-1 w-56 rounded border border-border bg-background px-2 py-1.5 text-sm"
            />
          </label>
          <span className="text-[11px] text-muted-foreground">
            {queue.length} pending request(s)
          </span>
        </div>

        {queue.length === 0 ? (
          <p className="rounded-md border border-border bg-card p-6 text-center text-sm text-muted-foreground">
            No pending restricted-drug approval requests in the local cohort.
          </p>
        ) : (
          <ul className="space-y-2">
            {queue.map((item) => {
              const ab = getAntibiotic(item.request.antibioticCode);
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
                      {item.overdue ? (
                        <span className="chip chip-square chip-danger uppercase">OVERDUE</span>
                      ) : (
                        <span className="chip chip-square chip-ams-pending uppercase">PENDING</span>
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
                        {" · "}
                        {new Date(item.request.requested.at).toLocaleString()}
                        {item.request.requested.note && (
                          <div className="italic">"{item.request.requested.note}"</div>
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
                            (
                            {item.hoursToDue >= 0
                              ? `${item.hoursToDue.toFixed(1)}h left`
                              : `${Math.abs(item.hoursToDue).toFixed(1)}h overdue`}
                            )
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <input
                      value={noteByReq[item.request.id] ?? ""}
                      onChange={(e) =>
                        setNoteByReq((s) => ({ ...s, [item.request.id]: e.target.value }))
                      }
                      placeholder="Decision note (optional)"
                      className="flex-1 min-w-[200px] rounded border border-border bg-background px-2 py-1 text-xs"
                    />
                    <button
                      type="button"
                      onClick={() => decide(item.accessionId, item.request.id, "approved")}
                      className="rounded bg-primary px-3 py-1 text-xs font-medium text-primary-foreground hover:opacity-90"
                    >
                      Approve
                    </button>
                    <button
                      type="button"
                      onClick={() => decide(item.accessionId, item.request.id, "denied")}
                      className="rounded bg-destructive px-3 py-1 text-xs font-medium text-destructive-foreground hover:opacity-90"
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
