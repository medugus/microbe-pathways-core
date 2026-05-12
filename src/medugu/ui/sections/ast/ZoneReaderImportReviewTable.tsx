import type { MatchedRow, ZoneResult } from "../../../integrations/zoneReader/types";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";

interface Props {
  matched: MatchedRow[];
  unmatched: ZoneResult[];
  missing: string[];
  onAccept: (antibioticCode: string) => void;
  onReject: (antibioticCode: string) => void;
}

export function ZoneReaderImportReviewTable({
  matched,
  unmatched,
  missing,
  onAccept,
  onReject,
}: Props) {
  return (
    <div className="space-y-3">
      <section>
        <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Matched rows ({matched.length})
        </h4>
        {matched.length === 0 ? (
          <p className="text-xs text-muted-foreground">No matched rows pending.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Antibiotic</TableHead>
                <TableHead>Zone (mm)</TableHead>
                <TableHead>Confidence</TableHead>
                <TableHead>Review</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {matched.map((m) => (
                <TableRow key={m.antibioticCode}>
                  <TableCell className="font-mono text-xs">{m.antibioticCode}</TableCell>
                  <TableCell>{m.zoneMm}</TableCell>
                  <TableCell>
                    {typeof m.confidence === "number"
                      ? `${(m.confidence * 100).toFixed(0)}%`
                      : "—"}
                  </TableCell>
                  <TableCell className="text-xs">
                    {m.requiresReview ? (
                      <span className="text-amber-600">{m.reviewReasons.join(", ")}</span>
                    ) : (
                      <span className="text-muted-foreground">ok</span>
                    )}
                  </TableCell>
                  <TableCell className="space-x-1 text-right">
                    <Button size="sm" variant="outline" onClick={() => onReject(m.antibioticCode)}>
                      Reject
                    </Button>
                    <Button size="sm" onClick={() => onAccept(m.antibioticCode)}>
                      Accept
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </section>

      {unmatched.length > 0 && (
        <section>
          <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Unmatched reader rows ({unmatched.length})
          </h4>
          <ul className="text-xs text-muted-foreground">
            {unmatched.map((u) => (
              <li key={u.antibioticCode}>
                {u.antibioticCode} — {u.zoneMm} mm (no AST row on this isolate/panel)
              </li>
            ))}
          </ul>
        </section>
      )}

      {missing.length > 0 && (
        <section>
          <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Worklist rows missing from reader ({missing.length})
          </h4>
          <p className="text-xs text-muted-foreground">{missing.join(", ")}</p>
        </section>
      )}
    </div>
  );
}
