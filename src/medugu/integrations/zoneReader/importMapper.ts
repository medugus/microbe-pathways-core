// Map a parsed + validated Zone Reader import payload onto existing AST rows.
//
// Matching key (per row):
//   (accessionId, isolateId, astPanelId, antibioticCode, method=DiskDiffusion)
//
// The mapper is pure — it returns the planned writes plus findings. The UI
// layer is responsible for actually invoking meduguActions.updateAST(...) for
// each accepted row, so existing breakpoint interpretation, expert rules,
// cascade, AMS, IPC, validation and release continue to run via the standard
// AST setters (no engine is bypassed). Risky rows (any reviewReason) cannot
// be auto-accepted in the UI; the user must explicitly accept them.

import type { Accession } from "../../domain/types";
import { ASTMethod } from "../../domain/enums";
import { zoneReaderResultImportSchema } from "./schemas";
import { validateImport, hasBlockers } from "./validateImport";
import type {
  ImportFinding,
  ImportMapResult,
  MatchedRow,
  UnmatchedAlignment,
  ZoneReaderResultImport,
  ZoneReaderWorklistExport,
  ZoneResult,
} from "./types";

export interface MapImportInput {
  accession: Accession;
  /** Either parsed object or raw JSON string from the reader. */
  payload: unknown;
  worklist?: ZoneReaderWorklistExport;
  requireImageReference?: boolean;
}

const LOW_CONFIDENCE_THRESHOLD = 0.75;
const IMPLAUSIBLE_LOW_MM = 6;
const IMPLAUSIBLE_HIGH_MM = 50;

