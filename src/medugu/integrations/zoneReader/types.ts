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
//
// LIMS REMAINS THE AUTHORITY for S/I/R interpretation, expert rules, AMS,
// IPC, validation and release. The Zone Reader provides raw zone diameters
// only; it never decides the categorical result or the report content.

export const ZONE_READER_CONTRACT_VERSION = "1.0.0" as const;
export const ZONE_READER_SOURCE_SYSTEM = "MEDUGU_LIMS" as const;

export type ZoneReaderMethod = "disk_diffusion";

export type ImportFindingSeverity = "info" | "warning" | "blocker";

/** Breakpoint standard the lab is operating under for this isolate. */
export type ZoneReaderStandard = "EUCAST" | "CLSI" | "LOCAL";

/** Reader confidence as a coarse band (alias for numeric 0–1 confidence). */
export type ReaderConfidenceBand = "high" | "medium" | "low" | "manual";

/**
 * Source of the zone measurement actually written.
 *
 * Canonical enum (v1):
 *   - "auto_reader"        — value came directly from the Zone Reader, untouched.
 *   - "manual_entry"       — value typed in by a human, no reader value at all.
 *   - "reader_then_manual" — reader produced a value that a human then edited.
 *   - "imported"           — value came from another upstream system / payload.
 *
 * Older v1.0 aliases still accepted on import (and normalised away):
 *   - "reader" → "auto_reader"
 *   - "manual" → "manual_entry"
 */
export type MeasurementSource =
  | "auto_reader"
  | "manual_entry"
  | "reader_then_manual"
  | "imported";

/** Aliases accepted on import; never written internally. */
export type MeasurementSourceAlias = "reader" | "manual";

/** Per-row review lifecycle in the import review table. */
export type ImportReviewStatus = "pending" | "accepted" | "rejected" | "overridden";

export interface ExpectedDisc {
  /** Antibiotic code as used by MEDUGU (matches ASTResult.antibioticCode). */
  antibioticCode: string;
  /** Human-readable antibiotic name (nullable — not all panels carry it). */
  antibioticName?: string | null;
  /**
   * Disc potency, e.g. "30 µg". Always a string in the exported payload —
   * empty string when unknown — because the Zone Reader importer rejects
   * `null` here.
   */
  discPotency: string;
  /** Antibiotic class (penicillin, carbapenem, etc.) when known. */
  antibioticClass?: string | null;
  /** WHO AWaRe category (Access / Watch / Reserve) when configured. */
  awareCategory?: "Access" | "Watch" | "Reserve" | null;
  /** Default reportability for this drug on this panel (nullable). */
  reportabilityDefault?: "report" | "suppress" | "conditional" | null;
  /** Plate hint to help the reader operator (informational only). */
  plateHint?: string | null;
  /** @deprecated use discPotency. Kept for v1.0 backward compat. */
  discContent?: string | null;
}

/**
 * Inner worklist body. The Zone Reader importer expects this wrapped inside
 * a {@link ZoneReaderWorklistEnvelope}.
 */
export interface ZoneReaderWorklistExport {
  /** Schema version for the export envelope. */
  contractVersion: typeof ZONE_READER_CONTRACT_VERSION;
  sourceSystem: typeof ZONE_READER_SOURCE_SYSTEM;
  /** ISO timestamp the worklist was generated. */
  generatedAt: string;

  // ---- Round-trip identity ----
  accessionId: string;
  accessionNumber: string;
  isolateId: string;
  isolateNo: number;

  // ---- Patient context (nullable — depends on what the LIMS holds) ----
  patientDisplayId?: string | null;
  patientName?: string | null;
  ward?: string | null;

  // ---- Specimen context ----
  specimenType?: string | null;
  specimenCode?: string | null;

