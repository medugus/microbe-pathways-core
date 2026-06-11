import { useEffect, useMemo, useRef, useState } from "react";
import type { Accession, ASTStandard } from "../../../domain/types";
import { ASTMethod } from "../../../domain/enums";
import { meduguActions } from "../../../store/useAccessionStore";
import { buildWorklistExport } from "../../../integrations/zoneReader/exportWorklist";
import { mapImport } from "../../../integrations/zoneReader/importMapper";
import { emitZoneReaderAudit } from "../../../integrations/zoneReader/auditEvents";
import { getZoneReaderSettings } from "../../../integrations/zoneReader/settings";
import { buildASTResult } from "../../../logic/astDrafting";
import { PRIMARY_STANDARD } from "../../../config/breakpoints";
import { zoneReaderInboundConfig } from "../../../store/zoneReaderInboundConfig";
import type {
  ImportMapResult,
  UnmatchedAlignment,
  ZoneReaderWorklistExport,
} from "../../../integrations/zoneReader/types";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ZoneReaderImportReviewTable } from "./ZoneReaderImportReviewTable";
import { ZoneReaderFindingsList } from "./ZoneReaderFindingsList";

interface Props {
  accession: Accession;
  isolateId: string;
  astPanelId: string;
}

const HELPER_TEXT =
  "Use this section to export a worklist for the standalone Zone Reader app, then import or paste the returned Zone Result JSON. This is a manual file-based workflow. No live device connection is active.";