export function mapImport(input: MapImportInput): ImportMapResult {
  const { accession, worklist, requireImageReference } = input;

  // 1. Structural parse + alias normalisation.
  let parsed: ZoneReaderResultImport;
  try {
    const candidate =
      typeof input.payload === "string" ? JSON.parse(input.payload) : input.payload;
    parsed = zoneReaderResultImportSchema.parse(candidate);
  } catch (err) {
    const findings: ImportFinding[] = [];
    // Zod errors → one finding per issue, with a friendly hint when the
    // failure is the manualEdited/override-audit conditional rule.
    const issues = (err as { issues?: Array<{ path: (string | number)[]; message: string }> })
      .issues;
    if (Array.isArray(issues) && issues.length > 0) {
      for (const issue of issues) {
        const path = issue.path.join(".");
        const isAuditField =
          /^(originalValue|correctedValue|overrideReason|reviewedBy|reviewedAt)$/.test(
            String(issue.path[issue.path.length - 1] ?? ""),
          );
        findings.push({
          severity: "blocker",
          code: isAuditField ? "MANUAL_EDIT_AUDIT_INCOMPLETE" : "SCHEMA_PARSE_FAILED",
          message: `${path || "(root)"}: ${issue.message}`,
        });
      }
      findings.push({
        severity: "info",
        code: "SCHEMA_RULE_HINT",
        message:
          "Rule: when manualEdited=false (or absent), originalValue / correctedValue / overrideReason / reviewedBy / reviewedAt may be null or omitted. When manualEdited=true, all five MUST be present and non-null.",
      });
    } else {
      findings.push({
        severity: "blocker",
        code: "SCHEMA_PARSE_FAILED",
        message: err instanceof Error ? err.message : String(err),
      });
    }
    return { ok: false, matched: [], unmatched: [], alignment: [], missing: [], findings };
  }

  // 2. Semantic validation.
  const findings: ImportFinding[] = validateImport({
    accession,
    payload: parsed,
    worklist,
    requireImageReference,
  });

  if (hasBlockers(findings)) {
    return {
      ok: false,
      matched: [],
      unmatched: parsed.results,
      alignment: [],
      missing: [],
      findings,
    };
  }

  // 3. Build matched / unmatched / missing using STRICT row matching by
  //    (isolateId, antibioticCode, method=disk_diffusion, standard).
  //
  //    Standard is taken from the worklist when supplied; otherwise we use
  //    the standard already declared by any disk-diffusion AST row on this
  //    isolate (the lab is operating under one standard at a time). MIC rows
  //    are NEVER auto-converted into disk-diffusion rows.
  const matched: MatchedRow[] = [];
  const unmatched: ZoneResult[] = [];
  const alignment: UnmatchedAlignment[] = [];

  const isolateAllAst = accession.ast.filter((a) => a.isolateId === parsed.isolateId);
  const isolateDiskAst = isolateAllAst.filter((a) => a.method === ASTMethod.DiskDiffusion);

  const expectedStandard: string | undefined =
    (worklist?.standard ?? undefined) ?? (isolateDiskAst[0]?.standard ?? undefined);

  const diskByCode = new Map(isolateDiskAst.map((a) => [a.antibioticCode, a]));
  const anyByCode = new Map(isolateAllAst.map((a) => [a.antibioticCode, a]));
  const matchedCodes = new Set<string>();

  for (const r of parsed.results) {
    const disk = diskByCode.get(r.antibioticCode);
    if (!disk) {
      // Either no row at all, or only a non-disk row exists → method mismatch.
      const other = anyByCode.get(r.antibioticCode);
      unmatched.push(r);
      if (other && other.method !== ASTMethod.DiskDiffusion) {
        alignment.push({
          antibioticCode: r.antibioticCode,
          reason: "METHOD_MISMATCH",
          existingMethod: other.method,
          expectedStandard,
        });
        findings.push({
          severity: "warning",
          code: "METHOD_MISMATCH",
          antibioticCode: r.antibioticCode,
          message: `${r.antibioticCode} row exists but method mismatch: ${other.method} vs disk_diffusion. MIC rows are not auto-converted — add a disk-diffusion row to accept this reader value.`,
        });
      } else {
        alignment.push({
          antibioticCode: r.antibioticCode,
          reason: "MISSING_AST_ROW",
          expectedStandard,
        });
        findings.push({
          severity: "warning",
          code: "MISSING_AST_ROW",
          antibioticCode: r.antibioticCode,
          message: `Missing AST row for ${r.antibioticCode} under disk_diffusion${expectedStandard ? ` / ${expectedStandard}` : ""}.`,
        });
      }
      continue;
    }

    // Disk-diffusion row exists — enforce standard alignment when known.
    if (expectedStandard && disk.standard && disk.standard !== expectedStandard) {
      unmatched.push(r);
      alignment.push({
        antibioticCode: r.antibioticCode,
        reason: "STANDARD_MISMATCH",
        existingStandard: disk.standard,
        expectedStandard,
      });
      findings.push({
        severity: "warning",
        code: "STANDARD_MISMATCH",
        antibioticCode: r.antibioticCode,
        message: `${r.antibioticCode} disk-diffusion row uses standard ${disk.standard}, expected ${expectedStandard}.`,
      });
      continue;
    }

    matchedCodes.add(r.antibioticCode);

    const reviewReasons: string[] = [];
    if (typeof r.confidenceNumeric === "number" && r.confidenceNumeric < LOW_CONFIDENCE_THRESHOLD) {
      reviewReasons.push("low_confidence");
    } else if (r.readerConfidence === "low") {
      reviewReasons.push("low_confidence");
    }
    if (r.zoneDiameterMm < IMPLAUSIBLE_LOW_MM || r.zoneDiameterMm > IMPLAUSIBLE_HIGH_MM) {
      reviewReasons.push("implausible_zone");
    }
    if (typeof disk.rawValue === "number" && disk.rawValue !== r.zoneDiameterMm) {
      reviewReasons.push("overwrite_existing");
    }
    if (r.notes) reviewReasons.push("reader_note");
    if (r.manualEdited && !r.overrideReason) reviewReasons.push("manual_edit_without_reason");
    if (r.manualEdited) reviewReasons.push("manual_edit");
    if (requireImageReference && !r.imageReference && !r.imageUrl) {
      reviewReasons.push("missing_image_reference");
    }

    matched.push({
      antibioticCode: r.antibioticCode,
      astRowId: disk.id,
      zoneDiameterMm: r.zoneDiameterMm,
      readerConfidence: r.readerConfidence,
      confidenceNumeric: r.confidenceNumeric,
      notes: r.notes,
      imageReference: r.imageReference ?? r.imageUrl,
      manualEdited: r.manualEdited,
      overrideReason: r.overrideReason,
      requiresReview: reviewReasons.length > 0,
      reviewReasons,
    });
  }

  // 4. Worklist rows missing from reader payload.
  const missing: string[] = [];
  if (worklist) {
    for (const d of worklist.expectedDiscs) {
      if (!matchedCodes.has(d.antibioticCode)) missing.push(d.antibioticCode);
    }
  }

  return { ok: true, matched, unmatched, alignment, missing, findings };
}
