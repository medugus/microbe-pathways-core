// ASTSection — entry editor linked to active isolates.
// Engine logic stays in logic/astDrafting.ts; expert-rule application is
// performed server-side via applyExpertRulesServer so the browser cannot
// fabricate phenotype flags.

import { useEffect, useMemo, useState } from "react";
import { meduguActions, useActiveAccession } from "../../store/useAccessionStore";
import { ANTIBIOTICS, getASTPanel } from "../../config/antibiotics";
import { PRIMARY_STANDARD } from "../../config/breakpoints";
import { buildASTResult } from "../../logic/astDrafting";
import {
  getDefaultASTPanelForIsolate,
  getEligibleASTPanelsForIsolate,
  isASTPanelEligibleForIsolate,
} from "../../logic/astPanelSelection";
import { ASTMethod } from "../../domain/enums";
import type { Accession, ASTStandard } from "../../domain/types";
import { applyExpertRulesServer } from "../../store/engines.functions";
import { supabase } from "@/integrations/supabase/client";
import { ASTReportabilityBoard } from "./ASTReportabilityBoard";
import { isBloodCulture, listPositiveBottles, sourceLinkKey } from "../../logic/bloodIsolateRules";
import { ASTEntryControls } from "./ASTEntryControls";
import { ASTPanelEntry } from "./ASTPanelEntry";
import { ASTServerActions } from "./ASTServerActions";
import { AntibiogramGrid } from "./AntibiogramGrid";

type EntryMode = "panel" | "single";

function isUnresultedAstRow(row: Accession["ast"][number]): boolean {
  const hasNoRawValues =
    row.rawValue === undefined && row.micMgL === undefined && row.zoneMm === undefined;
  const hasNoInterpretation =
    row.rawInterpretation === undefined &&
    row.interpretedSIR === undefined &&
    row.finalInterpretation === undefined;
  const hasNoComment = !row.comment?.trim();
  return hasNoRawValues && hasNoInterpretation && hasNoComment;
}

export function ASTSection() {
  const accession = useActiveAccession();

  if (!accession) {
    return (
      <div className="rounded-lg border border-border bg-card p-8 text-center text-sm text-muted-foreground">
        No active accession.
      </div>
    );
  }

  return <ASTSectionBody accession={accession} />;
}

