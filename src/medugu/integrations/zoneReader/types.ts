// Zone Reader integration — contract v1 (skeleton, no live API).
//
// MEDUGU LIMS owns the round-trip key:
//   (accessionId, isolateId, astPanelId, antibioticCode)
//
// Export = worklist a Zone Reader device/app should measure.
// Import = zone results (mm) returned by the reader for those same rows.
//
// Imported zones are written to the existing AST rows via the standard
// setters, so all downstream engines (interpretation, expert rules, cascade,
// AMS, IPC, validation, release) run unchanged.

export const ZONE_READER_CONTRACT_VERSION = "1.0.0" as const;
export const ZONE_READER_SOURCE_SYSTEM = "MEDUGU_LIMS" as const;

export type ZoneReaderMethod = "disk_diffusion";

export type ImportFindingSeverity = "info" | "warning" | "blocker";

export interface ExpectedDisc {
  /** Antibiotic code as used by MEDUGU (matches ASTResult.antibioticCode). */
  antibioticCode: string;
  /** Disc content label, e.g. "30 µg" — informational, not used as a match key. */
  discContent?: string;
  /** Plate hint to help the reader operator (informational only). */
  plateHint?: string;
}

export interface ZoneReaderWorklistExport {
  /** Schema version for the export envelope. */
  contractVersion: typeof ZONE_READER_CONTRACT_VERSION;
  sourceSystem: typeof ZONE_READER_SOURCE_SYSTEM;
  /** ISO timestamp the worklist was generated. */
  generatedAt: string;
  /** Round-trip identity. */
  accessionId: string;
  accessionNumber: string;
  isolateId: string;
  isolateNo: number;
  organismDisplay?: string;
  /** Selected AST panel — used in the round-trip key for matching. */
  astPanelId: string;
  astPanelLabel: string;
  method: ZoneReaderMethod;
  /** Discs the reader should measure for this isolate. */
  expectedDiscs: ExpectedDisc[];
}

export interface ZoneResult {
  /** Antibiotic code (round-trip key segment). */
  antibioticCode: string;
  /** Measured zone diameter, mm. Whole or 1 decimal. */
  zoneMm: number;
  /** Optional reader confidence 0–1; used to mark low-confidence rows for review. */
  confidence?: number;
  /** Reader-side notes (e.g. "double zone", "swarming"). */
  notes?: string;
  /** Optional reader instrument / image reference. */
  imageRef?: string;
}

export interface ZoneReaderResultImport {
  contractVersion: typeof ZONE_READER_CONTRACT_VERSION;
  sourceSystem: string; // any reader vendor id
  /** ISO timestamp the reader produced this result set. */
  measuredAt: string;
  /** Round-trip identity — must match an existing worklist export. */
  accessionId: string;
  accessionNumber?: string;
  isolateId: string;
  astPanelId: string;
  method: ZoneReaderMethod;
  results: ZoneResult[];
  /** Optional reader operator + device identifiers (audit only). */
  operator?: string;
  device?: string;
}

export interface ImportFinding {
  severity: ImportFindingSeverity;
  code: string;
  message: string;
  /** Optional row anchor — antibioticCode if the finding targets one row. */
  antibioticCode?: string;
}

export interface MatchedRow {
  antibioticCode: string;
  /** Existing AST row id to update. */
  astRowId: string;
  zoneMm: number;
  confidence?: number;
  notes?: string;
  /** Whether this row needs human review before being written. */
  requiresReview: boolean;
  reviewReasons: string[];
}

export interface ImportMapResult {
  ok: boolean;
  matched: MatchedRow[];
  /** Reader rows that did not match any pending AST row. */
  unmatched: ZoneResult[];
  /** Worklist rows present on the panel but missing from the reader payload. */
  missing: string[]; // antibioticCodes
  findings: ImportFinding[];
}
