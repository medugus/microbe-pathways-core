// StewardshipSection — visualises stewardship engine output per AST row.
// Logic in logic/stewardshipEngine.ts; this is a thin presentation shell.

import { useActiveAccession } from "../../store/useAccessionStore";
import { evaluateStewardship } from "../../logic/stewardshipEngine";
import { getAntibiotic } from "../../config/antibiotics";

const CLASS_TONE: Record<string, string> = {
  unrestricted: "bg-secondary text-secondary-foreground",
  first_line_preferred: "bg-primary/15 text-primary",
  cascade_suppressed: "bg-muted text-muted-foreground",
  restricted: "bg-destructive/15 text-destructive",
  screening_only: "bg-muted text-muted-foreground",
};

export function StewardshipSection() {
  const accession = useActiveAccession();
  if (!accession) {
    return (
      <div className="rounded-lg border border-border bg-card p-8 text-center text-sm text-muted-foreground">
        No active accession.
      </div>
    );
  }

  const sw = evaluateStewardship(accession);
  if (sw.decisions.length === 0) {
    return <p className="text-sm text-muted-foreground">No AST rows to evaluate yet.</p>;
  }

  const grouped = accession.isolates.map((iso) => ({
    iso,
    rows: sw.decisions.filter((d) => d.isolateId === iso.id),
  }));

  return (
    <div className="space-y-5">
      <header>
        <p className="text-xs text-muted-foreground">
          Release class, AWaRe category, syndrome guidance, and approval gating per AST row.
        </p>
      </header>

      {grouped.map(({ iso, rows }) =>
        rows.length === 0 ? null : (
          <section key={iso.id} className="rounded-md border border-border bg-card">
            <header className="border-b border-border px-3 py-2 text-xs">
              <span className="font-mono text-muted-foreground">#{iso.isolateNo}</span>{" "}
              <span className="font-medium text-foreground">{iso.organismDisplay}</span>
            </header>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-left">Antibiotic</th>
                    <th className="px-3 py-2 text-left">AWaRe</th>
                    <th className="px-3 py-2 text-left">Release class</th>
                    <th className="px-3 py-2 text-left">Visibility</th>
                    <th className="px-3 py-2 text-left">Note</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((d) => (
                    <tr key={d.astId} className="border-t border-border align-top">
                      <td className="px-3 py-2">
                        <div className="font-medium text-foreground">
                          {getAntibiotic(d.antibioticCode)?.display ?? d.antibioticCode}
                        </div>
                        <div className="text-[10px] text-muted-foreground">{d.antibioticCode}</div>
                      </td>
                      <td className="px-3 py-2">
                        <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                          {d.aware}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        <span className={`rounded px-1.5 py-0.5 text-[10px] ${CLASS_TONE[d.releaseClass] ?? "bg-muted text-muted-foreground"}`}>
                          {d.releaseClass}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        {d.visibleToClinician ? (
                          <span className="text-foreground">visible</span>
                        ) : (
                          <span className="text-destructive">
                            hidden{d.approvalRequired ? " · approval needed" : ""}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">
                        {d.suppressionReason ?? d.advisory ?? "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ),
      )}

      {sw.notes.length > 0 && (
        <section>
          <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Stewardship notes
          </h4>
          <ul className="space-y-1.5">
            {sw.notes.map((n) => (
              <li key={n.id} className="rounded border border-border bg-background px-3 py-2 text-xs">
                <code className="text-[10px] text-muted-foreground">{n.flag}</code>
                <div className="mt-0.5 text-foreground">{n.message}</div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
