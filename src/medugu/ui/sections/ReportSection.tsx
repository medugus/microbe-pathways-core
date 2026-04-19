// ReportSection — live, governed clinician-facing preview built from
// accession state via logic/reportPreview. After release, also surfaces
// the frozen package so the operator can compare live vs released.

import { useActiveAccession } from "../../store/useAccessionStore";
import { buildReportPreview, type CommentSource } from "../../logic/reportPreview";

const COMMENT_LABEL: Record<CommentSource, string> = {
  clinical: "Clinical",
  stewardship: "Stewardship",
  ipc: "IPC",
};

export function ReportSection() {
  const accession = useActiveAccession();
  if (!accession) {
    return (
      <div className="rounded-lg border border-border bg-card p-8 text-center text-sm text-muted-foreground">
        No active accession.
      </div>
    );
  }
  const doc = buildReportPreview(accession);

  return (
    <div className="space-y-4">
      <div className="rounded-md border border-border bg-background p-4 font-serif">
        <header className="border-b border-border pb-2">
          <div className="flex items-baseline justify-between">
            <h3 className="text-lg font-semibold text-foreground">Microbiology report (preview)</h3>
            <span className="font-mono text-xs text-muted-foreground">{doc.accessionNumber}</span>
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            {doc.releaseState} · v{doc.reportVersion} · generated {new Date(doc.generatedAt).toLocaleString()}
          </div>
        </header>

        <section className="mt-3 grid grid-cols-1 gap-2 text-sm md:grid-cols-2">
          <div>
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Patient</div>
            <div className="text-foreground">{doc.patient.name} · {doc.patient.sex}</div>
            <div className="text-xs text-muted-foreground">MRN {doc.patient.mrn}{doc.patient.ward ? ` · ${doc.patient.ward}` : ""}</div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Specimen</div>
            <div className="text-foreground">{doc.specimen.display}</div>
            <div className="text-xs text-muted-foreground">
              pathway {doc.specimen.pathway}{doc.specimen.syndrome ? ` · ${doc.specimen.syndrome}` : ""}
            </div>
          </div>
        </section>

        <section className="mt-3">
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Microscopy</div>
          <p className="text-sm text-foreground">{doc.microscopySummary}</p>
        </section>

        <section className="mt-3">
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Culture & susceptibility</div>
          {doc.isolates.length === 0 ? (
            <p className="text-sm text-muted-foreground">No isolates reported.</p>
          ) : (
            <ul className="mt-1 space-y-3">
              {doc.isolates.map((iso) => (
                <li key={iso.isolateNo} className="rounded border border-border p-2">
                  <div className="text-sm">
                    <span className="font-mono text-xs text-muted-foreground">#{iso.isolateNo}</span>{" "}
                    <span className="font-semibold text-foreground">{iso.organismDisplay}</span>
                    {iso.significance && (
                      <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                        {iso.significance}
                      </span>
                    )}
                    {iso.growth && (
                      <span className="ml-2 text-xs text-muted-foreground">growth: {iso.growth}</span>
                    )}
                  </div>
                  {iso.ast.length > 0 && (
                    <table className="mt-2 w-full text-xs">
                      <thead className="text-[10px] uppercase tracking-wide text-muted-foreground">
                        <tr>
                          <th className="py-1 text-left">Antibiotic</th>
                          <th className="py-1 text-left">Result</th>
                          <th className="py-1 text-left">Raw</th>
                          <th className="py-1 text-left">Governance</th>
                        </tr>
                      </thead>
                      <tbody>
                        {iso.ast.map((r) => (
                          <tr key={r.antibioticCode} className="border-t border-border">
                            <td className="py-1 text-foreground">{r.antibioticDisplay}</td>
                            <td className="py-1 font-mono">{r.interpretation ?? "—"}</td>
                            <td className="py-1 text-muted-foreground">
                              {r.rawValue ?? "—"} {r.rawUnit ?? ""}
                            </td>
                            <td className="py-1 text-muted-foreground">{r.governance}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        {doc.comments.length > 0 && (
          <section className="mt-3">
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Interpretive comments</div>
            <ul className="mt-1 space-y-1">
              {doc.comments.map((c, idx) => (
                <li key={idx} className="text-sm text-foreground">
                  <span className="mr-1 rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase text-muted-foreground">
                    {COMMENT_LABEL[c.source]}
                  </span>
                  {c.text}
                </li>
              ))}
            </ul>
          </section>
        )}

        <footer className="mt-3 border-t border-border pt-2 text-[10px] text-muted-foreground">
          rules {doc.versions.rule} · breakpoints {doc.versions.breakpoint} · export {doc.versions.export} · build {doc.versions.build}
        </footer>
      </div>

      {accession.releasePackage && (
        <p className="text-[11px] text-muted-foreground">
          A frozen v{accession.releasePackage.version} release package exists for this accession.
          The preview above always reflects live state; the snapshot is preserved on the Release section.
        </p>
      )}
    </div>
  );
}
