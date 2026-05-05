import type { Accession, AMSDenialReasonCode, ASTResult } from "../../domain/types";
import { AMSApprovalCard } from "./AMSApprovalCard";

interface AMSApprovalQueueProps {
  accession: Accession;
  accessionRowId?: string | null;
  restrictedRows: ASTResult[];
  requestNote: Record<string, string>;
  decisionNote: Record<string, string>;
  denialCode: Record<string, AMSDenialReasonCode>;
  canRequest: boolean;
  canApprove: boolean;
  onRequestNoteChange: (rowId: string, value: string) => void;
  onDecisionNoteChange: (requestId: string, value: string) => void;
  onDenialCodeChange: (requestId: string, value: AMSDenialReasonCode) => void;
  onRequest: (row: ASTResult) => void;
  onDecide: (requestId: string, status: "approved" | "denied") => void;
}

export function AMSApprovalQueue({
  accession,
  accessionRowId,
  restrictedRows,
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
}: AMSApprovalQueueProps) {
  if (restrictedRows.length === 0) {
    return <p className="text-sm text-muted-foreground">No restricted antimicrobial rows on this accession.</p>;
  }

  return (
    <ul className="space-y-2">
      {restrictedRows.map((row) => (
        <AMSApprovalCard
          key={row.id}
          accession={accession}
          accessionRowId={accessionRowId}
          row={row}
          requestNote={requestNote[row.id] ?? ""}
          decisionNote={decisionNote}
          denialCode={denialCode}
          canRequest={canRequest}
          canApprove={canApprove}
          onRequestNoteChange={(value) => onRequestNoteChange(row.id, value)}
          onDecisionNoteChange={onDecisionNoteChange}
          onDenialCodeChange={onDenialCodeChange}
          onRequest={onRequest}
          onDecide={onDecide}
        />
      ))}
    </ul>
  );
}
