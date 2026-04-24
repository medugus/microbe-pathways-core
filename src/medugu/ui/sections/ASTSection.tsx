// ASTSection — entry editor linked to active isolates.
// Engine logic stays in logic/astDrafting.ts; expert-rule application is
// performed server-side via applyExpertRulesServer so the browser cannot
// fabricate phenotype flags.

import { useMemo, useState } from "react";
import { meduguActions, useActiveAccession } from "../../store/useAccessionStore";
import { ANTIBIOTICS, AST_PANELS, getASTPanel, getAntibiotic } from "../../config/antibiotics";
import { PRIMARY_STANDARD, SECONDARY_STANDARD } from "../../config/breakpoints";
import { buildASTResult, rebuildASTFromRawEdit } from "../../logic/astDrafting";
import { ASTMethod } from "../../domain/enums";
import type { Accession, ASTGovernanceState, ASTStandard } from "../../domain/types";
import { applyExpertRulesServer } from "../../store/engines.functions";
import { supabase } from "@/integrations/supabase/client";
import { approvalStatusForRow, isRestrictedRow } from "../../logic/amsEngine";
import { ASTReportabilityBoard } from "./ASTReportabilityBoard";
import { isBloodCulture, listPositiveBottles, sourceLinkKey } from "../../logic/bloodIsolateRules";

const AMS_TONE_AST: Record<string, string> = {
  not_requested: "chip chip-square chip-neutral",
  pending: "chip chip-square chip-ams-pending",
  approved: "chip chip-square chip-ams-approved",
  denied: "chip chip-square chip-ams-denied",
  expired: "chip chip-square chip-danger",
};

const METHOD_OPTIONS: { code: ASTMethod; label: string }[] = [
  { code: ASTMethod.DiskDiffusion, label: "Disk diffusion (mm)" },
  { code: ASTMethod.MIC_Broth, label: "MIC broth (mg/L)" },
  { code: ASTMethod.MIC_Etest, label: "Etest (mg/L)" },
  { code: ASTMethod.Automated_Vitek, label: "Vitek (mg/L)" },
  { code: ASTMethod.Automated_Phoenix, label: "Phoenix (mg/L)" },
];

const GOVERNANCE_OPTIONS: ASTGovernanceState[] = ["draft", "interpreted", "approved", "released"];

type EntryMode = "panel" | "single";

