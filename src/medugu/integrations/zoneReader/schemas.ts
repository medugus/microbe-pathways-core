// Zod schemas for Zone Reader contract v1.

import { z } from "zod";
import {
  IMPORT_REVIEW_STATUS_VALUES,
  READER_CONFIDENCE_BAND_VALUES,
  ZONE_READER_CONTRACT_VERSION,
  ZONE_READER_METHOD,
  ZONE_READER_RESULT_SCHEMA_VERSION,
  ZONE_READER_SOURCE_SYSTEM,
  ZONE_READER_STANDARD_VALUES,
  type ReaderConfidenceBand,
  type ZoneResult,
  type ZoneReaderResultImport,
} from "./types";

// ------------------------------------------------------------------
// Worklist export schema (strict producer) — FLAT, no wrapper
// ------------------------------------------------------------------

export const expectedDiscSchema = z
  .object({
    antibioticCode: z.string().min(1),
    antibioticName: z.string().nullable().optional(),
    // Always a non-empty string. Use the placeholder "unspecified" when no
    // potency is mapped — never empty, never null.
    discPotency: z.string().min(1),
    plateHint: z.string().nullable().optional(),
  })
  .strict();

/**
 * Flat worklist payload — strict producer schema. Field set mirrors the
 * Zone Reader importer's `LimsWorklist` schema exactly; unknown root fields
 * are rejected (`.strict()`).
 */
export const zoneReaderWorklistExportSchema = z
  .object({
    schemaVersion: z.literal(ZONE_READER_CONTRACT_VERSION),
    sourceSystem: z.literal(ZONE_READER_SOURCE_SYSTEM),
    createdAt: z.string().min(1),
    worklistId: z.string().min(1),

    accessionId: z.string().min(1),
    accessionNumber: z.string().min(1),
    isolateId: z.string().min(1),

    patientDisplayId: z.string().min(1),
    specimenType: z.string().min(1),
    organismName: z.string().min(1),
    organismCode: z.string().min(1),
    organismGroup: z.string().min(1),

    astPanelId: z.string().min(1),
    astPanelName: z.string().min(1),
    standard: z.enum(ZONE_READER_STANDARD_VALUES),

    expectedDiscs: z.array(expectedDiscSchema).min(1),
  })
  .strict();


/** @deprecated alias kept for back-compat. */
export const zoneReaderWorklistBodySchema = zoneReaderWorklistExportSchema;

// ------------------------------------------------------------------
// Result import schema — accepts aliases, normalises to canonical
// ------------------------------------------------------------------

const confidenceBandSchema = z.enum(READER_CONFIDENCE_BAND_VALUES);
const reviewStatusSchema = z.enum(IMPORT_REVIEW_STATUS_VALUES);
const measurementSourceSchema = z.enum([
  "auto_reader",
  "manual_entry",
  "reader_then_manual",
  "imported",
  "reader",
  "manual",
]);

const MEASUREMENT_SOURCE_ALIAS: Record<string, "auto_reader" | "manual_entry" | "reader_then_manual" | "imported"> = {
  reader: "auto_reader",
  manual: "manual_entry",
  auto_reader: "auto_reader",
  manual_entry: "manual_entry",
  reader_then_manual: "reader_then_manual",
  imported: "imported",
};

const rawZoneResultSchema = z
  .object({
    antibioticCode: z.string().min(1),
    zoneDiameterMm: z.number().min(0).max(80).optional(),
    zoneMm: z.number().min(0).max(80).optional(),
    confidence: z.number().min(0).max(1).optional(),
    confidenceNumeric: z.number().min(0).max(1).optional(),
    readerConfidence: confidenceBandSchema.optional(),
    measurementSource: measurementSourceSchema.optional(),
    manualEdited: z.boolean().optional(),
    // Override-audit fields. When manualEdited=false (or absent) these are
    // optional and may be explicitly null — real Zone Reader exports send
    // `null` here for untouched rows. When manualEdited=true the full
    // quintet is required (enforced in the superRefine below).
    originalValue: z.number().min(0).max(80).nullable().optional(),
    correctedValue: z.number().min(0).max(80).nullable().optional(),
    overrideReason: z.string().nullable().optional(),
    reviewStatus: reviewStatusSchema.optional(),
    reviewedBy: z.string().nullable().optional(),
    reviewedAt: z.string().nullable().optional(),
    plateBarcode: z.string().nullable().optional(),
    imageReference: z.string().nullable().optional(),
    imageUrl: z.string().nullable().optional(),
    imageRef: z.string().nullable().optional(),
    notes: z.string().nullable().optional(),
    comment: z.string().nullable().optional(),
  })
  .superRefine((v, ctx) => {
    if (v.zoneDiameterMm == null && v.zoneMm == null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Missing zone diameter — provide zoneDiameterMm or zoneMm.",
      });
    }
    if (v.manualEdited === true) {
      const requireFilled = (
        field:
          | "originalValue"
          | "correctedValue"
          | "overrideReason"
          | "reviewedBy"
          | "reviewedAt",
      ) => {
        const value = v[field];
        if (value == null || (typeof value === "string" && value.length === 0)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: [field],
            message:
              `When manualEdited=true, ${field} is required. ` +
              "Override-audit quintet (originalValue, correctedValue, overrideReason, reviewedBy, reviewedAt) must all be present and non-null.",
          });
        }
      };
      requireFilled("originalValue");
      requireFilled("correctedValue");
      requireFilled("overrideReason");
      requireFilled("reviewedBy");
      requireFilled("reviewedAt");
    }
  });

