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
  onAccept: (antibioticCode: string, zoneDiameterMm?: number) => void;
  onReject: (antibioticCode: string) => void;
  onRejectUnmatched: (antibioticCode: string) => void;
  onRejectAllUnmatched: () => void;
}

function confidenceLabel(m: MatchedRow): string {
  if (typeof m.confidenceNumeric === "number") {
    return `${(m.confidenceNumeric * 100).toFixed(0)}%${m.readerConfidence ? ` · ${m.readerConfidence}` : ""}`;
  }
  return m.readerConfidence ?? "—";
}

export function ZoneReaderImportReviewTable({
  matched,
  unmatched,
  missing,
  onAccept,
  onReject,
  onRejectUnmatched,
  onRejectAllUnmatched,
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
              {matched.map((m) => {
                const duplicateCandidates = m.duplicateCandidates ?? [];
                return (
                  <TableRow key={m.antibioticCode}>
                    <TableCell className="font-mono text-xs">{m.antibioticCode}</TableCell>
                    <TableCell>
                      {duplicateCandidates.length > 1
                        ? duplicateCandidates.map((candidate) => candidate.zoneDiameterMm).join(" / ")
                        : m.zoneDiameterMm}
                    </TableCell>
                    <TableCell>{confidenceLabel(m)}</TableCell>
                    <TableCell className="text-xs">
                      {duplicateCandidates.length > 1 ? (
                        <span className="text-amber-600">
                          duplicate_antibiotic · choose the correct value
                        </span>
                      ) : m.requiresReview ? (
                        <span className="text-amber-600">{m.reviewReasons.join(", ")}</span>
                      ) : (
                        <span className="text-muted-foreground">ok</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex flex-wrap justify-end gap-1">
                        {duplicateCandidates.length > 1 ? (
                          <>
                            {duplicateCandidates.map((candidate) => (
                              <Button
                                key={candidate.candidateId}
                                size="sm"
                                onClick={() =>
                                  onAccept(m.antibioticCode, candidate.zoneDiameterMm)
                                }
                              >
                                Use {candidate.zoneDiameterMm} mm
                              </Button>
                            ))}
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => onReject(m.antibioticCode)}
                            >
                              Reject duplicate group
                            </Button>
                          </>
                        ) : (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => onReject(m.antibioticCode)}
                            >
                              Reject
                            </Button>
                            <Button size="sm" onClick={() => onAccept(m.antibioticCode)}>
                              Accept
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </section>

      {unmatched.length > 0 && (
        <section className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Unmatched reader rows ({unmatched.length})
            </h4>
            <Button size="sm" variant="outline" onClick={onRejectAllUnmatched}>
              Reject all unmatched rows
            </Button>
          </div>
          <div className="space-y-1">
            {unmatched.map((u, index) => (
              <div
                key={`${u.antibioticCode}-${u.zoneDiameterMm}-${index}`}
                className="flex flex-wrap items-center justify-between gap-2 rounded border p-2 text-xs"
              >
                <span>
                  {u.antibioticCode} — {u.zoneDiameterMm} mm (not eligible for the selected
                  isolate/panel)
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onRejectUnmatched(u.antibioticCode)}
                >
                  Reject row
                </Button>
              </div>
            ))}
          </div>
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