export function ASTSection() {
  const accession = useActiveAccession();
  const [entryMode, setEntryMode] = useState<EntryMode>("panel");
  const [isolateId, setIsolateId] = useState<string>("");
  const [panelId, setPanelId] = useState<string>(AST_PANELS[0]?.id ?? "");
  const [antibioticCode, setAntibioticCode] = useState<string>(ANTIBIOTICS[0].code);
  const [method, setMethod] = useState<ASTMethod>(ASTMethod.DiskDiffusion);
  const [standard, setStandard] = useState<ASTStandard>(PRIMARY_STANDARD);
  const [rawValue, setRawValue] = useState<string>("");
  const [panelSummary, setPanelSummary] = useState<string | null>(null);
  const [applying, setApplying] = useState(false);
  const [applyError, setApplyError] = useState<string | null>(null);
  const [appliedSummary, setAppliedSummary] = useState<string | null>(null);

  if (!accession) {
    return (
      <div className="rounded-lg border border-border bg-card p-8 text-center text-sm text-muted-foreground">
        No active accession.
      </div>
    );
  }

  const isolates = accession.isolates;
  const activeIsolateId = isolateId || isolates[0]?.id || "";
  const selectedPanel = getASTPanel(panelId) ?? AST_PANELS[0];
  const selectedIsolate = isolates.find((i) => i.id === activeIsolateId);
  const bloodPositiveSources = useMemo(() => {
    if (!isBloodCulture(accession)) return new Set<string>();
    return new Set(listPositiveBottles(accession).map((p) => sourceLinkKey(p.setNo, p.bottleType)));
  }, [accession]);
  const selectedIsolateHasPositiveLink =
    !!selectedIsolate?.bloodSourceLinks?.some((l) =>
      bloodPositiveSources.has(sourceLinkKey(l.setNo, l.bottleType)),
    );
  const isBloodASTBlocked = isBloodCulture(accession) && !!selectedIsolate && !selectedIsolateHasPositiveLink;

  const panelMeta = useMemo(() => {
    if (!selectedPanel || !activeIsolateId) {
      return { pendingCodes: [] as string[], duplicateCount: 0 };
    }

    const pendingCodes: string[] = [];
    let duplicateCount = 0;

    for (const code of selectedPanel.codes) {
      const alreadyExists = accession.ast.some(
        (row) => row.isolateId === activeIsolateId && row.antibioticCode === code,
      );
      if (alreadyExists) {
        duplicateCount += 1;
      } else {
        pendingCodes.push(code);
      }
    }

    return { pendingCodes, duplicateCount };
  }, [accession.ast, activeIsolateId, selectedPanel]);

  function onAdd() {
    if (!accession || !activeIsolateId || isBloodASTBlocked) return;
    const v = rawValue.trim() === "" ? undefined : Number(rawValue);
    const row = buildASTResult(accession, {
      isolateId: activeIsolateId,
      antibioticCode,
      method,
      standard,
      rawValue: Number.isFinite(v) ? v : undefined,
    });
    meduguActions.addAST(accession.id, row);
    setRawValue("");
  }

  function onAddPanel() {
    if (!accession || !activeIsolateId || !selectedPanel || isBloodASTBlocked) return;

    let added = 0;
    let duplicates = 0;
    for (const code of selectedPanel.codes) {
      const alreadyExists = accession.ast.some(
        (row) => row.isolateId === activeIsolateId && row.antibioticCode === code,
      );
      if (alreadyExists) {
        duplicates += 1;
        continue;
      }

      const row = buildASTResult(accession, {
        isolateId: activeIsolateId,
        antibioticCode: code,
        method,
        standard,
        rawValue: undefined,
      });
      meduguActions.addAST(accession.id, row);
      added += 1;
    }

    setPanelSummary(`Added ${added} AST rows. Skipped ${duplicates} duplicates.`);
  }

  if (isolates.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Add an isolate first — AST entry is bound to a specific isolate.
      </p>
    );
  }

  async function applyExpertRules() {
    if (!accession) return;
    setApplyError(null);
    setAppliedSummary(null);
    setApplying(true);
    try {
      const { data: row, error } = await supabase
        .from("accessions")
        .select("id")
        .eq("accession_code", accession.accessionNumber)
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!row) throw new Error("Accession not yet synced — try again in a moment.");

      const result = await applyExpertRulesServer({
        data: { accessionRowId: row.id as string },
      });
      if (!result.ok || !result.accessionJson) {
        setApplyError(result.reason ?? "Server rejected expert-rule run.");
        return;
      }
      const next = JSON.parse(result.accessionJson) as Accession;
      meduguActions.upsertAccession(next);
      setAppliedSummary(`Applied — ${result.patched ?? 0} row(s) patched on server.`);
    } catch (err) {
      setApplyError(err instanceof Error ? err.message : String(err));
    } finally {
      setApplying(false);
    }
  }

  return (
    <div className="space-y-5">
      {/* Entry surface */}
      <div className="grid grid-cols-1 gap-3 rounded-md border border-border bg-background p-3 md:grid-cols-6">
        <label className="text-xs md:col-span-2">
          <span className="block text-[10px] uppercase tracking-wide text-muted-foreground">Entry mode</span>
          <select
            value={entryMode}
            onChange={(e) => setEntryMode(e.target.value as EntryMode)}
            className="mt-1 w-full rounded border border-border bg-card px-2 py-1.5 text-sm"
          >
            <option value="panel">Panel</option>
            <option value="single">Single row</option>
          </select>
        </label>

        <label className="text-xs md:col-span-2">
          <span className="block text-[10px] uppercase tracking-wide text-muted-foreground">Isolate</span>
          <select
            value={activeIsolateId}
            onChange={(e) => setIsolateId(e.target.value)}
            className="mt-1 w-full rounded border border-border bg-card px-2 py-1.5 text-sm"
          >
            {isolates.map((i) => (
              <option key={i.id} value={i.id}>
                #{i.isolateNo} {i.organismDisplay}
              </option>
            ))}
          </select>
        </label>

        {entryMode === "panel" ? (
          <>
            <label className="text-xs md:col-span-2">
              <span className="block text-[10px] uppercase tracking-wide text-muted-foreground">Panel</span>
              <select
                value={selectedPanel?.id ?? ""}
                onChange={(e) => setPanelId(e.target.value)}
                className="mt-1 w-full rounded border border-border bg-card px-2 py-1.5 text-sm"
              >
                {AST_PANELS.map((panel) => (
                  <option key={panel.id} value={panel.id}>{panel.label}</option>
                ))}
              </select>
            </label>
            <label className="text-xs">
              <span className="block text-[10px] uppercase tracking-wide text-muted-foreground">Method</span>
              <select
                value={method}
                onChange={(e) => setMethod(e.target.value as ASTMethod)}
                className="mt-1 w-full rounded border border-border bg-card px-2 py-1.5 text-sm"
              >
                {METHOD_OPTIONS.map((m) => (
                  <option key={m.code} value={m.code}>{m.label}</option>
                ))}
              </select>
            </label>
            <label className="text-xs">
              <span className="block text-[10px] uppercase tracking-wide text-muted-foreground">Standard</span>
              <select
                value={standard}
                onChange={(e) => setStandard(e.target.value as ASTStandard)}
                className="mt-1 w-full rounded border border-border bg-card px-2 py-1.5 text-sm"
              >
                <option value={PRIMARY_STANDARD}>{PRIMARY_STANDARD} (primary)</option>
                <option value={SECONDARY_STANDARD}>{SECONDARY_STANDARD} (secondary)</option>
              </select>
            </label>
            <div className="md:col-span-4 flex items-end">
              <button
                type="button"
                onClick={onAddPanel}
                disabled={isBloodASTBlocked}
                className="rounded bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90"
              >
                Add panel
              </button>
              {isBloodASTBlocked && (
                <span className="ml-2 text-[11px] text-destructive">
                  Blood culture AST requires organism linkage to a positive bottle.
                </span>
              )}
            </div>
            <div className="md:col-span-6 rounded border border-border bg-card px-2 py-2 text-[11px] text-muted-foreground">
              <div className="font-medium text-foreground">Panel preview</div>
              <div className="mt-1">
                Will add {panelMeta.pendingCodes.length} row(s); {panelMeta.duplicateCount} duplicate(s) detected for isolate.
              </div>
              <div className="mt-1 flex flex-wrap gap-1">
                {selectedPanel?.codes.map((code) => (
                  <span key={code} className="rounded bg-muted px-1.5 py-0.5 text-[10px]">
                    {getAntibiotic(code)?.display ?? code} ({code})
                  </span>
                ))}
              </div>
              {selectedPanel && selectedPanel.missingRequested.length > 0 && (
                <div className="mt-2">
                  <span className="font-medium text-foreground">Missing requested:</span>{" "}
                  {selectedPanel.missingRequested.join(", ")}
                </div>
              )}
            </div>
            {panelSummary && (
              <p className="md:col-span-6 text-[11px] text-muted-foreground">
                {panelSummary}
              </p>
            )}
          </>
        ) : (
          <>
            <label className="text-xs">
              <span className="block text-[10px] uppercase tracking-wide text-muted-foreground">Antibiotic</span>
              <select
                value={antibioticCode}
                onChange={(e) => setAntibioticCode(e.target.value)}
                className="mt-1 w-full rounded border border-border bg-card px-2 py-1.5 text-sm"
              >
                {ANTIBIOTICS.map((a) => (
                  <option key={a.code} value={a.code}>{a.display} ({a.code})</option>
                ))}
              </select>
            </label>
            <label className="text-xs">
              <span className="block text-[10px] uppercase tracking-wide text-muted-foreground">Method</span>
              <select
                value={method}
                onChange={(e) => setMethod(e.target.value as ASTMethod)}
                className="mt-1 w-full rounded border border-border bg-card px-2 py-1.5 text-sm"
              >
                {METHOD_OPTIONS.map((m) => (
                  <option key={m.code} value={m.code}>{m.label}</option>
                ))}
              </select>
            </label>
            <label className="text-xs">
              <span className="block text-[10px] uppercase tracking-wide text-muted-foreground">Standard</span>
              <select
                value={standard}
                onChange={(e) => setStandard(e.target.value as ASTStandard)}
                className="mt-1 w-full rounded border border-border bg-card px-2 py-1.5 text-sm"
              >
                <option value={PRIMARY_STANDARD}>{PRIMARY_STANDARD} (primary)</option>
                <option value={SECONDARY_STANDARD}>{SECONDARY_STANDARD} (secondary)</option>
              </select>
            </label>
            <label className="text-xs">
              <span className="block text-[10px] uppercase tracking-wide text-muted-foreground">
                Raw value
              </span>
              <input
                value={rawValue}
                onChange={(e) => setRawValue(e.target.value)}
                inputMode="decimal"
                placeholder={method === ASTMethod.DiskDiffusion ? "mm" : "mg/L"}
                className="mt-1 w-full rounded border border-border bg-card px-2 py-1.5 text-sm"
              />
            </label>
            <div className="md:col-span-6 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={onAdd}
                disabled={isBloodASTBlocked}
                className="rounded bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90"
              >
                Add AST row
              </button>
              {isBloodASTBlocked && (
                <span className="text-[11px] text-destructive">
                  Blood culture AST requires organism linkage to a positive bottle.
                </span>
              )}
            </div>
          </>
        )}

        <div className="md:col-span-6 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={applyExpertRules}
            disabled={applying}
            className="rounded border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted disabled:opacity-50"
          >
            {applying ? "Applying on server…" : "Apply expert rules"}
          </button>
          <span className="text-[11px] text-muted-foreground">
            Server re-runs MRSA / ESBL / CRE / VRE / ICR / intrinsic / AmpC inference and writes phenotype + cascade decisions.
          </span>
        </div>
        {applyError && (
          <p className="md:col-span-6 text-[11px] text-destructive">
            Server rejected: {applyError}
          </p>
        )}
        {appliedSummary && (
          <p className="md:col-span-6 text-[11px] text-muted-foreground">
            {appliedSummary}
          </p>
        )}
      </div>

      <ASTReportabilityBoard accession={accession} />

      {/* Antibiogram grid — Epic Beaker style: antibiotics × isolates */}
      <AntibiogramGrid accession={accession} />

      <p className="text-[11px] text-muted-foreground">
        Antibiogram view — antibiotics down, isolates across. S/I/R cells are
        color-coded with raw value below. Click a cell to edit interpretation or
        governance; phenotype + cascade decisions are written by the server expert
        engine. Use consultant override (per row) to deviate, with reason audited.
      </p>
    </div>
  );
}

