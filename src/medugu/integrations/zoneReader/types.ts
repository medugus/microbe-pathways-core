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

export type MeasurementSource =
  | "auto_reader"
  | "manual_entry"
  | "reader_then_manual"
  | "imported";

export type MeasurementSourceAlias = "reader" | "manual";

export type ImportReviewStatus = "pending" | "accepted" | "rejected" | "overridden";

export interface ExpectedDisc {
  antibioticCode: string;
  antibioticName?: string | null;
  /**
   * Disc potency string. The Zone Reader importer requires a non-empty
   * string. When a true potency mapping is not yet available in the
   * antibiotic dictionary we emit the stable placeholder
   * {@link DISC_POTENCY_PLACEHOLDER} ("unspecified") rather than an empty
   * string or a fabricated dose.
   */
  discPotency: string;
  plateHint?: string | null;
}

/**
 * Stable placeholder used for {@link ExpectedDisc.discPotency} when the
 * antibiotic dictionary does not yet carry a true potency mapping. Chosen
 * to be clinically non-misleading — it does NOT name a real dose.
 */
export const DISC_POTENCY_PLACEHOLDER = "unspecified" as const;

/**
 * Flat top-level worklist payload. Field set is intentionally limited to
 * exactly what the current strict Zone Reader `LimsWorklist` schema accepts
 * at the JSON root — no extra fields.
 */
export interface ZoneReaderWorklistExport {
  /** Envelope/schema version, at the JSON root. */
  schemaVersion: typeof ZONE_READER_CONTRACT_VERSION;
  sourceSystem: typeof ZONE_READER_SOURCE_SYSTEM;
  /** ISO timestamp the worklist envelope was created. */
  createdAt: string;
  /** Stable round-trip id derived from accessionId + isolateId + astPanelId. */
  worklistId: string;

  accessionId: string;
  accessionNumber: string;
  isolateId: string;

  patientDisplayId?: string | null;

  specimenType?: string | null;

  organismName?: string | null;
  organismCode?: string | null;
  /** Always a string — empty string when unknown. Importer rejects null. */
  organismGroup: string;

  astPanelId: string;
  /** Display label for the AST panel. */
  astPanelName: string;
  /** Breakpoint standard in force for this isolate. */
  standard: ZoneReaderStandard | null;

  expectedDiscs: ExpectedDisc[];
}


/**
 * @deprecated Envelope is now flat — alias for {@link ZoneReaderWorklistExport}.
 */
export type ZoneReaderWorklistEnvelope = ZoneReaderWorklistExport;

export interface ZoneResult {
  antibioticCode: string;
  zoneDiameterMm: number;
  readerConfidence?: ReaderConfidenceBand;
  confidenceNumeric?: number;
  measurementSource: MeasurementSource;
  manualEdited?: boolean;
  originalValue?: number;
  correctedValue?: number;
  overrideReason?: string;
  reviewStatus?: ImportReviewStatus;
  reviewedBy?: string;
  reviewedAt?: string;
  plateBarcode?: string;
  imageReference?: string;
  imageUrl?: string;
  notes?: string;
  /** @deprecated use zoneDiameterMm. */
  zoneMm?: number;
  /** @deprecated use confidenceNumeric. */
  confidence?: number;
}

export interface ZoneReaderResultImport {
  contractVersion: typeof ZONE_READER_CONTRACT_VERSION;
  sourceSystem: string;
  readAt: string;
  measuredAt?: string;
  accessionId: string;
  accessionNumber?: string;
  isolateId: string;
  astPanelId: string;
  method: ZoneReaderMethod;
  /** Envelope-level breakpoint standard. Used as part of the match key. */
  standard?: ZoneReaderStandard;
  /**
   * Hard assertion from the Zone Reader: this envelope is NOT a clinical
   * release. Must be exactly `true` for Medugu to accept it.
   */
  notForClinicalRelease?: boolean;
  /**
   * Hard assertion from the Zone Reader: release authority remains with the
   * LIS (Medugu). Must be exactly `"LIS"` for Medugu to accept it.
   */
  releaseAuthority?: "LIS";
  results: ZoneResult[];
  readerDeviceId?: string;
  device?: string;
  readerSoftwareVersion?: string;
  operator?: string;
}

export interface ImportFinding {
  severity: ImportFindingSeverity;
  code: string;
  message: string;
  antibioticCode?: string;
}

export interface MatchedRow {
  antibioticCode: string;
  astRowId: string;
  zoneDiameterMm: number;
  readerConfidence?: ReaderConfidenceBand;
  confidenceNumeric?: number;
  notes?: string;
  imageReference?: string;
  manualEdited?: boolean;
  overrideReason?: string;
  requiresReview: boolean;
  reviewReasons: string[];
}

export type UnmatchedReason =
  | "MISSING_AST_ROW"
  | "METHOD_MISMATCH"
  | "STANDARD_MISMATCH";

export interface UnmatchedAlignment {
  antibioticCode: string;
  reason: UnmatchedReason;
  /** The method of an existing row when reason = METHOD_MISMATCH. */
  existingMethod?: string;
  /** The standard of an existing row when reason = STANDARD_MISMATCH. */
  existingStandard?: string;
  /** The standard the import expects (from worklist when present). */
  expectedStandard?: string;
}

export interface ImportMapResult {
  ok: boolean;
  matched: MatchedRow[];
  unmatched: ZoneResult[];
  /** Structured reasons for each unmatched row (parallel to `unmatched`). */
  alignment: UnmatchedAlignment[];
  missing: string[];
  findings: ImportFinding[];
}
