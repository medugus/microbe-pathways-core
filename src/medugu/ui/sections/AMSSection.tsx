// AMSSection — per-accession AMS restricted-drug approval workspace.
// Browser-phase only: manual actor placeholder, no real notification
// transport, no production SLA enforcement. All workflow logic lives in
// logic/amsEngine.ts; this file is a presentation shell.

import { useState } from "react";
import { meduguActions, useActiveAccession } from "../../store/useAccessionStore";
import {
  AMS_POLICY,
  approvalStatusForRow,
  computeDueBy,
  findExpirableRequestIds,
  isRestrictedRow,
  latestApprovalForRow,
} from "../../logic/amsEngine";
import { getAntibiotic } from "../../config/antibiotics";
import { getStewardship } from "../../config/stewardshipRules";
import { newId } from "../../domain/ids";
import type { AMSApprovalRequest, AMSApprovalStatus, ASTResult } from "../../domain/types";

const STATUS_TONE: Record<AMSApprovalStatus, string> = {
  not_requested: "chip chip-square chip-neutral",
  pending: "chip chip-square chip-ams-pending",
  approved: "chip chip-square chip-ams-approved",
  denied: "chip chip-square chip-ams-denied",
  expired: "chip chip-square chip-danger",
};

const STATUS_LABEL: Record<AMSApprovalStatus, string> = {
  not_requested: "Not requested",
  pending: "Pending",
  approved: "Approved",
  denied: "Denied",
  expired: "Expired",
};

