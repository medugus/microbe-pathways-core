import { useState } from "react";

import type { Accession, AMSApprovalStatus } from "../../domain/types";
import { getAntibiotic } from "../../config/antibiotics";
import { approvalStatusForRow } from "../../logic/amsEngine";
import { evaluateASTReportability } from "../../logic/reportability";

const AMS_TONE: Record<AMSApprovalStatus, string> = {
  not_requested: "chip chip-square chip-neutral",
  pending: "chip chip-square chip-ams-pending",
  approved: "chip chip-square chip-ams-approved",
  denied: "chip chip-square chip-ams-denied",
  expired: "chip chip-square chip-danger",
};

export function ASTReportabilityBoard({ accession }: { accession: Accession }) {
  const [open, setOpen] = useState(false);

  if (accession.ast.length === 0) {
    return (
      <section className="rounded-md border border-dashed border-border bg-card p-4 text-xs text-muted-foreground">
        No AST rows yet. Reportability board will populate after AST entries are added.
      </section>
    );
  }

  const isolateById = new Map(accession.isolates.map((iso) => [iso.id, iso]));

  const evaluatedRows = accession.ast.map((row) => {
    const reportability = evaluateASTReportability(row, accession);
    const isRestricted = reportability.isRestricted;

    return {
      row,
      restricted: isRestricted,
      phenotypePresent: reportability.hasPhenotypeFlags,
      visibility: reportability.clinicianVisibility,
      explanation: reportability.explanation,
      amsStatus: isRestricted ? approvalStatusForRow(accession, row.id) : null,
      missingGovernance: reportability.missingGovernance,
    };
  });

  const summary = {
    reportable: evaluatedRows.filter((r) => r.visibility === "Will report").length,
    suppressed: evaluatedRows.filter((r) => r.visibility === "Suppressed").length,
    labOnly: evaluatedRows.filter((r) => r.visibility === "Lab-only").length,
    approvalRequired: evaluatedRows.filter((r) => r.visibility === "Needs approval").length,
    restricted: evaluatedRows.filter((r) => r.restricted).length,
    phenotypeFlags: evaluatedRows.filter((r) => r.phenotypePresent).length,
    missingGovernance: evaluatedRows.filter((r) => r.missingGovernance).length,
  };

  return (
    <section className="space-y-3 rounded-md border border-border bg-card p-3">
      <header>
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          className="flex w-full items-start justify-between gap-3 rounded px-1 py-1 text-left hover:bg-muted/60"
        >
          <span className="flex min-w-0 items-start gap-2">
            <span className="mt-0.5 font-mono text-xs text-muted-foreground">
              {open ? "v" : ">"}
            </span>
            <span className="min-w-0">
              <span className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                AST reportability and rule explanation board
              </span>
              <span className="mt-0.5 block text-[11px] normal-case tracking-normal text-muted-foreground">
                {open
                  ? "Full rule table visible. Click again to collapse."
                  : "Detailed rule explanations are hidden to keep the workspace compact."}
              </span>
            </span>
          </span>
          <span className="shrink-0 rounded border border-border px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
            {open ? "Hide" : "Open"}
          </span>
        </button>
      </header>

      <div className="flex flex-wrap gap-1.5 text-[10px]">
        <span className="chip chip-square chip-success">Reportable · {summary.reportable}</span>
        <span className="chip chip-square chip-withheld">Suppressed · {summary.suppressed}</span>
        <span className="chip chip-square chip-neutral">Lab-only · {summary.labOnly}</span>
        <span className="chip chip-square chip-ams-pending">
          Approval required · {summary.approvalRequired}
        </span>
        <span className="chip chip-square chip-restricted">
          Restricted/AMS review · {summary.restricted}
        </span>
        <span className="chip chip-square chip-danger">
          Phenotype flags · {summary.phenotypeFlags}
        </span>
        <span className="chip chip-square chip-warning">
          Missing governance · {summary.missingGovernance}
        </span>
      </div>

      {open && (
        <div className="overflow-x-auto border-t border-border pt-2">
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-[10px] uppercase tracking-wide text-muted-foreground">
                <th className="px-2 py-2 text-left">Isolate</th>
                <th className="px-2 py-2 text-left">Antimicrobial</th>
                <th className="px-2 py-2 text-left">Raw value</th>
                <th className="px-2 py-2 text-left">S/I/R</th>
                <th className="px-2 py-2 text-left">Governance state</th>
                <th className="px-2 py-2 text-left">Cascade/reportability outcome</th>
                <th className="px-2 py-2 text-left">AMS/restricted status</th>
                <th className="px-2 py-2 text-left">Phenotype flags</th>
                <th className="px-2 py-2 text-left">Clinician visibility</th>
                <th className="px-2 py-2 text-left">Explanation</th>
              </tr>
            </thead>
            <tbody>
              {evaluatedRows.map(({ row, visibility, explanation, restricted, amsStatus }) => {
                const isolate = isolateById.get(row.isolateId);
                const antibiotic = getAntibiotic(row.antibioticCode);
                const sir = row.finalInterpretation ?? row.interpretedSIR ?? "—";
                const rawValue =
                  row.rawValue !== undefined
                    ? `${row.rawValue}${row.rawUnit ? ` ${row.rawUnit}` : ""}`
                    : "—";
                const flags = row.phenotypeFlags?.length ? row.phenotypeFlags.join(", ") : "—";
                return (
                  <tr key={row.id} className="border-t border-border align-top">
                    <td className="px-2 py-2">
                      <div className="font-mono text-[10px] text-muted-foreground">
                        #{isolate?.isolateNo ?? "—"}
                      </div>
                      <div className="text-foreground">
                        {isolate?.organismDisplay ?? row.isolateId}
                      </div>
                    </td>
                    <td className="px-2 py-2">
                      <div className="text-foreground">
                        {antibiotic?.display ?? row.antibioticCode}
                      </div>
                      <div className="text-[10px] text-muted-foreground">{row.antibioticCode}</div>
                    </td>
                    <td className="px-2 py-2 text-muted-foreground">{rawValue}</td>
                    <td className="px-2 py-2">{sir}</td>
                    <td className="px-2 py-2">{row.governance || "—"}</td>
                    <td className="px-2 py-2">{row.cascadeDecision ?? "—"}</td>
                    <td className="px-2 py-2">
                      {restricted && amsStatus ? (
                        <span className={AMS_TONE[amsStatus]}>
                          AMS · {amsStatus.replace("_", " ")}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">unrestricted</span>
                      )}
                    </td>
                    <td className="px-2 py-2 text-muted-foreground">{flags}</td>
                    <td className="px-2 py-2">{visibility}</td>
                    <td className="px-2 py-2 text-muted-foreground">{explanation}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