function bandFromNumeric(n: number | undefined): ReaderConfidenceBand | undefined {
  if (typeof n !== "number") return undefined;
  if (n >= 0.85) return "high";
  if (n >= 0.6) return "medium";
  return "low";
}

function nz<T>(v: T | null | undefined): T | undefined {
  return v == null ? undefined : v;
}

function normaliseRow(raw: z.infer<typeof rawZoneResultSchema>): ZoneResult {
  const zoneDiameterMm = (raw.zoneDiameterMm ?? raw.zoneMm) as number;
  const confidenceNumeric = raw.confidenceNumeric ?? raw.confidence;
  const originalValue = nz(raw.originalValue);
  const correctedValue = nz(raw.correctedValue);
  const overrideReason = nz(raw.overrideReason);
  const reviewedBy = nz(raw.reviewedBy);
  const reviewedAt = nz(raw.reviewedAt);
  const plateBarcode = nz(raw.plateBarcode);
  const notes = nz(raw.notes) ?? nz(raw.comment);
  const imageReference = nz(raw.imageReference) ?? nz(raw.imageUrl) ?? nz(raw.imageRef);
  const manualEditedHint =
    raw.manualEdited === true ||
    raw.readerConfidence === "manual" ||
    raw.measurementSource === "manual" ||
    raw.measurementSource === "manual_entry" ||
    raw.measurementSource === "reader_then_manual";
  const readerConfidence: ReaderConfidenceBand | undefined =
    raw.readerConfidence ??
    bandFromNumeric(confidenceNumeric) ??
    (manualEditedHint ? "manual" : undefined);
  const manualEdited =
    raw.manualEdited ??
    (raw.readerConfidence === "manual"
      ? true
      : originalValue != null &&
        correctedValue != null &&
        originalValue !== correctedValue);
  const rawSource = raw.measurementSource;
  const measurementSource: ZoneResult["measurementSource"] = rawSource
    ? MEASUREMENT_SOURCE_ALIAS[rawSource]
    : manualEdited
      ? "reader_then_manual"
      : "auto_reader";

  return {
    antibioticCode: raw.antibioticCode,
    zoneDiameterMm,
    zoneMm: zoneDiameterMm,
    confidenceNumeric,
    confidence: confidenceNumeric,
    readerConfidence,
    measurementSource,
    manualEdited,
    originalValue,
    correctedValue: correctedValue ?? (manualEdited ? zoneDiameterMm : undefined),
    overrideReason,
    reviewStatus: raw.reviewStatus,
    reviewedBy,
    reviewedAt,
    plateBarcode,
    imageReference,
    imageUrl: imageReference,
    notes,
  };
}

const rawImportSchema = z.object({
  schemaVersion: z.literal(ZONE_READER_RESULT_SCHEMA_VERSION).optional(),
  contractVersion: z.literal(ZONE_READER_CONTRACT_VERSION),
  sourceSystem: z.string().min(1),
  readAt: z.string().min(1).optional(),
  measuredAt: z.string().min(1).optional(),
  accessionId: z.string().min(1),
  accessionNumber: z.string().optional(),
  isolateId: z.string().min(1),
  astPanelId: z.string().min(1),
  method: z.literal(ZONE_READER_METHOD),
  // Envelope-level breakpoint standard — part of the canonical match key
  // (isolateId, antibioticCode, method, standard).
  standard: z.enum(ZONE_READER_STANDARD_VALUES).optional(),
  // Hard assertions the Zone Reader MUST stamp on every envelope.
  // Required to be literally `true` / `"LIS"`; checked in validateImport so
  // the failure surfaces as a friendly blocker (not a raw zod path error).
  notForClinicalRelease: z.boolean().optional(),
  releaseAuthority: z.string().optional(),
  results: z.array(rawZoneResultSchema).min(1),
  readerDeviceId: z.string().optional(),
  device: z.string().optional(),
  readerSoftwareVersion: z.string().optional(),
  operator: z.string().optional(),
});

export const zoneReaderResultImportSchema = rawImportSchema
  .superRefine((v, ctx) => {
    if (!v.readAt && !v.measuredAt) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Missing timestamp — provide readAt or measuredAt.",
      });
    }
  })
  .transform<ZoneReaderResultImport>((v) => {
    const readAt = (v.readAt ?? v.measuredAt) as string;
    const readerDeviceId = v.readerDeviceId ?? v.device;
    return {
      contractVersion: v.contractVersion,
      schemaVersion: v.schemaVersion,
      sourceSystem: v.sourceSystem,
      readAt,
      measuredAt: readAt,
      accessionId: v.accessionId,
      accessionNumber: v.accessionNumber,
      isolateId: v.isolateId,
      astPanelId: v.astPanelId,
      method: v.method,
      standard: v.standard,
      notForClinicalRelease: v.notForClinicalRelease,
      releaseAuthority:
        v.releaseAuthority === "LIS" ? "LIS" : (v.releaseAuthority as undefined),
      results: v.results.map(normaliseRow),
      readerDeviceId,
      device: readerDeviceId,
      readerSoftwareVersion: v.readerSoftwareVersion,
      operator: v.operator,
    };
  });