function ASTSectionBody({ accession }: { accession: Accession }) {
  const [entryMode, setEntryMode] = useState<EntryMode>("panel");
  const [isolateId, setIsolateId] = useState<string>("");
  const [panelId, setPanelId] = useState<string>("");
  const [antibioticCode, setAntibioticCode] = useState<string>(ANTIBIOTICS[0].code);
  const [method, setMethod] = useState<ASTMethod>(ASTMethod.DiskDiffusion);
  const [standard, setStandard] = useState<ASTStandard>(PRIMARY_STANDARD);
  const [rawValue, setRawValue] = useState<string>("");
  const [panelSummary, setPanelSummary] = useState<string | null>(null);
  const [applying, setApplying] = useState(false);
  const [applyError, setApplyError] = useState<string | null>(null);
  const [appliedSummary, setAppliedSummary] = useState<string | null>(null);

  const isolates = accession.isolates;
  const activeIsolateId = isolateId || isolates[0]?.id || "";
  const selectedIsolate = isolates.find((i) => i.id === activeIsolateId);
  const eligiblePanels = useMemo(
    () => getEligibleASTPanelsForIsolate(accession, selectedIsolate),
    [accession, selectedIsolate],
  );
  const fallbackPanel = useMemo(
    () => getDefaultASTPanelForIsolate(accession, selectedIsolate),
    [accession, selectedIsolate],
  );
  const selectedPanel =
    (panelId ? getASTPanel(panelId) : undefined) ?? fallbackPanel ?? eligiblePanels[0];
  const isSelectedPanelEligible = selectedPanel
    ? isASTPanelEligibleForIsolate(selectedPanel, selectedIsolate, accession)
    : false;

  const bloodPositiveSources = useMemo(() => {
    if (!isBloodCulture(accession)) return new Set<string>();
    return new Set(listPositiveBottles(accession).map((p) => sourceLinkKey(p.setNo, p.bottleType)));
  }, [accession]);

  const selectedIsolateHasPositiveLink = !!selectedIsolate?.bloodSourceLinks?.some((l) =>
    bloodPositiveSources.has(sourceLinkKey(l.setNo, l.bottleType)),
  );

  const isBloodASTBlocked =
    isBloodCulture(accession) && !!selectedIsolate && !selectedIsolateHasPositiveLink;

  useEffect(() => {
    if (!selectedIsolate) return;

    if (!selectedPanel || !isSelectedPanelEligible) {
      const next = fallbackPanel?.id ?? eligiblePanels[0]?.id ?? "";
      if (next && next !== panelId) {
        setPanelId(next);
      }
      return;
    }

    if (!panelId && selectedPanel.id) {
      setPanelId(selectedPanel.id);
    }
  }, [
    eligiblePanels,
    fallbackPanel,
    isSelectedPanelEligible,
    panelId,
    selectedIsolate,
    selectedPanel,
  ]);

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
  const blankAstRowIds = useMemo(
    () => accession.ast.filter((row) => isUnresultedAstRow(row)).map((row) => row.id),
    [accession.ast],
  );

  function onAdd() {
    if (!activeIsolateId || isBloodASTBlocked) return;

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
    if (!activeIsolateId || !selectedPanel || isBloodASTBlocked || !isSelectedPanelEligible) return;

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

  async function applyExpertRules() {
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

  function clearUnresultedRows() {
    if (blankAstRowIds.length === 0) return;
    for (const rowId of blankAstRowIds) {
      meduguActions.removeAST(accession.id, rowId);
    }
    setPanelSummary(`Removed ${blankAstRowIds.length} unresulted placeholder row(s).`);
  }

  if (isolates.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Add an isolate first — AST entry is bound to a specific isolate.
      </p>
    );
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-3 rounded-md border border-border bg-background p-3 md:grid-cols-6">
        <label className="text-xs md:col-span-2">
          <span className="block text-[10px] uppercase tracking-wide text-muted-foreground">
            Entry mode
          </span>
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
          <span className="block text-[10px] uppercase tracking-wide text-muted-foreground">
            Isolate
          </span>
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
          <ASTPanelEntry
            selectedPanelId={selectedPanel?.id ?? ""}
            eligiblePanels={eligiblePanels}
            method={method}
            standard={standard}
            panelPendingCount={panelMeta.pendingCodes.length}
            panelDuplicateCount={panelMeta.duplicateCount}
            selectedPanelCodes={selectedPanel?.codes ?? []}
            selectedPanelMissingRequested={selectedPanel?.missingRequested ?? []}
            panelSummary={panelSummary}
            isBloodASTBlocked={isBloodASTBlocked}
            isPanelEligible={isSelectedPanelEligible}
            onPanelChange={setPanelId}
            onMethodChange={setMethod}
            onStandardChange={setStandard}
            onAddPanel={onAddPanel}
          />
        ) : (
          <ASTEntryControls
            antibioticCode={antibioticCode}
            method={method}
            standard={standard}
            rawValue={rawValue}
            isBloodASTBlocked={isBloodASTBlocked}
            onAntibioticCodeChange={setAntibioticCode}
            onMethodChange={setMethod}
            onStandardChange={setStandard}
            onRawValueChange={setRawValue}
            onAdd={onAdd}
          />
        )}

        <ASTServerActions
          applying={applying}
          applyError={applyError}
          appliedSummary={appliedSummary}
          onApplyExpertRules={applyExpertRules}
        />

        <div className="md:col-span-6 flex flex-wrap items-center gap-2 rounded border border-border bg-card px-2 py-2">
          <button
            type="button"
            onClick={clearUnresultedRows}
            disabled={blankAstRowIds.length === 0}
            className="rounded border border-border px-3 py-1 text-xs hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
          >
            Remove unresulted AST rows
          </button>
          <span className="text-[11px] text-muted-foreground">
            Removes blank placeholders only (no raw value, no MIC/zone, no S/I/R, no
            interpretation/comment).
          </span>
        </div>
      </div>

      <ASTReportabilityBoard accession={accession} />

      <AntibiogramGrid accession={accession} />

      <p className="text-[11px] text-muted-foreground">
        Antibiogram view — antibiotics down, isolates across. S/I/R cells are color-coded with raw
        value below. Click a cell to edit interpretation or governance; phenotype + cascade
        decisions are written by the server expert engine. Use consultant override (per row) to
        deviate, with reason audited.
      </p>
    </div>
  );
}
