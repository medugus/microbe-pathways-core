import { useMemo } from "react";
import { ReleaseState } from "../../domain/enums";
import type { Accession } from "../../domain/types";
import { buildReportPreview, type CommentSource, type ReportPreviewDoc } from "../../logic/reportPreview";
import { useMeduguState } from "../../store/useAccessionStore";

const COMMENT_LABEL: Record<CommentSource, string> = {
  clinical: "Clinical",
  stewardship: "Stewardship",
  ipc: "IPC",
};

interface PrintableReport {
  accession: Accession;
  doc: ReportPreviewDoc;
  sourceLabel: string;
  releasedAt: string;
}

function isCompletedReport(accession: Accession): boolean {
  return (
    accession.release.state === ReleaseState.Released ||
    accession.release.state === ReleaseState.Amended
  );
}

function sourceDoc(accession: Accession): { doc: ReportPreviewDoc; sourceLabel: string } {
  if (accession.releasePackage?.body) {
    return {
      doc: accession.releasePackage.body as ReportPreviewDoc,
      sourceLabel: "Frozen release package",
    };
  }
  return { doc: buildReportPreview(accession), sourceLabel: "Live released projection" };
}

function releasedAt(accession: Accession): string {
  return accession.release.releasedAt ?? accession.releasedAt ?? accession.updatedAt ?? accession.createdAt;
}

