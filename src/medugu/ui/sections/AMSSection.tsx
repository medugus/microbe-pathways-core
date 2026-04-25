// AMSSection — per-accession AMS restricted-drug approval workspace.
// Browser-phase only: manual actor placeholder, no real notification
// transport, no production SLA enforcement. All workflow logic lives in
// logic/amsEngine.ts; this file is a presentation shell.

import { useState } from "react";
import { AMS_BROWSER_PHASE_WARNING, AMS_POLICY } from "../../config/amsConfig";
import { newId } from "../../domain/ids";
import type { AMSApprovalRequest, ASTResult } from "../../domain/types";
import { computeDueBy, findExpirableRequestIds, isRestrictedRow } from "../../logic/amsEngine";
import { meduguActions, useActiveAccession } from "../../store/useAccessionStore";
import { AMSApprovalQueue } from "./AMSApprovalQueue";

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

  const currentAccession = accession;
  const restrictedRows = currentAccession.ast.filter((r) => isRestrictedRow(r));

  function request(row: ASTResult) {
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
    meduguActions.requestAMSApproval(currentAccession.id, req, actor);
    setRequestNote((s) => ({ ...s, [row.id]: "" }));
  }

  function decide(reqId: string, status: "approved" | "denied") {
    meduguActions.decideAMSApproval(currentAccession.id, reqId, {
      status,
      actor,
      note: decisionNote[reqId]?.trim() || undefined,
    });
    setDecisionNote((s) => ({ ...s, [reqId]: "" }));
  }

  function expirePending() {
    const ids = findExpirableRequestIds(currentAccession);
    for (const id of ids) meduguActions.expireAMSApproval(currentAccession.id, id, actor);
  }

  return (
    <div className="space-y-4">
      <div className="callout callout-warning text-[11px]">{AMS_BROWSER_PHASE_WARNING}</div>

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

      <AMSApprovalQueue
        accession={currentAccession}
        restrictedRows={restrictedRows}
        requestNote={requestNote}
        decisionNote={decisionNote}
        onRequestNoteChange={(rowId, value) => setRequestNote((s) => ({ ...s, [rowId]: value }))}
        onDecisionNoteChange={(requestId, value) => setDecisionNote((s) => ({ ...s, [requestId]: value }))}
        onRequest={request}
        onDecide={decide}
      />
    </div>
  );
}
