import { ANTIBIOTICS } from "../../config/antibiotics";
import { getInterpretationLabel } from "../../config/breakpoints";
import { meduguActions } from "../../store/useAccessionStore";
import { approvalStatusForRow, isRestrictedRow } from "../../logic/amsEngine";
import type { Accession, ASTGovernanceState } from "../../domain/types";
import { rebuildASTFromRawEdit } from "../../logic/astDrafting";
import { ASTRawValueCell } from "./ASTRawValueCell";

const SIR_TONE: Record<string, string> = {
  S: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
  I: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30",
  SDD: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30",
  R: "bg-destructive/15 text-destructive border-destructive/30",
  NS: "bg-destructive/10 text-destructive border-destructive/20",
  ND: "bg-muted text-muted-foreground border-border",
};

const AMS_TONE_AST: Record<string, string> = {
  not_requested: "chip chip-square chip-neutral",
  pending: "chip chip-square chip-ams-pending",
  approved: "chip chip-square chip-ams-approved",
  denied: "chip chip-square chip-ams-denied",
  expired: "chip chip-square chip-danger",
};

const GOVERNANCE_OPTIONS: ASTGovernanceState[] = ["draft", "interpreted", "approved", "released"];

export function AntibiogramGrid({ accession }: { accession: Accession }) {
  const isolates = accession.isolates;
  const testedCodes = new Set(accession.ast.map((r) => r.antibioticCode));
  const drugs = ANTIBIOTICS.filter((a) => testedCodes.has(a.code));

  if (drugs.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-border bg-card p-6 text-center text-xs text-muted-foreground">
        No AST rows yet. Add an entry above to populate the antibiogram.
      </div>
    );
  }

  const cellLookup = new Map<string, Map<string, typeof accession.ast[number]>>();
  for (const r of accession.ast) {
    let inner = cellLookup.get(r.antibioticCode);
    if (!inner) {
      inner = new Map();
      cellLookup.set(r.antibioticCode, inner);
    }
    inner.set(r.isolateId, r);
  }

  return (
    <div className="overflow-x-auto rounded-md border border-border bg-card">
      <table className="w-full border-collapse text-xs">
        <thead>
          <tr className="border-b border-border bg-muted/40">
            <th className="sticky left-0 z-10 bg-muted/40 px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Antibiotic
            </th>
            {isolates.map((iso) => {
              const isoRows = accession.ast.filter((r) => r.isolateId === iso.id);
              const phenotypes = Array.from(new Set(isoRows.flatMap((r) => r.phenotypeFlags ?? [])));
              return (
                <th
                  key={iso.id}
                  className="min-w-[140px] border-l border-border px-3 py-2 text-left align-top"
                >
                  <div className="text-[10px] font-mono text-muted-foreground">#{iso.isolateNo}</div>
                  <div className="text-xs font-semibold text-foreground">{iso.organismDisplay}</div>
                  {phenotypes.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {phenotypes.map((p) => (
                        <span
                          key={p}
                          className="rounded bg-destructive/10 px-1 py-0.5 text-[9px] font-medium text-destructive"
                        >
                          {p}
                        </span>
                      ))}
                    </div>
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {drugs.map((drug) => (
            <tr key={drug.code} className="border-t border-border">
              <th className="sticky left-0 z-10 bg-card px-3 py-2 text-left align-top">
                <div className="text-xs font-medium text-foreground">{drug.display}</div>
                <div className="text-[10px] text-muted-foreground">{drug.code}</div>
              </th>
              {isolates.map((iso) => {
                const cell = cellLookup.get(drug.code)?.get(iso.id);
                if (!cell) {
                  return (
                    <td
                      key={iso.id}
                      className="border-l border-border px-2 py-2 align-top text-center text-[10px] text-muted-foreground/50"
                    >
                      —
                    </td>
                  );
                }

                const sir = cell.finalInterpretation ?? cell.interpretedSIR ?? "";
                const tone = SIR_TONE[sir] ?? "bg-muted text-muted-foreground border-border";
                const hasNoBreakpoint = cell.rawValue !== undefined && cell.rawInterpretation === undefined;

                return (
                  <td key={iso.id} className="border-l border-border px-2 py-2 align-top">
                    <div className="flex flex-col gap-1">
                      <select
                        value={cell.finalInterpretation ?? ""}
                        onChange={(e) =>
                          meduguActions.updateAST(accession.id, cell.id, {
                            finalInterpretation: (e.target.value || undefined) as never,
                          })
                        }
                        className={`rounded border px-1.5 py-0.5 text-center text-xs font-bold ${tone}`}
                      >
                        <option value="">—</option>
                        <option value="S">S</option>
                        <option value="I">I</option>
                        <option value="SDD">SDD</option>
                        <option value="R">R</option>
                        <option value="NS">NS</option>
                        <option value="ND">ND</option>
                      </select>
                      <ASTRawValueCell
                        value={cell.rawValue}
                        method={cell.method}
                        rawUnit={cell.rawUnit}
                        onRawValueChange={(nextRawValue) =>
                          meduguActions.updateAST(
                            accession.id,
                            cell.id,
                            rebuildASTFromRawEdit(accession, cell, {
                              rawValue: nextRawValue,
                            }),
                          )
                        }
                        onRawUnitChange={(nextRawUnit) =>
                          meduguActions.updateAST(accession.id, cell.id, {
                            rawUnit: nextRawUnit,
                          })
                        }
                      />
                      {hasNoBreakpoint && (
                        <span className="text-center text-[9px] text-amber-700 dark:text-amber-300">
                          No breakpoint (No defined breakpoint)
                        </span>
                      )}
                      {cell.breakpointSpeciesViolation && (
                        <span className="text-center text-[9px] font-semibold text-destructive">
                          ⚠ Restricted to{" "}
                          {(cell.breakpointFlags?.restrictedSpecies ?? []).join(", ")}
                        </span>
                      )}
                      {cell.indicationUsed && cell.indicationUsed !== "general" && !cell.breakpointSpeciesViolation && (
                        <span className="text-center text-[9px] text-muted-foreground">
                          indication: {cell.indicationUsed.replace(/_/g, " ")}
                        </span>
                      )}
                      {cell.breakpointFlags?.bracketed && (
                        <span className="text-center text-[9px] font-semibold text-amber-700 dark:text-amber-300">
                          [bracketed]
                        </span>
                      )}
                      {cell.breakpointFlags?.screeningOnly && (
                        <span className="text-center text-[9px] text-amber-700 dark:text-amber-300">
                          screening only
                        </span>
                      )}
                      {cell.breakpointFlags?.restrictedSpecies?.length === 1 &&
                        cell.breakpointFlags.restrictedSpecies[0] === "ECOL" &&
                        !cell.breakpointSpeciesViolation && (
                          <span className="text-center text-[9px] text-muted-foreground">
                            E. coli only
                          </span>
                        )}
                      {cell.standard === "EUCAST" && ["S", "I", "R"].includes(sir) && (
                        <span className="text-center text-[9px] text-muted-foreground">
                          {sir}: {getInterpretationLabel(cell.standard, sir as "S" | "I" | "R")}
                        </span>
                      )}
                      <div className="flex items-center justify-between gap-1">
                        <select
                          value={cell.governance}
                          onChange={(e) =>
                            meduguActions.updateAST(accession.id, cell.id, {
                              governance: e.target.value as ASTGovernanceState,
                            })
                          }
                          className="flex-1 rounded border border-border bg-background px-1 py-0.5 text-[9px]"
                          title="Governance"
                        >
                          {GOVERNANCE_OPTIONS.map((g) => (
                            <option key={g} value={g}>
                              {g}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={() => meduguActions.removeAST(accession.id, cell.id)}
                          className="rounded border border-border px-1 py-0.5 text-[9px] text-muted-foreground hover:bg-muted hover:text-foreground"
                          title="Remove row"
                        >
                          ✕
                        </button>
                      </div>
                      {isRestrictedRow(cell) && (
                        <span
                          className={`text-center text-[9px] font-semibold ${AMS_TONE_AST[approvalStatusForRow(accession, cell.id)]}`}
                        >
                          AMS · {approvalStatusForRow(accession, cell.id).replace("_", " ")}
                        </span>
                      )}
                      <div className="text-center text-[9px] text-muted-foreground/80">
                        {cell.method} · {cell.standard}
                      </div>
                      {cell.cascadeDecision === "hidden_until_promoted" && !cell.cascadeOverride?.released && (
                        <div className="rounded border border-amber-500/30 bg-amber-500/10 px-1.5 py-1 text-[9px] text-amber-800 dark:text-amber-200">
                          <div className="font-semibold">Suppressed — 1st-line susceptible</div>
                          {cell.cascadeReason && (
                            <div className="mt-0.5 font-normal opacity-90">{cell.cascadeReason}</div>
                          )}
                          <button
                            type="button"
                            onClick={() => {
                              const reason = window.prompt(
                                `Release ${drug.display} on the report anyway?\nDocument the clinical reason (allergy, prior failure, source control, etc.):`,
                              );
                              if (!reason || !reason.trim()) return;
                              meduguActions.updateAST(accession.id, cell.id, {
                                cascadeOverride: {
                                  released: true,
                                  actor: "local",
                                  at: new Date().toISOString(),
                                  reason: reason.trim(),
                                },
                                cascadeDecision: "shown",
                                cascade: "primary",
                              });
                            }}
                            className="mt-1 w-full rounded border border-amber-600/40 bg-amber-500/20 px-1 py-0.5 text-[9px] font-semibold text-amber-900 hover:bg-amber-500/30 dark:text-amber-100"
                          >
                            Release anyway…
                          </button>
                        </div>
                      )}
                      {cell.cascadeOverride?.released && (
                        <div className="rounded border border-primary/30 bg-primary/10 px-1.5 py-1 text-[9px] text-primary">
                          <div className="font-semibold">Cascade overridden — released</div>
                          <div className="mt-0.5 opacity-90">Reason: {cell.cascadeOverride.reason}</div>
                          <button
                            type="button"
                            onClick={() => {
                              meduguActions.updateAST(accession.id, cell.id, {
                                cascadeOverride: undefined,
                              });
                            }}
                            className="mt-1 w-full rounded border border-border px-1 py-0.5 text-[9px] text-muted-foreground hover:bg-muted"
                          >
                            Undo override
                          </button>
                        </div>
                      )}
                      {cell.cascadeDecision === "suppressed_by_phenotype" && (
                        <span className="rounded bg-muted px-1 py-0.5 text-center text-[9px] text-muted-foreground">
                          suppressed by phenotype
                        </span>
                      )}
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