function formatDateTime(value?: string): string {
  if (!value) return "Not recorded";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatCode(value?: string): string {
  if (!value) return "-";
  return value.replace(/_/g, " ").toLowerCase();
}

function printCompletedReports() {
  if (typeof window !== "undefined") window.print();
}

export function CompletedReportsPdfPanel() {
  const state = useMeduguState();
  const generatedAt = useMemo(() => new Date().toISOString(), []);
  const reports = useMemo<PrintableReport[]>(() => {
    return Object.values(state.accessions)
      .filter(isCompletedReport)
      .map((accession) => {
        const { doc, sourceLabel } = sourceDoc(accession);
        return { accession, doc, sourceLabel, releasedAt: releasedAt(accession) };
      })
      .sort((a, b) => b.releasedAt.localeCompare(a.releasedAt));
  }, [state.accessions]);

  const frozenCount = reports.filter((r) => r.accession.releasePackage?.body).length;
  const amendedCount = reports.filter((r) => r.accession.release.state === ReleaseState.Amended).length;

  return (
    <section className="rounded-md border border-border bg-card p-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h4 className="text-sm font-semibold text-foreground">Completed reports PDF pack</h4>
          <p className="mt-1 max-w-3xl text-xs text-muted-foreground">
            Print or save a styled PDF bundle of all completed reports currently loaded in
            this LIMS workspace.
          </p>
        </div>
        <button
          type="button"
          onClick={printCompletedReports}
          disabled={reports.length === 0}
          className="rounded bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Print / save PDF
        </button>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-4">
        <PdfMetric label="Completed reports" value={reports.length} />
        <PdfMetric label="Frozen packages" value={frozenCount} />
        <PdfMetric label="Amended" value={amendedCount} />
        <PdfMetric label="Generated" value={formatDateTime(generatedAt)} />
      </div>

      {reports.length === 0 ? (
        <p className="mt-3 rounded border border-dashed border-border bg-background p-3 text-xs text-muted-foreground">
          No completed reports are currently loaded. Release one or more reports first, then
          return here to print the PDF pack.
        </p>
      ) : (
        <div className="mt-3 rounded border border-border bg-background p-3">
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
            Included in PDF pack
          </div>
          <ul className="mt-2 grid grid-cols-1 gap-2 lg:grid-cols-2">
            {reports.map(({ accession, doc, sourceLabel, releasedAt }) => (
              <li key={accession.id} className="rounded border border-border bg-card px-2 py-1.5 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-foreground">{accession.accessionNumber}</span>
                  <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                    {doc.releaseState} v{doc.reportVersion}
                  </span>
                </div>
                <div className="mt-1 text-muted-foreground">
                  {doc.patient.name} - {doc.specimen.display}
                </div>
                <div className="mt-1 text-[10px] text-muted-foreground">
                  {formatDateTime(releasedAt)} - {sourceLabel}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      <PrintableReportPack reports={reports} generatedAt={generatedAt} />
      <PrintStyles />
    </section>
  );
}

function PdfMetric({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded border border-border bg-background p-2">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 text-sm font-semibold text-foreground">{value}</div>
    </div>
  );
}

function PrintableReportPack({ reports, generatedAt }: { reports: PrintableReport[]; generatedAt: string }) {
  return (
    <div className="completed-report-print-pack" aria-hidden="true">
      <section className="pdf-cover-page">
        <div className="pdf-cover-rule" />
        <p className="pdf-kicker">Clinical Microbiology LIMS</p>
        <h1>Completed Microbiology Reports</h1>
        <p className="pdf-cover-meta">Generated {formatDateTime(generatedAt)}</p>
        <p className="pdf-cover-note">
          This pack contains completed reports currently loaded in the LIMS workspace. Frozen
          release packages are used when available; otherwise the released live projection is
          rendered and clearly labelled.
        </p>
        <table className="pdf-summary-table">
          <thead>
            <tr>
              <th>Accession</th>
              <th>Patient</th>
              <th>Specimen</th>
              <th>Status</th>
              <th>Source</th>
            </tr>
          </thead>
          <tbody>
            {reports.map((report) => (
              <tr key={report.accession.id}>
                <td>{report.accession.accessionNumber}</td>
                <td>{report.doc.patient.name}</td>
                <td>{report.doc.specimen.display}</td>
                <td>
                  {report.doc.releaseState} v{report.doc.reportVersion}
                </td>
                <td>{report.sourceLabel}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {reports.map((report, index) => (
        <PrintableReport key={report.accession.id} report={report} ordinal={index + 1} />
      ))}
    </div>
  );
}

function PrintableReport({ report, ordinal }: { report: PrintableReport; ordinal: number }) {
  const { accession, doc, sourceLabel, releasedAt } = report;
  const isBloodReport = !!(doc.bloodSets?.length || doc.bloodBottles?.length);
  return (
    <article className="pdf-report-page">
      <header className="pdf-report-header">
        <div>
          <p className="pdf-kicker">Microbiology report #{ordinal}</p>
          <h2>{doc.specimen.display}</h2>
          <p className="pdf-subtitle">
            {doc.releaseState} v{doc.reportVersion} - {sourceLabel}
          </p>
        </div>
        <div className="pdf-accession-badge">
          <span>Accession</span>
          <strong>{doc.accessionNumber}</strong>
        </div>
      </header>

      <section className="pdf-demographics-grid">
        <InfoBlock label="Patient" value={doc.patient.name} detail={`MRN ${doc.patient.mrn} - ${doc.patient.sex}`} />
        <InfoBlock label="Ward / unit" value={doc.patient.ward ?? "Not recorded"} />
        <InfoBlock label="Specimen pathway" value={doc.specimen.pathway} detail={doc.specimen.syndrome} />
        <InfoBlock label="Released" value={formatDateTime(releasedAt)} detail={`Generated ${formatDateTime(doc.generatedAt)}`} />
      </section>

      {doc.bloodSets && doc.bloodSets.length > 0 && (
        <section className="pdf-section">
          <h3>Blood culture sets</h3>
          <table className="pdf-compact-table">
            <thead>
              <tr>
                <th>Set</th>
                <th>Draw site</th>
                <th>Lumen / label</th>
                <th>Bottles</th>
                <th>Drawn at</th>
              </tr>
            </thead>
            <tbody>
              {doc.bloodSets.map((set) => (
                <tr key={set.setNo}>
                  <td>#{set.setNo}</td>
                  <td>{formatCode(set.drawSite)}</td>
                  <td>{set.lumenLabel ?? "-"}</td>
                  <td>{set.bottleTypes.length > 0 ? set.bottleTypes.map(formatCode).join(", ") : "-"}</td>
                  <td>{formatDateTime(set.drawTime)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {!isBloodReport && (
        <section className="pdf-section">
          <h3>Microscopy</h3>
          <p>{doc.microscopySummary}</p>
        </section>
      )}

      <section className="pdf-section">
        <h3>Culture and susceptibility</h3>
        {doc.isolates.length === 0 ? (
          <p>No isolates reported.</p>
        ) : (
          doc.isolates.map((isolate) => (
            <div key={isolate.isolateNo} className="pdf-isolate-card">
              <div className="pdf-isolate-heading">
                <div>
                  <span className="pdf-isolate-number">#{isolate.isolateNo}</span>
                  <strong>{isolate.organismDisplay}</strong>
                </div>
                <span>{isolate.significance ?? "indeterminate"}</span>
              </div>
              {isolate.growth && <p className="pdf-muted">Growth: {isolate.growth}</p>}
              {isolate.phenotypeFlags.length > 0 && (
                <p className="pdf-alert">Phenotype: {isolate.phenotypeFlags.join(", ")}</p>
              )}
              {isolate.ast.length > 0 && (
                <table className="pdf-ast-table">
                  <thead>
                    <tr>
                      <th>Antibiotic</th>
                      <th>Result</th>
                      <th>Raw</th>
                      <th>Breakpoint</th>
                      <th>Class</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {isolate.ast.map((row) => (
                      <tr key={`${isolate.isolateNo}-${row.antibioticCode}`}>
                        <td>{row.antibioticDisplay}</td>
                        <td className="pdf-result-cell">{row.visibleToClinician ? row.interpretation ?? "-" : "withheld"}</td>
                        <td>
                          {row.rawValue ?? "-"} {row.rawUnit ?? ""}
                        </td>
                        <td>{row.breakpoint?.summary ?? "-"}</td>
                        <td>{row.releaseClass ?? "-"}{row.aware ? ` / ${row.aware}` : ""}</td>
                        <td>{row.visibleToClinician ? "released" : row.suppressionReason ?? "suppressed"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          ))
        )}
      </section>

      {doc.ipc.length > 0 && (
        <section className="pdf-section">
          <h3>IPC clinician-facing notes</h3>
          <ul className="pdf-list">
            {doc.ipc.map((item, idx) => (
              <li key={`${item.ruleCode}-${idx}`}>
                <strong>{item.ruleCode}</strong>: {item.message}
                {item.actions.length > 0 && <span> Actions: {item.actions.join("; ")}</span>}
              </li>
            ))}
          </ul>
        </section>
      )}

      {doc.comments.length > 0 && (
        <section className="pdf-section">
          <h3>Interpretive comments</h3>
          <ul className="pdf-list">
            {doc.comments.map((comment, idx) => (
              <li key={`${comment.code}-${idx}`}>
                <strong>{COMMENT_LABEL[comment.source]}</strong>: {comment.text}
              </li>
            ))}
          </ul>
        </section>
      )}

      <footer className="pdf-report-footer">
        <span>Rules {doc.versions.rule}</span>
        <span>Breakpoints {doc.versions.breakpoint}</span>
        <span>Export {doc.versions.export}</span>
        <span>Build {doc.versions.build}</span>
        <span>{accession.release.sealHash ? `Seal ${accession.release.sealHash.slice(0, 16)}...` : "Seal not recorded"}</span>
      </footer>
    </article>
  );
}

function InfoBlock({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div className="pdf-info-block">
      <p>{label}</p>
      <strong>{value}</strong>
      {detail && <span>{detail}</span>}
    </div>
  );
}

function PrintStyles() {
  return (
    <style>{`
      @media screen {
        .completed-report-print-pack { display: none; }
      }

      @media print {
        @page { size: A4; margin: 12mm; }
        html, body { background: #ffffff !important; }
        body * { visibility: hidden !important; }
        .completed-report-print-pack, .completed-report-print-pack * { visibility: visible !important; }
        .completed-report-print-pack {
          display: block !important;
          position: absolute;
          inset: 0 auto auto 0;
          width: 100%;
          color: #111827;
          background: #ffffff;
          font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          font-size: 10.5pt;
          line-height: 1.35;
        }
        .pdf-cover-page, .pdf-report-page {
          page-break-after: always;
          break-after: page;
        }
        .pdf-report-page {
          padding: 0;
        }
        .pdf-cover-rule {
          width: 72px;
          height: 6px;
          background: #1d4ed8;
          border-radius: 999px;
          margin-bottom: 18mm;
        }
        .pdf-kicker {
          margin: 0 0 4px;
          color: #1d4ed8;
          font-size: 9pt;
          font-weight: 700;
          letter-spacing: 0.12em;
          text-transform: uppercase;
        }
        .pdf-cover-page h1 {
          margin: 0;
          color: #0f172a;
          font-size: 28pt;
          line-height: 1.05;
        }
        .pdf-cover-meta, .pdf-cover-note, .pdf-muted {
          color: #475569;
        }
        .pdf-cover-note {
          max-width: 155mm;
          margin: 10mm 0;
          font-size: 11pt;
        }
        .pdf-summary-table, .pdf-compact-table, .pdf-ast-table {
          width: 100%;
          border-collapse: collapse;
          page-break-inside: avoid;
        }
        .pdf-summary-table th, .pdf-summary-table td,
        .pdf-compact-table th, .pdf-compact-table td,
        .pdf-ast-table th, .pdf-ast-table td {
          border-bottom: 1px solid #d8dee9;
          padding: 5px 6px;
          text-align: left;
          vertical-align: top;
        }
        .pdf-summary-table th, .pdf-compact-table th, .pdf-ast-table th {
          color: #334155;
          background: #eef4ff;
          font-size: 8.5pt;
          text-transform: uppercase;
          letter-spacing: 0.06em;
        }
        .pdf-report-header {
          display: flex;
          justify-content: space-between;
          gap: 18px;
          border-bottom: 3px solid #1d4ed8;
          padding-bottom: 10px;
          margin-bottom: 12px;
        }
        .pdf-report-header h2 {
          margin: 0;
          color: #0f172a;
          font-size: 19pt;
        }
        .pdf-subtitle {
          margin: 4px 0 0;
          color: #475569;
        }
        .pdf-accession-badge {
          min-width: 42mm;
          border: 1px solid #bfdbfe;
          border-radius: 8px;
          background: #eff6ff;
          padding: 8px 10px;
          text-align: right;
          page-break-inside: avoid;
        }
        .pdf-accession-badge span {
          display: block;
          color: #475569;
          font-size: 8pt;
          text-transform: uppercase;
          letter-spacing: 0.08em;
        }
        .pdf-accession-badge strong {
          display: block;
          color: #0f172a;
          font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
          font-size: 11pt;
        }
        .pdf-demographics-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 8px;
          margin-bottom: 12px;
        }
        .pdf-info-block {
          border: 1px solid #d8dee9;
          border-radius: 8px;
          padding: 7px 8px;
          background: #f8fafc;
          page-break-inside: avoid;
        }
        .pdf-info-block p {
          margin: 0 0 2px;
          color: #64748b;
          font-size: 8pt;
          text-transform: uppercase;
          letter-spacing: 0.06em;
        }
        .pdf-info-block strong, .pdf-info-block span {
          display: block;
        }
        .pdf-info-block span {
          color: #475569;
          font-size: 8.5pt;
          margin-top: 2px;
        }
        .pdf-section {
          margin-top: 10px;
          page-break-inside: avoid;
        }
        .pdf-section h3 {
          margin: 0 0 5px;
          color: #1e3a8a;
          font-size: 11pt;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
        .pdf-section p { margin: 0; }
        .pdf-isolate-card {
          border: 1px solid #d8dee9;
          border-radius: 8px;
          padding: 8px;
          margin: 7px 0;
          page-break-inside: avoid;
        }
        .pdf-isolate-heading {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 4px;
        }
        .pdf-isolate-number {
          color: #64748b;
          font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
          margin-right: 6px;
        }
        .pdf-alert {
          color: #991b1b;
          font-weight: 700;
          margin: 3px 0;
        }
        .pdf-result-cell {
          font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
          font-weight: 700;
        }
        .pdf-list {
          margin: 0;
          padding-left: 18px;
        }
        .pdf-list li { margin-bottom: 4px; }
        .pdf-report-footer {
          display: flex;
          flex-wrap: wrap;
          gap: 8px 14px;
          border-top: 1px solid #d8dee9;
          color: #64748b;
          font-size: 8pt;
          margin-top: 12px;
          padding-top: 7px;
        }
      }
    `}</style>
  );
}