// ---------------- Antibiogram grid ----------------

const SIR_TONE: Record<string, string> = {
  S: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
  I: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30",
  SDD: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30",
  R: "bg-destructive/15 text-destructive border-destructive/30",
  NS: "bg-destructive/10 text-destructive border-destructive/20",
  ND: "bg-muted text-muted-foreground border-border",
};

function AntibiogramGrid({ accession }: { accession: Accession }) {
  const isolates = accession.isolates;
  // Antibiotics included = union of those tested across isolates, in canonical order.
  const testedCodes = new Set(accession.ast.map((r) => r.antibioticCode));
  const drugs = ANTIBIOTICS.filter((a) => testedCodes.has(a.code));

  if (drugs.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-border bg-card p-6 text-center text-xs text-muted-foreground">
        No AST rows yet. Add an entry above to populate the antibiogram.
      </div>
    );
  }

  // Lookup: drugCode -> isolateId -> ASTResult
  const cellLookup = new Map<string, Map<string, typeof accession.ast[number]>>();
  for (const r of accession.ast) {
    let inner = cellLookup.get(r.antibioticCode);
    if (!inner) {
      inner = new Map();
      cellLookup.set(r.antibioticCode, inner);
    }
    // If multiple rows for same drug+isolate, keep most recently added (last wins).
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
              const phenotypes = Array.from(
                new Set(isoRows.flatMap((r) => r.phenotypeFlags ?? [])),
              );
              return (
                <th
                  key={iso.id}
                  className="min-w-[140px] border-l border-border px-3 py-2 text-left align-top"
                >
                  <div className="text-[10px] font-mono text-muted-foreground">
                    #{iso.isolateNo}
                  </div>
                  <div className="text-xs font-semibold text-foreground">
                    {iso.organismDisplay}
                  </div>
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
                const rawValueInput = cell.rawValue ?? "";
                const effectiveUnit = cell.method === ASTMethod.DiskDiffusion ? "mm" : "mg/L";
                const hasNoBreakpoint = cell.rawValue !== undefined && cell.rawInterpretation === undefined;
                return (
                  <td
                    key={iso.id}
                    className="border-l border-border px-2 py-2 align-top"
                  >
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
                      <div className="grid grid-cols-[1fr_auto] gap-1">
                        <input
                          type="number"
                          step="any"
                          value={rawValueInput}
                          onChange={(e) => {
                            const nextRawValue =
                              e.target.value.trim() === "" ? undefined : Number(e.target.value);
                            meduguActions.updateAST(
                              accession.id,
                              cell.id,
                              rebuildASTFromRawEdit(accession, cell, {
                                rawValue: Number.isFinite(nextRawValue) ? nextRawValue : undefined,
                              }),
                            );
                          }}
                          placeholder={effectiveUnit}
                          className="w-full rounded border border-border bg-background px-1.5 py-0.5 text-[10px]"
                          title="Raw AST value"
                        />
                        <select
                          value={cell.rawUnit ?? effectiveUnit}
                          onChange={(e) =>
                            meduguActions.updateAST(accession.id, cell.id, {
                              rawUnit: e.target.value as "mm" | "mg/L",
                            })
                          }
                          className="rounded border border-border bg-background px-1 py-0.5 text-[10px]"
                        >
                          <option value={effectiveUnit}>{effectiveUnit}</option>
                        </select>
                      </div>
                      {hasNoBreakpoint && (
                        <span className="text-center text-[9px] text-amber-700 dark:text-amber-300">
                          No breakpoint
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
                      {cell.cascadeDecision && cell.cascadeDecision !== "shown" && (
                        <span className="rounded bg-muted px-1 py-0.5 text-center text-[9px] text-muted-foreground">
                          {cell.cascadeDecision}
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
