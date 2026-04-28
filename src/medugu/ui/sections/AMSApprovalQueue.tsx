import type { Accession, ASTResult } from "../../domain/types";
import { AMSApprovalCard } from "./AMSApprovalCard";

interface AMSApprovalQueueProps {
  accession: Accession;
  restrictedRows: ASTResult[];
  requestNote: Record<string, string>;
  decisionNote: Record<string, string>;
  onRequestNoteChange: (rowId: string, value: string) => void;
  onDecisionNoteChange: (requestId: string, value: string) => void;
  onRequest: (row: ASTResult) => void;
  onDecide: (requestId: string, status: "approved" | "denied") => void;
}

export function AMSApprovalQueue({
  accession,
  restrictedRows,
  requestNote,
  decisionNote,
  onRequestNoteChange,
  onDecisionNoteChange,
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
          row={row}
          requestNote={requestNote[row.id] ?? ""}
          decisionNote={decisionNote}
          onRequestNoteChange={(value) => onRequestNoteChange(row.id, value)}
          onDecisionNoteChange={onDecisionNoteChange}
          onRequest={onRequest}
          onDecide={onDecide}
        />
      ))}
    </ul>
  );
}
