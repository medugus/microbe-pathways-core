import { getAntibiotic } from "../../config/antibiotics";
import { getStewardship } from "../../config/stewardshipRules";
import { AMS_DENIAL_REASONS, getDenialReason } from "../../config/amsDenialReasons";
import {
  approvalStatusForRow,
  latestApprovalForRow,
} from "../../logic/amsEngine";
import type {
  Accession,
  AMSDenialReasonCode,
  ASTResult,
} from "../../domain/types";
import { AMSSLAChip } from "./AMSSLAChip";
import { AMSStatusChip } from "./AMSStatusChip";
import { PolishButton } from "../PolishButton";

function awareChip(aware: string | undefined): { label: string; tone: string } {
  const normalized = (aware ?? "").trim().toLowerCase();
  if (normalized === "access") return { label: "Access", tone: "chip chip-square chip-success" };
  if (normalized === "watch") return { label: "Watch", tone: "chip chip-square chip-warning" };
  if (normalized === "reserve") return { label: "Reserve", tone: "chip chip-square chip-danger" };
  return { label: "Unclassified", tone: "chip chip-square chip-neutral" };
}

interface AMSApprovalCardProps {
  accession: Accession;
  accessionRowId?: string | null;
  row: ASTResult;
  requestNote: string;
  decisionNote: Record<string, string>;
  denialCode: Record<string, AMSDenialReasonCode>;
  canRequest: boolean;
  canApprove: boolean;
  onRequestNoteChange: (value: string) => void;
  onDecisionNoteChange: (requestId: string, value: string) => void;
  onDenialCodeChange: (requestId: string, value: AMSDenialReasonCode) => void;
  onRequest: (row: ASTResult) => void;
  onDecide: (requestId: string, status: "approved" | "denied") => void;
}

export function AMSApprovalCard({
  accession,
  accessionRowId,
  row,
  requestNote,
  decisionNote,
  denialCode,
  canRequest,
  canApprove,
  onRequestNoteChange,
  onDecisionNoteChange,
  onDenialCodeChange,
  onRequest,
  onDecide,
}: AMSApprovalCardProps) {
  const status = approvalStatusForRow(accession, row.id);
  const latest = latestApprovalForRow(accession, row.id);
  const sw = getStewardship(row.antibioticCode);
  const ab = getAntibiotic(row.antibioticCode);
  const aware = awareChip(sw?.aware);
  const overdue =
    latest?.status === "pending" && latest.dueBy !== undefined && new Date(latest.dueBy).getTime() < Date.now();
  const denialReason = getDenialReason(latest?.denialReasonCode);

  return (
    <li className="rounded-md border border-border bg-card p-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <div className="text-sm font-medium text-foreground">
            {ab?.display ?? row.antibioticCode}
            <span className="ml-2 text-[10px] text-muted-foreground">{row.antibioticCode}</span>
            <span className={`ml-2 ${aware.tone}`}>{aware.label}</span>
          </div>
          <div className="text-[11px] text-muted-foreground">
            Result: <span className="font-mono">{row.finalInterpretation ?? "—"}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <AMSStatusChip status={status} overdue={overdue} />
          {latest?.escalated ? (
            <span className="chip chip-square chip-danger uppercase">escalated</span>
          ) : null}
        </div>
      </div>

      {latest ? (
        <div className="mt-2 grid grid-cols-1 gap-1 text-[11px] text-muted-foreground md:grid-cols-3">
          {latest.requested ? (
            <div>
              Requested by <span className="text-foreground">{latest.requested.actor}</span>
              {latest.requested.actorRole ? (
                <span className="ml-1 chip chip-square chip-neutral">{latest.requested.actorRole}</span>
              ) : null}
              {" · "}{new Date(latest.requested.at).toLocaleString()}
              {latest.clinicalJustification ? (
                <div className="italic">"{latest.clinicalJustification}"</div>
              ) : null}
            </div>
          ) : null}
          <AMSSLAChip dueBy={latest.dueBy} escalated={latest.escalated} />
          {latest.decided ? (
            <div>
              Decided by <span className="text-foreground">{latest.decided.actor}</span>
              {latest.decided.actorRole ? (
                <span className="ml-1 chip chip-square chip-neutral">{latest.decided.actorRole}</span>
              ) : null}
              {" · "}{new Date(latest.decided.at).toLocaleString()}
              {denialReason ? (
                <div>
                  <span className="chip chip-square chip-danger mt-1">{denialReason.label}</span>
                </div>
              ) : null}
              {latest.decided.note ? <div className="italic">"{latest.decided.note}"</div> : null}
            </div>
          ) : null}
          {latest.expired ? <div>Expired @ {new Date(latest.expired.at).toLocaleString()}</div> : null}
        </div>
      ) : null}

      {(status === "not_requested" || status === "denied" || status === "expired") ? (
        <div className="mt-2 space-y-2">
          {!canRequest ? (
            <p className="text-[11px] text-muted-foreground">
              Your tenant role cannot file approval requests.
            </p>
          ) : null}
          <div className="flex flex-wrap items-center gap-2">
            <input
              value={requestNote}
              onChange={(e) => onRequestNoteChange(e.target.value)}
              placeholder="Clinical justification (required)"
              className="min-w-[200px] flex-1 rounded border border-border bg-background px-2 py-1 text-xs"
              disabled={!canRequest}
            />
            <PolishButton
              task="ams_request_reason_polish"
              draft={requestNote}
              accessionRowId={accessionRowId}
              onAccept={(text) => onRequestNoteChange(text)}
              compact
            />
            <button
              type="button"
              onClick={() => onRequest(row)}
              disabled={!canRequest || !requestNote.trim()}
              className="rounded bg-primary px-3 py-1 text-xs font-medium text-primary-foreground hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              title={!requestNote.trim() ? "Justification required" : undefined}
            >
              Request approval
            </button>
          </div>
        </div>
      ) : null}

      {status === "pending" && latest ? (
        <div className="mt-2 space-y-2">
          {!canApprove ? (
            <p className="text-[11px] text-muted-foreground">
              Only AMS pharmacists, consultants, or admins can decide this request.
            </p>
          ) : null}
          <div className="flex flex-wrap items-center gap-2">
            <input
              value={decisionNote[latest.id] ?? ""}
              onChange={(e) => onDecisionNoteChange(latest.id, e.target.value)}
              placeholder="Decision note (optional)"
              className="min-w-[200px] flex-1 rounded border border-border bg-background px-2 py-1 text-xs"
              disabled={!canApprove}
            />
            <select
              value={denialCode[latest.id] ?? ""}
              onChange={(e) => onDenialCodeChange(latest.id, e.target.value as AMSDenialReasonCode)}
              disabled={!canApprove}
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
              onClick={() => onDecide(latest.id, "approved")}
              disabled={!canApprove}
              className="rounded bg-primary px-3 py-1 text-xs font-medium text-primary-foreground hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Approve
            </button>
            <button
              type="button"
              onClick={() => onDecide(latest.id, "denied")}
              disabled={!canApprove || !denialCode[latest.id]}
              className="rounded bg-destructive px-3 py-1 text-xs font-medium text-destructive-foreground hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              title={!denialCode[latest.id] ? "Pick a denial reason" : undefined}
            >
              Deny
            </button>
          </div>
        </div>
      ) : null}
    </li>
  );
}
