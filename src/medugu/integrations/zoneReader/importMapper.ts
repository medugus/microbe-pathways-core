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
    return { ok: false, matched: [], unmatched: parsed.results, missing: [], findings };
  }

  // 3. Build matched / unmatched / missing.
  const matched: MatchedRow[] = [];
  const unmatched: ZoneResult[] = [];

  const isolateAst = accession.ast.filter(
    (a) => a.isolateId === parsed.isolateId && a.method === ASTMethod.DiskDiffusion,
  );
  const byCode = new Map(isolateAst.map((a) => [a.antibioticCode, a]));
  const matchedCodes = new Set<string>();

  for (const r of parsed.results) {
    const existing = byCode.get(r.antibioticCode);
    if (!existing) {
      unmatched.push(r);
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
    if (typeof existing.rawValue === "number" && existing.rawValue !== r.zoneDiameterMm) {
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
      astRowId: existing.id,
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

  return { ok: true, matched, unmatched, missing, findings };
}