  // ---- Organism context ----
  organismName?: string | null;
  organismCode?: string | null;
  /**
   * Organism group. Always a string in the exported payload — empty string
   * when unknown — because the Zone Reader importer rejects `null` here.
   */
  organismGroup: string;
  /** @deprecated use organismName. */
  organismDisplay?: string;

  // ---- AST panel context ----
  astPanelId: string;
  astPanelLabel: string;
  /** Same as astPanelLabel; provided as the alias the Zone Reader app expects. */
  astPanelName?: string;
  /** Breakpoint standard in force for this isolate. */
  standard?: ZoneReaderStandard | null;

  method: ZoneReaderMethod;
  /** Discs the reader should measure for this isolate. */
  expectedDiscs: ExpectedDisc[];
}

/**
 * Top-level envelope written to the Zone Reader Worklist JSON file. The
 * Zone Reader importer requires `schemaVersion`, `createdAt`, and a
 * `worklist` wrapper at the top level.
 */
export interface ZoneReaderWorklistEnvelope {
  schemaVersion: typeof ZONE_READER_CONTRACT_VERSION;
  createdAt: string;
  worklist: ZoneReaderWorklistExport;
}

/**
 * Canonical (normalised) representation of a single zone result.
 *
 * The import schema accepts a wider set of aliases (zoneMm vs zoneDiameterMm,
 * numeric confidence vs coarse band, device vs readerDeviceId, etc.) and
 * reduces them to this shape before validation/mapping.
 */
export interface ZoneResult {
  antibioticCode: string;
  /** Canonical: zone diameter in mm. */
  zoneDiameterMm: number;
  /** Coarse confidence band derived from numeric confidence or supplied directly. */
  readerConfidence?: ReaderConfidenceBand;
  /** Original numeric confidence 0–1 if the reader supplied one. */
  confidenceNumeric?: number;
  /** Where the value came from. */
  measurementSource: MeasurementSource;
  /** True when the reader value was edited by a human before export. */
  manualEdited?: boolean;
  /** Original reader value before any manual edit (mm). */
  originalValue?: number;
  /** Corrected (final) value if a manual edit happened. Same as zoneDiameterMm when edited. */
  correctedValue?: number;
  /** Reason the manual edit was made — required when manualEdited=true. */
  overrideReason?: string;
  /** Per-row review status as held by the reader (LIMS still requires its own accept). */
  reviewStatus?: ImportReviewStatus;
  reviewedBy?: string;
  reviewedAt?: string;
  /** Optional plate barcode the reader scanned. */
  plateBarcode?: string;
  /** Image / instrument reference (canonical name: imageReference; imageUrl is the alias). */
  imageReference?: string;
  imageUrl?: string;
  /** Free-text reader note (canonical: notes; "comment" is the alias). */
  notes?: string;

  // ---- v1.0 alias fields kept on the canonical row for callers that want them ----
  /** @deprecated use zoneDiameterMm. */
  zoneMm?: number;
  /** @deprecated use confidenceNumeric. */
  confidence?: number;
}

export interface ZoneReaderResultImport {
  contractVersion: typeof ZONE_READER_CONTRACT_VERSION;
  sourceSystem: string;
  /** ISO timestamp the reader produced this result set. Canonical: readAt. */
  readAt: string;
  /** @deprecated alias for readAt. */
  measuredAt?: string;
  // ---- Round-trip identity ----
  accessionId: string;
  accessionNumber?: string;
  isolateId: string;
  astPanelId: string;
  method: ZoneReaderMethod;
  results: ZoneResult[];
  // ---- Reader instrument metadata ----
  /** Canonical reader device identifier. */
  readerDeviceId?: string;
  /** @deprecated alias for readerDeviceId. */
  device?: string;
  readerSoftwareVersion?: string;
  operator?: string;
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
  zoneDiameterMm: number;
  readerConfidence?: ReaderConfidenceBand;
  confidenceNumeric?: number;
  notes?: string;
  imageReference?: string;
  manualEdited?: boolean;
  overrideReason?: string;
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
