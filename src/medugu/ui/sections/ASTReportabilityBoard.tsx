import type { Accession, ASTResult, AMSApprovalStatus } from "../../domain/types";
import { getAntibiotic } from "../../config/antibiotics";
import { approvalStatusForRow, isRestrictedRow } from "../../logic/amsEngine";

const AMS_TONE: Record<AMSApprovalStatus, string> = {
  not_requested: "chip chip-square chip-neutral",
  pending: "chip chip-square chip-ams-pending",
  approved: "chip chip-square chip-ams-approved",
  denied: "chip chip-square chip-ams-denied",
  expired: "chip chip-square chip-danger",
};

function normalize(value: string | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

function hasPhenotypeFlags(row: ASTResult): boolean {
  return Array.isArray(row.phenotypeFlags) && row.phenotypeFlags.length > 0;
}

type Visibility = "Suppressed" | "Needs approval" | "Lab-only" | "Will report" | "Unknown";

function evaluateVisibility(row: ASTResult): { visibility: Visibility; explanation: string } {
  const governance = normalize(row.governance);
  const cascadeDecision = normalize(row.cascadeDecision);

  const cascadeSuppresses =
    cascadeDecision.includes("suppress") ||
    cascadeDecision.includes("withheld") ||
    cascadeDecision.includes("hidden");

  if (cascadeSuppresses) {
    return {
      visibility: "Suppressed",
      explanation: "Suppressed by cascade",
    };
  }

  if (governance.includes("approval required") || governance === "approval_required") {
    return {
      visibility: "Needs approval",
      explanation: "Approval required before release",
    };
  }

  if (governance === "lab-only" || governance === "lab_only") {
    return {
      visibility: "Lab-only",
      explanation: "Lab-only result",
    };
  }

  const reportableGovernance = new Set([
    "reportable",
    "report",
    "interpreted",
    "approved",
    "released",
  ]);
  if (reportableGovernance.has(governance)) {
    return {
      visibility: "Will report",
      explanation: "Reportable",
    };
  }

  return {
    visibility: "Unknown",
    explanation: "No rule reason available",
  };
}

export function ASTReportabilityBoard({ accession }: { accession: Accession }) {
  if (accession.ast.length === 0) {
    return (
      <section className="rounded-md border border-dashed border-border bg-card p-4 text-xs text-muted-foreground">
        No AST rows yet. Reportability board will populate after AST entries are added.
      </section>
    );
  }

  const isolateById = new Map(accession.isolates.map((iso) => [iso.id, iso]));

  const evaluatedRows = accession.ast.map((row) => {
    const visibilityEval = evaluateVisibility(row);
    const restricted = isRestrictedRow(row);
    const phenotypePresent = hasPhenotypeFlags(row);
    const explanationExtras: string[] = [];

    if (restricted) explanationExtras.push("Restricted antimicrobial");
    if (phenotypePresent) explanationExtras.push("Phenotype flag present");

    return {
      row,
      restricted,
      phenotypePresent,
      visibility: visibilityEval.visibility,
      explanation:
        explanationExtras.length > 0
          ? `${visibilityEval.explanation}; ${explanationExtras.join("; ")}`
          : visibilityEval.explanation,
      amsStatus: restricted ? approvalStatusForRow(accession, row.id) : null,
    };
  });

  const summary = {
    reportable: evaluatedRows.filter((r) => r.visibility === "Will report").length,
    suppressed: evaluatedRows.filter((r) => r.visibility === "Suppressed").length,
    labOnly: evaluatedRows.filter((r) => r.visibility === "Lab-only").length,
    approvalRequired: evaluatedRows.filter((r) => r.visibility === "Needs approval").length,
    restricted: evaluatedRows.filter((r) => r.restricted).length,
    phenotypeFlags: evaluatedRows.filter((r) => r.phenotypePresent).length,
    missingGovernance: evaluatedRows.filter((r) => normalize(r.row.governance) === "").length,
  };

  return (
    <section className="space-y-3 rounded-md border border-border bg-card p-3">
      <header>
        <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          AST reportability and rule explanation board
        </h4>
      </header>

      <div className="flex flex-wrap gap-1.5 text-[10px]">
        <span className="chip chip-square chip-success">Reportable · {summary.reportable}</span>
        <span className="chip chip-square chip-withheld">Suppressed · {summary.suppressed}</span>
        <span className="chip chip-square chip-neutral">Lab-only · {summary.labOnly}</span>
        <span className="chip chip-square chip-ams-pending">Approval required · {summary.approvalRequired}</span>
        <span className="chip chip-square chip-restricted">Restricted/AMS review · {summary.restricted}</span>
        <span className="chip chip-square chip-danger">Phenotype flags · {summary.phenotypeFlags}</span>
        <span className="chip chip-square chip-warning">Missing governance · {summary.missingGovernance}</span>
      </div>

      <div className="overflow-x-auto">
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
              const rawValue = row.rawValue !== undefined ? `${row.rawValue}${row.rawUnit ? ` ${row.rawUnit}` : ""}` : "—";
              const flags = row.phenotypeFlags?.length ? row.phenotypeFlags.join(", ") : "—";
              return (
                <tr key={row.id} className="border-t border-border align-top">
                  <td className="px-2 py-2">
                    <div className="font-mono text-[10px] text-muted-foreground">#{isolate?.isolateNo ?? "—"}</div>
                    <div className="text-foreground">{isolate?.organismDisplay ?? row.isolateId}</div>
                  </td>
                  <td className="px-2 py-2">
                    <div className="text-foreground">{antibiotic?.display ?? row.antibioticCode}</div>
                    <div className="text-[10px] text-muted-foreground">{row.antibioticCode}</div>
                  </td>
                  <td className="px-2 py-2 text-muted-foreground">{rawValue}</td>
                  <td className="px-2 py-2">{sir}</td>
                  <td className="px-2 py-2">{row.governance || "—"}</td>
                  <td className="px-2 py-2">{row.cascadeDecision ?? "—"}</td>
                  <td className="px-2 py-2">
                    {restricted && amsStatus ? (
                      <span className={AMS_TONE[amsStatus]}>AMS · {amsStatus.replace("_", " ")}</span>
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
    </section>
  );
}