export function ZoneReaderPanel({ accession, isolateId, astPanelId }: Props) {
  const settings = getZoneReaderSettings();
  const [lastWorklist, setLastWorklist] = useState<ZoneReaderWorklistExport | null>(null);
  const [importResult, setImportResult] = useState<ImportMapResult | null>(null);
  const [lastPayload, setLastPayload] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [pasted, setPasted] = useState("");
  const fileRef = useRef<HTMLInputElement | null>(null);

  // Subscribe to inbound-config changes so the Launch button reflects admin
  // edits to the Zone Reader app URL without a page reload.
  const [, force] = useState(0);
  useEffect(
    () => zoneReaderInboundConfig.subscribe(() => force((n) => n + 1)),
    [],
  );
  const appUrl = zoneReaderInboundConfig.getAppUrl();
  const appUrlOnPreview = zoneReaderInboundConfig.isAppUrlOnPreviewHost();

  function launchZoneReader() {
    if (!appUrl) return;
    window.open(appUrl, "_blank", "noopener,noreferrer");
  }


  const canExport = useMemo(
    () => Boolean(isolateId && astPanelId),
    [isolateId, astPanelId],
  );

  if (!settings.enabled) return null;

  function runMap(payload: string, source: "file" | "paste" | "rerun") {
    setImportError(null);
    try {
      const result = mapImport({
        accession,
        worklist: lastWorklist ?? undefined,
        payload,
      });
      setImportResult(result);
      setLastPayload(payload);
      emitZoneReaderAudit({
        code: result.ok
          ? "ZONE_READER_RESULT_IMPORT_PARSED"
          : "ZONE_READER_RESULT_IMPORT_REJECTED",
        accessionId: accession.id,
        isolateId,
        astPanelId,
        detail: {
          source,
          matched: result.matched.length,
          unmatched: result.unmatched.length,
          missing: result.missing.length,
          findings: result.findings.length,
          alignmentMissing: result.alignment.filter((a) => a.reason === "MISSING_AST_ROW").length,
          alignmentMethodMismatch: result.alignment.filter((a) => a.reason === "METHOD_MISMATCH").length,
        },
      });
    } catch (err) {
      setImportError(err instanceof Error ? err.message : String(err));
    }
  }

  function createMissingDiskRows(alignment: UnmatchedAlignment[]) {
    const standard: ASTStandard =
      ((alignment.find((a) => a.expectedStandard)?.expectedStandard ?? lastWorklist?.standard) as
        | ASTStandard
        | null
        | undefined) ?? PRIMARY_STANDARD;
    const codes = alignment
      .filter((a) => a.reason === "MISSING_AST_ROW")
      .map((a) => a.antibioticCode);
    let added = 0;
    for (const code of codes) {
      const row = buildASTResult(accession, {
        isolateId,
        antibioticCode: code,
        method: ASTMethod.DiskDiffusion,
        standard,
        rawValue: undefined,
      });
      meduguActions.addAST(accession.id, row);
      added += 1;
    }
    emitZoneReaderAudit({
      code: "ZONE_READER_MISSING_ROWS_CREATED",
      accessionId: accession.id,
      isolateId,
      astPanelId,
      detail: { added, standard, codes },
    });
    // Re-run the mapper against the freshly-augmented accession so the UI
    // reflects the new matches without forcing the user to re-paste.
    if (lastPayload) runMap(lastPayload, "rerun");
  }

  function onExport() {
    try {
      const envelope = buildWorklistExport({ accession, isolateId, astPanelId });
      setLastWorklist(envelope);
      const blob = new Blob([JSON.stringify(envelope, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `zone-reader-worklist-${accession.accessionNumber}-${isolateId}.json`;
      a.click();
      URL.revokeObjectURL(url);
      emitZoneReaderAudit({
        code: "ZONE_READER_WORKLIST_EXPORTED",
        accessionId: accession.id,
        isolateId,
        astPanelId,
        detail: { rowCount: envelope.expectedDiscs.length },
      });
    } catch (err) {
      setImportError(err instanceof Error ? err.message : String(err));
    }
  }

  async function onImportFile(file: File) {
    try {
      const text = await file.text();
      runMap(text, "file");
    } catch (err) {
      setImportError(err instanceof Error ? err.message : String(err));
    }
  }

  function onParsePaste() {
    if (!pasted.trim()) {
      setImportError("Paste Zone Result JSON before parsing.");
      return;
    }
    runMap(pasted, "paste");
  }

  function acceptRow(antibioticCode: string) {
    if (!importResult) return;
    const row = importResult.matched.find((m) => m.antibioticCode === antibioticCode);
    if (!row) return;
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
    <Card className="border-primary/30">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="text-sm font-extrabold uppercase tracking-wide">
              Zone Reader manual integration
            </CardTitle>
            <p className="text-xs text-muted-foreground">{HELPER_TEXT}</p>
          </div>
          {appUrl && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={launchZoneReader}
              title="Opens the Zone Reader app in a new tab"
            >
              Launch Zone Reader ↗
            </Button>
          )}
        </div>
        {appUrl && appUrlOnPreview && (
          <p
            role="alert"
            className="mt-2 rounded-md border border-destructive/40 bg-destructive/10 px-2 py-1 text-[11px] text-destructive"
          >
            Configured Zone Reader URL looks like a preview host — measurements
            from a preview deployment must not be used for live ZoneResult send.
          </p>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2 rounded-md border border-border bg-background p-3">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              1. Export worklist
            </h4>
            <p className="text-xs text-muted-foreground">
              Download a Worklist JSON for the selected isolate + AST panel and load it into the standalone Zone Reader app.
            </p>
            <Button size="sm" variant="outline" onClick={onExport} disabled={!canExport}>
              Export worklist JSON
            </Button>
            {!canExport && (
              <p className="text-[11px] text-muted-foreground">
                Pick an isolate and AST panel above to enable export.
              </p>
            )}
          </div>

          <div className="space-y-2 rounded-md border border-border bg-background p-3">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              2. Import Zone Result JSON
            </h4>
            <p className="text-xs text-muted-foreground">
              Either upload the file Zone Reader exported, or paste its JSON below.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()}>
                Import result JSON from file
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
            </div>
            <Textarea
              value={pasted}
              onChange={(e) => setPasted(e.target.value)}
              placeholder='Paste Zone Result JSON here, e.g. { "isolateId": "...", "results": [...] }'
              className="min-h-[120px] font-mono text-xs"
            />
            <div className="flex gap-2">
              <Button size="sm" onClick={onParsePaste} disabled={!pasted.trim()}>
                Parse pasted result JSON
              </Button>
              {pasted && (
                <Button size="sm" variant="ghost" onClick={() => setPasted("")}>
                  Clear
                </Button>
              )}
            </div>
          </div>
        </div>

        {importError && <p className="text-xs text-destructive">{importError}</p>}

        {importResult && (
          <div className="space-y-3 rounded-md border border-border bg-background p-3">
            <div className="flex items-center justify-between gap-2">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                3. Review and accept rows
              </h4>
              {importResult.matched.some((m) => !m.requiresReview) && (
                <Button size="sm" onClick={acceptAllSafe}>
                  Accept all safe rows
                </Button>
              )}
            </div>

            <AlignmentSummary
              alignment={importResult.alignment}
              onCreateMissing={() => createMissingDiskRows(importResult.alignment)}
            />

            <ZoneReaderFindingsList findings={importResult.findings} />
            <ZoneReaderImportReviewTable
              matched={importResult.matched}
              unmatched={importResult.unmatched}
              missing={importResult.missing}
              onAccept={acceptRow}
              onReject={rejectRow}
            />
            <p className="text-[11px] text-muted-foreground">
              Strict row matching by (isolateId, antibioticCode, method=disk_diffusion, standard). MIC rows are never auto-converted. Accepted rows only write the raw zone diameter through the standard AST setter — interpretation, expert rules, cascade, AMS, IPC, validation and release all run downstream unchanged.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function AlignmentSummary({
  alignment,
  onCreateMissing,
}: {
  alignment: UnmatchedAlignment[];
  onCreateMissing: () => void;
}) {
  if (alignment.length === 0) return null;
  const missing = alignment.filter((a) => a.reason === "MISSING_AST_ROW");
  const methodMismatch = alignment.filter((a) => a.reason === "METHOD_MISMATCH");
  const standardMismatch = alignment.filter((a) => a.reason === "STANDARD_MISMATCH");
  const expectedStandard = alignment.find((a) => a.expectedStandard)?.expectedStandard;

  return (
    <div className="space-y-2 rounded-md border border-amber-500/40 bg-amber-50/40 p-3 text-xs">
      <p className="font-semibold uppercase tracking-wide text-amber-700">
        Pre-import row alignment
      </p>
      {missing.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-amber-800">
            Missing AST rows for {missing.map((m) => m.antibioticCode).join(", ")} under
            disk_diffusion{expectedStandard ? ` / ${expectedStandard}` : ""}.
          </span>
          <Button size="sm" variant="outline" onClick={onCreateMissing}>
            Create {missing.length} disk-diffusion row{missing.length === 1 ? "" : "s"}
          </Button>
        </div>
      )}
      {methodMismatch.map((m) => (
        <p key={`mm-${m.antibioticCode}`} className="text-amber-800">
          {m.antibioticCode} row exists but method mismatch: {m.existingMethod} vs disk_diffusion. MIC rows are not auto-converted.
        </p>
      ))}
      {standardMismatch.map((m) => (
        <p key={`sm-${m.antibioticCode}`} className="text-amber-800">
          {m.antibioticCode} disk-diffusion row uses standard {m.existingStandard}, expected {m.expectedStandard}.
        </p>
      ))}
    </div>
  );
}
