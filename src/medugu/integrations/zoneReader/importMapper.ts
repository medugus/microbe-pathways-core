// Map a parsed + validated Zone Reader import payload onto existing AST rows.
//
// Matching key (per row):
//   (accessionId, isolateId, astPanelId, antibioticCode, method=DiskDiffusion)
//
// The mapper is pure — it returns the planned writes plus findings. The UI
// layer is responsible for actually invoking meduguActions.updateAST(...) for
// each accepted row, so existing breakpoint interpretation, expert rules,
// cascade, AMS, IPC, validation and release continue to run via the standard
// AST setters (no engine is bypassed).

import type { Accession } from "../../domain/types";
import { ASTMethod } from "../../domain/enums";
import {
  zoneReaderResultImportSchema,
} from "./schemas";
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
}

const LOW_CONFIDENCE_THRESHOLD = 0.75;
const IMPLAUSIBLE_LOW_MM = 5;
const IMPLAUSIBLE_HIGH_MM = 50;

export function mapImport(input: MapImportInput): ImportMapResult {
  const { accession, worklist } = input;

  // 1. Structural parse.
  let parsed: ZoneReaderResultImport;
  try {
    const candidate =
      typeof input.payload === "string" ? JSON.parse(input.payload) : input.payload;
    parsed = zoneReaderResultImportSchema.parse(candidate);
  } catch (err) {
    return {
      ok: false,
      matched: [],
      unmatched: [],
      missing: [],
      findings: [
        {
          severity: "blocker",
          code: "SCHEMA_PARSE_FAILED",
          message: err instanceof Error ? err.message : String(err),
        },
      ],
    };
  }

  // 2. Semantic validation.
  const findings: ImportFinding[] = validateImport({
    accession,
    payload: parsed,
    worklist,
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
    if (typeof r.confidence === "number" && r.confidence < LOW_CONFIDENCE_THRESHOLD) {
      reviewReasons.push("low_confidence");
    }
    if (r.zoneMm < IMPLAUSIBLE_LOW_MM || r.zoneMm > IMPLAUSIBLE_HIGH_MM) {
      reviewReasons.push("implausible_zone");
    }
    if (typeof existing.rawValue === "number" && existing.rawValue !== r.zoneMm) {
      reviewReasons.push("overwrite_existing");
    }
    if (r.notes) reviewReasons.push("reader_note");

    matched.push({
      antibioticCode: r.antibioticCode,
      astRowId: existing.id,
      zoneMm: r.zoneMm,
      confidence: r.confidence,
      notes: r.notes,
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
