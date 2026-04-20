// ASTSection — entry editor linked to active isolates.
// Engine logic stays in logic/astDrafting.ts; expert-rule application is
// performed server-side via applyExpertRulesServer so the browser cannot
// fabricate phenotype flags.

import { useState } from "react";
import { meduguActions, useActiveAccession } from "../../store/useAccessionStore";
import { ANTIBIOTICS, getAntibiotic } from "../../config/antibiotics";
import { PRIMARY_STANDARD, SECONDARY_STANDARD } from "../../config/breakpoints";
import { buildASTResult } from "../../logic/astDrafting";
import { ASTMethod } from "../../domain/enums";
import type { Accession, ASTGovernanceState, ASTStandard } from "../../domain/types";
import { applyExpertRulesServer } from "../../store/engines.functions";
import { supabase } from "@/integrations/supabase/client";
import { approvalStatusForRow, isRestrictedRow } from "../../logic/amsEngine";

const AMS_TONE_AST: Record<string, string> = {
  not_requested: "bg-muted text-muted-foreground",
  pending: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  approved: "bg-primary/15 text-primary",
  denied: "bg-destructive/15 text-destructive",
  expired: "bg-destructive/10 text-destructive",
};

const METHOD_OPTIONS: { code: ASTMethod; label: string }[] = [
  { code: ASTMethod.DiskDiffusion, label: "Disk diffusion (mm)" },
  { code: ASTMethod.MIC_Broth, label: "MIC broth (mg/L)" },
  { code: ASTMethod.MIC_Etest, label: "Etest (mg/L)" },
  { code: ASTMethod.Automated_Vitek, label: "Vitek (mg/L)" },
  { code: ASTMethod.Automated_Phoenix, label: "Phoenix (mg/L)" },
];

const GOVERNANCE_OPTIONS: ASTGovernanceState[] = ["draft", "interpreted", "approved", "released"];

export function ASTSection() {
  const accession = useActiveAccession();
  const [isolateId, setIsolateId] = useState<string>("");
  const [antibioticCode, setAntibioticCode] = useState<string>(ANTIBIOTICS[0].code);
  const [method, setMethod] = useState<ASTMethod>(ASTMethod.DiskDiffusion);
  const [standard, setStandard] = useState<ASTStandard>(PRIMARY_STANDARD);
  const [rawValue, setRawValue] = useState<string>("");
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

  function onAdd() {
    if (!accession || !activeIsolateId) return;
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

  if (isolates.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Add an isolate first — AST entry is bound to a specific isolate.
      </p>
    );
  }

  const rowsByIsolate = isolates.map((iso) => ({
    iso,
    rows: accession.ast.filter((a) => a.isolateId === iso.id),
  }));

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
        <label className="md:col-span-2 text-xs">
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
            className="rounded bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90"
          >
            Add AST row
          </button>
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

      {/* Per-isolate AST tables */}
      {rowsByIsolate.map(({ iso, rows }) => (
        <section key={iso.id} className="rounded-md border border-border bg-card">
          <header className="flex items-center justify-between border-b border-border px-3 py-2">
            <div className="text-xs">
              <span className="font-mono text-muted-foreground">#{iso.isolateNo}</span>{" "}
              <span className="font-medium text-foreground">{iso.organismDisplay}</span>
            </div>
            <span className="text-[10px] text-muted-foreground">{rows.length} row(s)</span>
          </header>
          {rows.length === 0 ? (
            <p className="p-3 text-xs text-muted-foreground">No AST rows yet for this isolate.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-left">Antibiotic</th>
                    <th className="px-3 py-2 text-left">Method</th>
                    <th className="px-3 py-2 text-left">Std</th>
                    <th className="px-3 py-2 text-left">Raw</th>
                    <th className="px-3 py-2 text-left">S/I/R</th>
                    <th className="px-3 py-2 text-left">Governance</th>
                    <th className="px-3 py-2 text-left">Cascade</th>
                    <th className="px-3 py-2 text-left">Phenotype</th>
                    <th className="px-3 py-2 text-right">·</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id} className="border-t border-border">
                      <td className="px-3 py-2">
                        <div className="font-medium text-foreground">
                          {getAntibiotic(r.antibioticCode)?.display ?? r.antibioticCode}
                        </div>
                        <div className="text-[10px] text-muted-foreground">{r.antibioticCode}</div>
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">{r.method}</td>
                      <td className="px-3 py-2 text-muted-foreground">{r.standard}</td>
                      <td className="px-3 py-2 text-foreground">
                        {r.rawValue ?? "—"} {r.rawUnit ?? ""}
                      </td>
                      <td className="px-3 py-2">
                        <select
                          value={r.finalInterpretation ?? ""}
                          onChange={(e) =>
                            meduguActions.updateAST(accession.id, r.id, {
                              finalInterpretation: (e.target.value || undefined) as never,
                            })
                          }
                          className="rounded border border-border bg-background px-1.5 py-1 text-xs"
                        >
                          <option value="">—</option>
                          <option value="S">S</option>
                          <option value="I">I</option>
                          <option value="R">R</option>
                          <option value="SDD">SDD</option>
                          <option value="NS">NS</option>
                          <option value="ND">ND</option>
                        </select>
                      </td>
                      <td className="px-3 py-2">
                        <select
                          value={r.governance}
                          onChange={(e) =>
                            meduguActions.updateAST(accession.id, r.id, {
                              governance: e.target.value as ASTGovernanceState,
                            })
                          }
                          className="rounded border border-border bg-background px-1.5 py-1 text-xs"
                        >
                          {GOVERNANCE_OPTIONS.map((g) => (
                            <option key={g} value={g}>{g}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-3 py-2">
                        <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                          {r.cascadeDecision ?? r.cascade}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        {r.phenotypeFlags && r.phenotypeFlags.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {r.phenotypeFlags.map((f) => (
                              <span key={f} className="rounded bg-destructive/10 px-1.5 py-0.5 text-[10px] text-destructive">
                                {f}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="italic text-muted-foreground/70 text-[10px]">none</span>
                        )}
                        {r.expertRulesFired && r.expertRulesFired.length > 0 && (
                          <div className="mt-0.5 text-[10px] text-muted-foreground">
                            {r.expertRulesFired.map((e) => e.ruleCode).join(", ")}
                          </div>
                        )}
                        {isRestrictedRow(r) && (
                          <div className="mt-0.5">
                            <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${AMS_TONE_AST[approvalStatusForRow(accession, r.id)]}`}>
                              AMS · {approvalStatusForRow(accession, r.id).replace("_", " ")}
                            </span>
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <button
                          type="button"
                          onClick={() => meduguActions.removeAST(accession.id, r.id)}
                          className="rounded border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground hover:bg-muted hover:text-foreground"
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ))}

      <p className="text-[11px] text-muted-foreground">
        Phase 3: phenotype + cascade decisions written by the AST expert engine. Use consultant override on the row to deviate, with reason audited.
      </p>
    </div>
  );
}
