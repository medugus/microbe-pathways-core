import { useMemo, useRef, useState } from "react";
import type { Accession } from "../../../domain/types";
import { ASTMethod } from "../../../domain/enums";
import { meduguActions } from "../../../store/useAccessionStore";
import { buildWorklistExport } from "../../../integrations/zoneReader/exportWorklist";
import { mapImport } from "../../../integrations/zoneReader/importMapper";
import { emitZoneReaderAudit } from "../../../integrations/zoneReader/auditEvents";
import { getZoneReaderSettings } from "../../../integrations/zoneReader/settings";
import type {
  ImportMapResult,
  ZoneReaderWorklistExport,
} from "../../../integrations/zoneReader/types";
import { Button } from "@/components/ui/button";
import { ZoneReaderImportReviewTable } from "./ZoneReaderImportReviewTable";
import { ZoneReaderFindingsList } from "./ZoneReaderFindingsList";

interface Props {
  accession: Accession;
  isolateId: string;
  astPanelId: string;
}

export function ZoneReaderPanel({ accession, isolateId, astPanelId }: Props) {
  const settings = getZoneReaderSettings();
  const [open, setOpen] = useState(false);
  const [lastWorklist, setLastWorklist] = useState<ZoneReaderWorklistExport | null>(null);
  const [importResult, setImportResult] = useState<ImportMapResult | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const canExport = useMemo(
    () => Boolean(isolateId && astPanelId),
    [isolateId, astPanelId],
  );

  if (!settings.enabled) return null;

  function onExport() {
    try {
      const w = buildWorklistExport({ accession, isolateId, astPanelId });
      setLastWorklist(w);
      const blob = new Blob([JSON.stringify(w, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `zone-reader-worklist-${accession.accessionNumber}-${w.isolateNo}.json`;
      a.click();
      URL.revokeObjectURL(url);
      emitZoneReaderAudit({
        code: "ZONE_READER_WORKLIST_EXPORTED",
        accessionId: accession.id,
        isolateId,
        astPanelId,
        detail: { rowCount: w.expectedDiscs.length },
      });
    } catch (err) {
      setImportError(err instanceof Error ? err.message : String(err));
    }
  }

  async function onImportFile(file: File) {
    setImportError(null);
    try {
      const text = await file.text();
      const result = mapImport({
        accession,
        worklist: lastWorklist ?? undefined,
        payload: text,
      });
      setImportResult(result);
      emitZoneReaderAudit({
        code: result.ok
          ? "ZONE_READER_RESULT_IMPORT_PARSED"
          : "ZONE_READER_RESULT_IMPORT_REJECTED",
        accessionId: accession.id,
        isolateId,
        astPanelId,
        detail: {
          matched: result.matched.length,
          unmatched: result.unmatched.length,
          missing: result.missing.length,
          findings: result.findings.length,
        },
      });
    } catch (err) {
      setImportError(err instanceof Error ? err.message : String(err));
    }
  }

  function acceptRow(antibioticCode: string) {
    if (!importResult) return;
    const row = importResult.matched.find((m) => m.antibioticCode === antibioticCode);
    if (!row) return;
    // Goes through the standard AST setter — interpretation, expert rules,
    // cascade, AMS, IPC, validation and release all run unchanged downstream.
    meduguActions.updateAST(accession.id, row.astRowId, {
      rawValue: row.zoneDiameterMm,
      rawUnit: "mm",
      zoneMm: row.zoneDiameterMm,
      method: ASTMethod.DiskDiffusion,
    });
    emitZoneReaderAudit({
      code: "ZONE_READER_ROW_ACCEPTED",
      accessionId: accession.id,
      isolateId,
      astPanelId,
      antibioticCode,
      detail: { zoneMm: row.zoneDiameterMm, reviewReasons: row.reviewReasons },
    });
    setImportResult({
      ...importResult,
      matched: importResult.matched.filter((m) => m.antibioticCode !== antibioticCode),
    });
  }

  function rejectRow(antibioticCode: string) {
    if (!importResult) return;
    emitZoneReaderAudit({
      code: "ZONE_READER_ROW_REJECTED",
      accessionId: accession.id,
      isolateId,
      astPanelId,
      antibioticCode,
    });
    setImportResult({
      ...importResult,
      matched: importResult.matched.filter((m) => m.antibioticCode !== antibioticCode),
    });
  }

  function acceptAllSafe() {
    if (!importResult) return;
    for (const row of importResult.matched) {
      if (row.requiresReview) continue;
      acceptRow(row.antibioticCode);
    }
  }

  return (
    <div className="rounded-md border border-border bg-background p-3">
      <button
        type="button"
        className="flex w-full items-center justify-between text-left text-sm font-medium"
        onClick={() => setOpen((v) => !v)}
      >
        <span>Zone Reader integration (contract v1)</span>
        <span className="text-xs text-muted-foreground">{open ? "Hide" : "Show"}</span>
      </button>

      {open && (
        <div className="mt-3 space-y-3">
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={onExport} disabled={!canExport}>
              Export worklist JSON
            </Button>
            <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()}>
              Import result JSON
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void onImportFile(f);
                e.target.value = "";
              }}
            />
            {importResult?.matched.length ? (
              <Button size="sm" onClick={acceptAllSafe}>
                Accept all safe rows
              </Button>
            ) : null}
          </div>

          {importError && (
            <p className="text-xs text-destructive">{importError}</p>
          )}

          {importResult && (
            <>
              <ZoneReaderFindingsList findings={importResult.findings} />
              <ZoneReaderImportReviewTable
                matched={importResult.matched}
                unmatched={importResult.unmatched}
                missing={importResult.missing}
                onAccept={acceptRow}
                onReject={rejectRow}
              />
            </>
          )}

          <p className="text-[11px] text-muted-foreground">
            Skeleton only — no live API. Imported zones are written via the
            existing AST setter, so breakpoint interpretation, expert rules,
            cascade, AMS, IPC, validation and release all still run.
          </p>
        </div>
      )}
    </div>
  );
}