export function AMSSection() {
  const accession = useActiveAccession();
  const [actor, setActor] = useState("AMS pharmacist");
  const [requestNote, setRequestNote] = useState<Record<string, string>>({});
  const [decisionNote, setDecisionNote] = useState<Record<string, string>>({});

  if (!accession) {
    return (
      <div className="rounded-lg border border-border bg-card p-8 text-center text-sm text-muted-foreground">
        No active accession.
      </div>
    );
  }

  const restrictedRows = accession.ast.filter((r) => isRestrictedRow(r));

  function request(row: ASTResult) {
    if (!accession) return;
    const at = new Date().toISOString();
    const req: AMSApprovalRequest = {
      id: newId("ams"),
      astId: row.id,
      isolateId: row.isolateId,
      antibioticCode: row.antibioticCode,
      status: "pending",
      dueBy: computeDueBy(row.antibioticCode, at),
      requested: { at, actor, note: requestNote[row.id]?.trim() || undefined },
    };
    meduguActions.requestAMSApproval(accession.id, req, actor);
    setRequestNote((s) => ({ ...s, [row.id]: "" }));
  }

  function decide(reqId: string, status: "approved" | "denied") {
    if (!accession) return;
    meduguActions.decideAMSApproval(accession.id, reqId, {
      status,
      actor,
      note: decisionNote[reqId]?.trim() || undefined,
    });
    setDecisionNote((s) => ({ ...s, [reqId]: "" }));
  }

  function expirePending() {
    if (!accession) return;
    const ids = findExpirableRequestIds(accession);
    for (const id of ids) meduguActions.expireAMSApproval(accession.id, id, actor);
  }

  return (
    <div className="space-y-4">
      <div className="callout callout-warning text-[11px]">
        Browser-phase AMS workflow — actor identity is a manual placeholder, no
        external notifications are delivered, and SLA / escalation values are
        informational only. Production auth/role enforcement is out of scope for
        this stage.
      </div>

      <div className="flex flex-wrap items-end gap-2 rounded-md border border-border bg-background p-3">
        <label className="text-xs">
          <span className="block text-[10px] uppercase tracking-wide text-muted-foreground">
            Actor (placeholder)
          </span>
          <input
            value={actor}
            onChange={(e) => setActor(e.target.value)}
            className="mt-1 w-56 rounded border border-border bg-card px-2 py-1.5 text-sm"
          />
        </label>
        <button
          type="button"
          onClick={expirePending}
          className="rounded border border-border px-3 py-1.5 text-xs hover:bg-muted"
        >
          Expire overdue requests
        </button>
        <span className="text-[11px] text-muted-foreground">
          SLA: {AMS_POLICY.defaultSlaHours}h (Watch) · {AMS_POLICY.reserveSlaHours}h (Reserve)
        </span>
      </div>

      {restrictedRows.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No restricted antimicrobial rows on this accession.
        </p>
      ) : (
        <ul className="space-y-2">
          {restrictedRows.map((row) => {
            const status = approvalStatusForRow(accession, row.id);
            const latest = latestApprovalForRow(accession, row.id);
            const sw = getStewardship(row.antibioticCode);
            const ab = getAntibiotic(row.antibioticCode);
            const overdue =
              latest?.status === "pending" &&
              latest.dueBy !== undefined &&
              new Date(latest.dueBy).getTime() < Date.now();
            return (
              <li key={row.id} className="rounded-md border border-border bg-card p-3">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <div>
                    <div className="text-sm font-medium text-foreground">
                      {ab?.display ?? row.antibioticCode}
                      <span className="ml-2 text-[10px] text-muted-foreground">
                        {row.antibioticCode}
                      </span>
                      <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                        {sw?.aware ?? "—"}
                      </span>
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      Result: <span className="font-mono">{row.finalInterpretation ?? "—"}</span>
                    </div>
                  </div>
                  <span className={`rounded px-2 py-0.5 text-[10px] font-semibold ${STATUS_TONE[status]}`}>
                    {STATUS_LABEL[status]}
                    {overdue && " · OVERDUE"}
                  </span>
                </div>

                {latest && (
                  <div className="mt-2 grid grid-cols-1 gap-1 text-[11px] text-muted-foreground md:grid-cols-3">
                    {latest.requested && (
                      <div>
                        Requested by <span className="text-foreground">{latest.requested.actor}</span>{" "}
                        · {new Date(latest.requested.at).toLocaleString()}
                        {latest.requested.note && (
                          <div className="italic">"{latest.requested.note}"</div>
                        )}
                      </div>
                    )}
                    {latest.dueBy && (
                      <div>
                        Due by{" "}
                        <span className={overdue ? "text-destructive" : "text-foreground"}>
                          {new Date(latest.dueBy).toLocaleString()}
                        </span>
                        {latest.escalated && (
                          <span className="ml-1 rounded bg-destructive/15 px-1 py-0.5 text-[10px] text-destructive">
                            escalated
                          </span>
                        )}
                      </div>
                    )}
                    {latest.decided && (
                      <div>
                        Decided by <span className="text-foreground">{latest.decided.actor}</span>{" "}
                        · {new Date(latest.decided.at).toLocaleString()}
                        {latest.decided.note && (
                          <div className="italic">"{latest.decided.note}"</div>
                        )}
                      </div>
                    )}
                    {latest.expired && (
                      <div>
                        Expired @ {new Date(latest.expired.at).toLocaleString()}
                      </div>
                    )}
                  </div>
                )}

                {/* Actions */}
                {(status === "not_requested" || status === "denied" || status === "expired") && (
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <input
                      value={requestNote[row.id] ?? ""}
                      onChange={(e) =>
                        setRequestNote((s) => ({ ...s, [row.id]: e.target.value }))
                      }
                      placeholder="Reason / clinical justification (optional)"
                      className="flex-1 min-w-[200px] rounded border border-border bg-background px-2 py-1 text-xs"
                    />
                    <button
                      type="button"
                      onClick={() => request(row)}
                      className="rounded bg-primary px-3 py-1 text-xs font-medium text-primary-foreground hover:opacity-90"
                    >
                      Request approval
                    </button>
                  </div>
                )}

                {status === "pending" && latest && (
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <input
                      value={decisionNote[latest.id] ?? ""}
                      onChange={(e) =>
                        setDecisionNote((s) => ({ ...s, [latest.id]: e.target.value }))
                      }
                      placeholder="Decision note (optional)"
                      className="flex-1 min-w-[200px] rounded border border-border bg-background px-2 py-1 text-xs"
                    />
                    <button
                      type="button"
                      onClick={() => decide(latest.id, "approved")}
                      className="rounded bg-primary px-3 py-1 text-xs font-medium text-primary-foreground hover:opacity-90"
                    >
                      Approve
                    </button>
                    <button
                      type="button"
                      onClick={() => decide(latest.id, "denied")}
                      className="rounded bg-destructive px-3 py-1 text-xs font-medium text-destructive-foreground hover:opacity-90"
                    >
                      Deny
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
