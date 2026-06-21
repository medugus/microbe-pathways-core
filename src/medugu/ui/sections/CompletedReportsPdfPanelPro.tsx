import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { ReleaseState } from "../../domain/enums";
import type { Accession } from "../../domain/types";
import {
  buildReportPreview,
  type CommentSource,
  type ReportPreviewDoc,
} from "../../logic/reportPreview";
import {
  buildConsultantMicrobiologistComments,
  consultantSignOffLabel,
} from "../../logic/consultantComments";
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

interface ReportTotals {
  completed: number;
  frozen: number;
  amended: number;
  isolates: number;
  astRows: number;
  ipcNotes: number;
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
  return { doc: buildReportPreview(accession), sourceLabel: "Released live projection" };
}

function releasedAt(accession: Accession): string {
  return (
    accession.release.releasedAt ??
    accession.releasedAt ??
    accession.updatedAt ??
    accession.createdAt
  );
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

function totalsFor(reports: PrintableReport[]): ReportTotals {
  return reports.reduce<ReportTotals>(
    (totals, report) => {
      totals.completed += 1;
      if (report.accession.releasePackage?.body) totals.frozen += 1;
      if (report.accession.release.state === ReleaseState.Amended) totals.amended += 1;
      totals.isolates += report.doc.isolates.length;
      totals.astRows += report.doc.isolates.reduce((sum, isolate) => sum + isolate.ast.length, 0);
      totals.ipcNotes += report.doc.ipc.length;
      return totals;
    },
    { completed: 0, frozen: 0, amended: 0, isolates: 0, astRows: 0, ipcNotes: 0 },
  );
}

interface CompletedReportsPdfPanelProps {
  accessions?: Accession[];
  title?: string;
  description?: string;
  emptyMessage?: string;
  buttonLabel?: string;
}

export function CompletedReportsPdfPanel({
  accessions,
  title = "Completed reports PDF pack",
  description = "Produces a styled A4 microbiology report bundle for every completed report currently loaded in the LIMS. Frozen release packages are preferred when present, with live released projections clearly labelled.",
  emptyMessage = "No completed reports are currently loaded. Release one or more reports first, then return here to print the PDF pack.",
  buttonLabel = "Print / save PDF",
}: CompletedReportsPdfPanelProps = {}) {
  const state = useMeduguState();
  const generatedAt = useMemo(() => new Date().toISOString(), []);
  const sourceAccessions = accessions ?? Object.values(state.accessions);
  const reports = useMemo<PrintableReport[]>(() => {
    return sourceAccessions
      .filter(isCompletedReport)
      .map((accession) => {
        const { doc, sourceLabel } = sourceDoc(accession);
        return { accession, doc, sourceLabel, releasedAt: releasedAt(accession) };
      })
      .sort((a, b) => b.releasedAt.localeCompare(a.releasedAt));
  }, [sourceAccessions]);
  const totals = useMemo(() => totalsFor(reports), [reports]);

  return (
    <section className="overflow-hidden rounded-xl border border-blue-200 bg-gradient-to-br from-blue-50 via-card to-slate-50 p-4 dark:border-blue-900/60 dark:from-blue-950/30 dark:via-card dark:to-slate-950">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-blue-700 dark:text-blue-300">
            Formal output
          </p>
          <h4 className="mt-1 text-sm font-semibold text-foreground">{title}</h4>
          <p className="mt-1 max-w-3xl text-xs text-muted-foreground">{description}</p>
        </div>
        <button
          type="button"
          onClick={printCompletedReports}
          disabled={reports.length === 0}
          className="rounded bg-blue-700 px-3 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {buttonLabel}
        </button>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-6">
        <PdfMetric label="Reports" value={totals.completed} />
        <PdfMetric label="Frozen" value={totals.frozen} />
        <PdfMetric label="Amended" value={totals.amended} />
        <PdfMetric label="Isolates" value={totals.isolates} />
        <PdfMetric label="AST rows" value={totals.astRows} />
        <PdfMetric label="IPC notes" value={totals.ipcNotes} />
      </div>

      {reports.length === 0 ? (
        <p className="mt-3 rounded border border-dashed border-blue-200 bg-background/80 p-3 text-xs text-muted-foreground dark:border-blue-900/60">
          {emptyMessage}
        </p>
      ) : (
        <div className="mt-3 rounded-lg border border-blue-100 bg-background/90 p-3 dark:border-blue-900/60">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                Included reports
              </div>
              <p className="text-[11px] text-muted-foreground">
                Generated {formatDateTime(generatedAt)}
              </p>
            </div>
            <span className="rounded-full bg-blue-100 px-2 py-1 text-[10px] font-medium text-blue-800 dark:bg-blue-950 dark:text-blue-200">
              Hospital-ready print layout
            </span>
          </div>
          <ul className="mt-3 grid grid-cols-1 gap-2 lg:grid-cols-2">
            {reports.map(({ accession, doc, sourceLabel, releasedAt }) => (
              <li
                key={accession.id}
                className="rounded border border-border bg-card px-2 py-1.5 text-xs"
              >
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

      <PrintableReportPortal reports={reports} totals={totals} generatedAt={generatedAt} />
      <PrintStyles />
    </section>
  );
}

function PdfMetric({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-lg border border-blue-100 bg-background/90 p-2 dark:border-blue-900/60">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 text-sm font-semibold text-foreground">{value}</div>
    </div>
  );
}

function PrintableReportBook({
  reports,
  totals,
  generatedAt,
}: {
  reports: PrintableReport[];
  totals: ReportTotals;
  generatedAt: string;
}) {
  const includeCover = reports.length > 1;

  return (
    <div className="medugu-report-print-book" aria-hidden="true">
      {includeCover && (
        <section className="pdf-cover-page">
          <div className="pdf-brand-row">
            <div>
              <p className="pdf-kicker">Medugu Clinical Microbiology LIMS</p>
              <h1>Completed Culture Reports</h1>
            </div>
            <div className="pdf-cover-badge">Controlled Copy</div>
          </div>
          <p className="pdf-cover-meta">Generated {formatDateTime(generatedAt)}</p>
          <p className="pdf-cover-note">
            This document contains completed microbiology reports from the active LIMS workspace.
            Report bodies are rendered from frozen release packages when available; otherwise they
            are labelled as released live projections.
          </p>
          <div className="pdf-cover-metrics">
            <CoverMetric label="Reports" value={totals.completed} />
            <CoverMetric label="Frozen packages" value={totals.frozen} />
            <CoverMetric label="Amended" value={totals.amended} />
            <CoverMetric label="Isolates" value={totals.isolates} />
            <CoverMetric label="AST rows" value={totals.astRows} />
            <CoverMetric label="IPC notes" value={totals.ipcNotes} />
          </div>
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
      )}

      {reports.map((report, index) => (
        <ClinicalReportPage key={report.accession.id} report={report} ordinal={index + 1} />
      ))}
    </div>
  );
}

function PrintableReportPortal({
  reports,
  totals,
  generatedAt,
}: {
  reports: PrintableReport[];
  totals: ReportTotals;
  generatedAt: string;
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted || typeof document === "undefined") return null;

  return createPortal(
    <PrintableReportBook reports={reports} totals={totals} generatedAt={generatedAt} />,
    document.body,
  );
}

function CoverMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="pdf-cover-metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function ClinicalReportPage({ report, ordinal }: { report: PrintableReport; ordinal: number }) {
  const { accession, doc, sourceLabel, releasedAt } = report;
  const isBloodReport = !!(doc.bloodSets?.length || doc.bloodBottles?.length);
  const consultantComments = buildConsultantMicrobiologistComments(doc);
  return (
    <article className="pdf-report-page">
      <header className="pdf-report-header">
        <div>
          <p className="pdf-kicker">Microbiology report {ordinal}</p>
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
        <InfoBlock
          label="Patient"
          value={doc.patient.name}
          detail={`MRN ${doc.patient.mrn} - ${doc.patient.sex}`}
        />
        <InfoBlock label="Ward / unit" value={doc.patient.ward ?? "Not recorded"} />
        <InfoBlock
          label="Specimen pathway"
          value={doc.specimen.pathway}
          detail={doc.specimen.syndrome}
        />
        <InfoBlock
          label="Released"
          value={formatDateTime(releasedAt)}
          detail={`Rendered ${formatDateTime(doc.generatedAt)}`}
        />
      </section>

      {doc.bloodSets && doc.bloodSets.length > 0 && (
        <section className="pdf-section">
          <h3>Blood Culture Sets</h3>
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
                  <td>
                    {set.bottleTypes.length > 0 ? set.bottleTypes.map(formatCode).join(", ") : "-"}
                  </td>
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
        <h3>Culture And Susceptibility</h3>
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
                      <th>Governance</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {isolate.ast.map((row) => (
                      <tr key={`${isolate.isolateNo}-${row.antibioticCode}`}>
                        <td>{row.antibioticDisplay}</td>
                        <td className="pdf-result-cell">
                          {row.visibleToClinician ? (row.interpretation ?? "-") : "withheld"}
                        </td>
                        <td>
                          {row.rawValue ?? "-"} {row.rawUnit ?? ""}
                        </td>
                        <td>{row.breakpoint?.summary ?? "-"}</td>
                        <td>
                          {row.governance}
                          {row.releaseClass ? ` / ${row.releaseClass}` : ""}
                        </td>
                        <td>
                          {row.visibleToClinician
                            ? "released"
                            : (row.suppressionReason ?? "suppressed")}
                        </td>
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
        <section className="pdf-section pdf-highlight-section">
          <h3>IPC Notes</h3>
          <ul className="pdf-list">
            {doc.ipc.map((item, index) => (
              <li key={`${item.ruleCode}-${index}`}>
                <strong>{item.ruleCode}</strong>: {item.message}
                {item.actions.length > 0 && <span> Actions: {item.actions.join("; ")}</span>}
              </li>
            ))}
          </ul>
        </section>
      )}

      {doc.comments.length > 0 && (
        <section className="pdf-section">
          <h3>Interpretive Comments</h3>
          <ul className="pdf-list">
            {doc.comments.map((comment, index) => (
              <li key={`${comment.code}-${index}`}>
                <strong>{COMMENT_LABEL[comment.source]}</strong>: {comment.text}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="pdf-section pdf-consultant-section">
        <h3>Consultant Microbiologist Comment</h3>
        <ul className="pdf-list">
          {consultantComments.map((comment, index) => (
            <li key={`${doc.accessionNumber}-consultant-${index}`}>{comment}</li>
          ))}
        </ul>
        <div className="pdf-signoff-box">
          <strong>{consultantSignOffLabel(accession)}</strong>
          {accession.release.consultantApproval?.reason && (
            <span>Reason/note: {accession.release.consultantApproval.reason}</span>
          )}
        </div>
      </section>

      <footer className="pdf-report-footer">
        <span>Rules {doc.versions.rule}</span>
        <span>Breakpoints {doc.versions.breakpoint}</span>
        <span>Export {doc.versions.export}</span>
        <span>Build {doc.versions.build}</span>
        <span>
          {accession.release.sealHash
            ? `Seal ${accession.release.sealHash.slice(0, 16)}...`
            : "Seal not recorded"}
        </span>
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
        .medugu-report-print-book { display: none; }
      }

      @media print {
        @page { size: A4; margin: 10mm; }
        html, body { background: #ffffff !important; }
        body > :not(.medugu-report-print-book):not(script):not(style) {
          display: none !important;
        }
        .medugu-report-print-book {
          display: block !important;
          position: static !important;
          width: auto;
          min-height: 0;
          color: #111827;
          background: #ffffff;
          font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          font-size: 9pt;
          line-height: 1.28;
        }
        .pdf-cover-page {
          break-after: page;
          page-break-after: always;
        }
        .pdf-report-page {
          break-after: auto;
          page-break-after: auto;
        }
        .pdf-report-page:not(:last-child) {
          break-after: page;
          page-break-after: always;
        }
        .pdf-brand-row, .pdf-report-header, .pdf-isolate-heading, .pdf-report-footer {
          display: flex;
          justify-content: space-between;
          gap: 16px;
        }
        .pdf-cover-page {
          border-top: 8px solid #1d4ed8;
          padding-top: 8mm;
        }
        .pdf-kicker {
          margin: 0 0 4px;
          color: #1d4ed8;
          font-size: 8.5pt;
          font-weight: 800;
          letter-spacing: 0.14em;
          text-transform: uppercase;
        }
        .pdf-cover-page h1 {
          margin: 0;
          color: #0f172a;
          font-size: 30pt;
          line-height: 1.05;
        }
        .pdf-cover-badge, .pdf-accession-badge {
          border: 1px solid #bfdbfe;
          border-radius: 10px;
          background: #eff6ff;
          color: #1e3a8a;
          font-weight: 800;
          padding: 8px 10px;
          text-align: right;
        }
        .pdf-cover-meta, .pdf-cover-note, .pdf-muted {
          color: #475569;
        }
        .pdf-cover-note {
          max-width: 160mm;
          margin: 6mm 0;
          font-size: 10pt;
        }
        .pdf-cover-metrics {
          display: grid;
          grid-template-columns: repeat(6, 1fr);
          gap: 6px;
          margin-bottom: 7mm;
        }
        .pdf-cover-metric, .pdf-info-block {
          border: 1px solid #d8dee9;
          border-radius: 8px;
          background: #f8fafc;
          padding: 5px 6px;
          page-break-inside: avoid;
          break-inside: avoid;
        }
        .pdf-cover-metric span, .pdf-info-block p, .pdf-accession-badge span {
          display: block;
          margin: 0 0 2px;
          color: #64748b;
          font-size: 7.8pt;
          text-transform: uppercase;
          letter-spacing: 0.06em;
        }
        .pdf-cover-metric strong, .pdf-info-block strong, .pdf-accession-badge strong {
          display: block;
          color: #0f172a;
          font-size: 10.5pt;
        }
        .pdf-summary-table, .pdf-compact-table, .pdf-ast-table {
          width: 100%;
          border-collapse: collapse;
        }
        .pdf-summary-table th, .pdf-summary-table td,
        .pdf-compact-table th, .pdf-compact-table td,
        .pdf-ast-table th, .pdf-ast-table td {
          border-bottom: 1px solid #d8dee9;
          padding: 3px 5px;
          text-align: left;
          vertical-align: top;
        }
        .pdf-summary-table th, .pdf-compact-table th, .pdf-ast-table th {
          color: #334155;
          background: #eef4ff;
          font-size: 8pt;
          text-transform: uppercase;
          letter-spacing: 0.06em;
        }
        .pdf-report-header {
          border-bottom: 3px solid #1d4ed8;
          padding-bottom: 7px;
          margin-bottom: 8px;
        }
        .pdf-report-header h2 {
          margin: 0;
          color: #0f172a;
          font-size: 15pt;
        }
        .pdf-subtitle {
          margin: 4px 0 0;
          color: #475569;
        }
        .pdf-accession-badge {
          min-width: 42mm;
        }
        .pdf-accession-badge strong {
          font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
          font-size: 11pt;
        }
        .pdf-demographics-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 6px;
          margin-bottom: 8px;
        }
        .pdf-info-block span {
          display: block;
          color: #475569;
          font-size: 8.4pt;
          margin-top: 2px;
        }
        .pdf-section {
          margin-top: 7px;
          page-break-inside: avoid;
          break-inside: avoid;
        }
        .pdf-section h3 {
          margin: 0 0 4px;
          color: #1e3a8a;
          font-size: 9.5pt;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
        .pdf-section p { margin: 0; }
        .pdf-highlight-section {
          border-left: 4px solid #1d4ed8;
          padding-left: 8px;
        }
        .pdf-isolate-card {
          border: 1px solid #d8dee9;
          border-radius: 8px;
          padding: 5px 6px;
          margin: 5px 0;
          page-break-inside: avoid;
          break-inside: avoid;
        }
        .pdf-isolate-number {
          color: #64748b;
          font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
          margin-right: 6px;
        }
        .pdf-alert {
          color: #991b1b;
          font-weight: 800;
          margin: 3px 0;
        }
        .pdf-result-cell {
          font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
          font-weight: 800;
        }
        .pdf-list {
          margin: 0;
          padding-left: 15px;
        }
        .pdf-list li { margin-bottom: 2px; }
        .pdf-consultant-section {
          border: 1px solid #bfdbfe;
          border-left: 5px solid #1d4ed8;
          border-radius: 8px;
          background: #f8fbff;
          padding: 7px 8px;
        }
        .pdf-signoff-box {
          display: flex;
          flex-direction: column;
          gap: 2px;
          margin-top: 7px;
          border-top: 1px solid #bfdbfe;
          padding-top: 5px;
          color: #0f172a;
        }
        .pdf-signoff-box span {
          color: #475569;
          font-size: 8pt;
        }
        .pdf-report-footer {
          flex-wrap: wrap;
          border-top: 1px solid #d8dee9;
          color: #64748b;
          font-size: 7.8pt;
          margin-top: 8px;
          padding-top: 5px;
        }
      }
    `}</style>
  );
}
