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
  /** Always a string — empty string when unknown. Importer rejects null. */
  discPotency: string;
  antibioticClass?: string | null;
  awareCategory?: "Access" | "Watch" | "Reserve" | null;
  reportabilityDefault?: "report" | "suppress" | "conditional" | null;
  plateHint?: string | null;
  /** @deprecated use discPotency. */
  discContent?: string | null;
}

/**
 * Flat top-level worklist payload. The Zone Reader importer expects every
 * field at the JSON root — there is NO `worklist` wrapper.
 */
export interface ZoneReaderWorklistExport {
  /** Envelope/schema version, at the JSON root. */
  schemaVersion: typeof ZONE_READER_CONTRACT_VERSION;
  /** Same value as schemaVersion, kept for back-compat with v1.0 consumers. */
  contractVersion: typeof ZONE_READER_CONTRACT_VERSION;
  sourceSystem: typeof ZONE_READER_SOURCE_SYSTEM;
  /** ISO timestamp the worklist envelope was created. */
  createdAt: string;
  /** Stable round-trip id derived from accessionId + isolateId + astPanelId. */
  worklistId: string;
  /** ISO timestamp the worklist was generated (alias of createdAt). */
  generatedAt: string;

  accessionId: string;
  accessionNumber: string;
  isolateId: string;
  isolateNo: number;

  patientDisplayId?: string | null;
  patientName?: string | null;
  ward?: string | null;

  specimenType?: string | null;
  specimenCode?: string | null;

  organismName?: string | null;
  organismCode?: string | null;
  /** Always a string — empty string when unknown. Importer rejects null. */
  organismGroup: string;
  /** @deprecated use organismName. */
  organismDisplay?: string;

  astPanelId: string;
  astPanelLabel: string;
  /** Alias the Zone Reader app expects; same value as astPanelLabel. */
  astPanelName: string;
  /** Breakpoint standard in force for this isolate. */
  standard: ZoneReaderStandard | null;

  method: ZoneReaderMethod;
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

export interface ImportMapResult {
  ok: boolean;
  matched: MatchedRow[];
  unmatched: ZoneResult[];
  missing: string[];
  findings: ImportFinding[];
}
