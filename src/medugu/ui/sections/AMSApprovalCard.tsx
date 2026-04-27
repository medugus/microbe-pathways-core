import { getAntibiotic } from "../../config/antibiotics";
import { getStewardship } from "../../config/stewardshipRules";
import { approvalStatusForRow, latestApprovalForRow } from "../../logic/amsEngine";
import type { Accession, ASTResult } from "../../domain/types";
import { AMSSLAChip } from "./AMSSLAChip";
import { AMSStatusChip } from "./AMSStatusChip";

function awareChip(aware: string | undefined): { label: string; tone: string } {
  const normalized = (aware ?? "").trim().toLowerCase();
  if (normalized === "access") return { label: "Access", tone: "chip chip-square chip-success" };
  if (normalized === "watch") return { label: "Watch", tone: "chip chip-square chip-warning" };
  if (normalized === "reserve") return { label: "Reserve", tone: "chip chip-square chip-danger" };
  return { label: "Unclassified", tone: "chip chip-square chip-neutral" };
}

interface AMSApprovalCardProps {
  accession: Accession;
  row: ASTResult;
  requestNote: string;
  decisionNote: Record<string, string>;
  onRequestNoteChange: (value: string) => void;
  onDecisionNoteChange: (requestId: string, value: string) => void;
  onRequest: (row: ASTResult) => void;
  onDecide: (requestId: string, status: "approved" | "denied") => void;
}

export function AMSApprovalCard({
  accession,
  row,
  requestNote,
  decisionNote,
  onRequestNoteChange,
  onDecisionNoteChange,
  onRequest,
  onDecide,
}: AMSApprovalCardProps) {
  const status = approvalStatusForRow(accession, row.id);
  const latest = latestApprovalForRow(accession, row.id);
  const sw = getStewardship(row.antibioticCode);
  const ab = getAntibiotic(row.antibioticCode);
  const aware = awareChip(sw?.aware);
  const overdue =
    latest?.status === "pending" &&
    latest.dueBy !== undefined &&
    new Date(latest.dueBy).getTime() < Date.now();

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
        <AMSStatusChip status={status} overdue={overdue} />
      </div>

      {latest ? (
        <div className="mt-2 grid grid-cols-1 gap-1 text-[11px] text-muted-foreground md:grid-cols-3">
          {latest.requested ? (
            <div>
              Requested by <span className="text-foreground">{latest.requested.actor}</span> ·{" "}
              {new Date(latest.requested.at).toLocaleString()}
              {latest.requested.note ? (
                <div className="italic">"{latest.requested.note}"</div>
              ) : null}
            </div>
          ) : null}
          <AMSSLAChip dueBy={latest.dueBy} escalated={latest.escalated} />
          {latest.decided ? (
            <div>
              Decided by <span className="text-foreground">{latest.decided.actor}</span> ·{" "}
              {new Date(latest.decided.at).toLocaleString()}
              {latest.decided.note ? <div className="italic">"{latest.decided.note}"</div> : null}
            </div>
          ) : null}
          {latest.expired ? (
            <div>Expired @ {new Date(latest.expired.at).toLocaleString()}</div>
          ) : null}
        </div>
      ) : null}

      {status === "not_requested" || status === "denied" || status === "expired" ? (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <input
            value={requestNote}
            onChange={(e) => onRequestNoteChange(e.target.value)}
            placeholder="Reason / clinical justification (optional)"
            className="min-w-[200px] flex-1 rounded border border-border bg-background px-2 py-1 text-xs"
          />
          <button
            type="button"
            onClick={() => onRequest(row)}
            className="rounded bg-primary px-3 py-1 text-xs font-medium text-primary-foreground hover:opacity-90"
          >
            Request approval
          </button>
        </div>
      ) : null}

      {status === "pending" && latest ? (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <input
            value={decisionNote[latest.id] ?? ""}
            onChange={(e) => onDecisionNoteChange(latest.id, e.target.value)}
            placeholder="Decision note (optional)"
            className="min-w-[200px] flex-1 rounded border border-border bg-background px-2 py-1 text-xs"
          />
          <button
            type="button"
            onClick={() => onDecide(latest.id, "approved")}
            className="rounded bg-primary px-3 py-1 text-xs font-medium text-primary-foreground hover:opacity-90"
          >
            Approve
          </button>
          <button
            type="button"
            onClick={() => onDecide(latest.id, "denied")}
            className="rounded bg-destructive px-3 py-1 text-xs font-medium text-destructive-foreground hover:opacity-90"
          >
            Deny
          </button>
        </div>
      ) : null}
    </li>
  );
}
