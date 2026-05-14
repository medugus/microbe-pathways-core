// Zod schemas for Zone Reader contract v1.
//
// Worklist EXPORT schema is strict (we own the producer).
// Result IMPORT schema is tolerant: it accepts a documented set of aliases
// from the Zone Reader app and from likely future LIS adapters, then
// normalises them into the canonical ZoneResult / ZoneReaderResultImport
// shape declared in ./types.ts.
//
// Alias map (input → canonical):
//   zoneMm                → zoneDiameterMm
//   confidence (0–1 num)  → confidenceNumeric  (+ readerConfidence band derived)
//   readerConfidence text → readerConfidence
//   device                → readerDeviceId
//   measuredAt            → readAt
//   notes / comment       → notes
//   imageUrl              → imageReference (mirrored to imageUrl too)

import { z } from "zod";
import {
  ZONE_READER_CONTRACT_VERSION,
  ZONE_READER_SOURCE_SYSTEM,
  type ReaderConfidenceBand,
  type ZoneResult,
  type ZoneReaderResultImport,
} from "./types";

// ------------------------------------------------------------------
// Worklist export schema (strict producer)
// ------------------------------------------------------------------

export const expectedDiscSchema = z.object({
  antibioticCode: z.string().min(1),
  antibioticName: z.string().nullable().optional(),
  discPotency: z.string().nullable().optional(),
  antibioticClass: z.string().nullable().optional(),
  awareCategory: z.enum(["Access", "Watch", "Reserve"]).nullable().optional(),
  reportabilityDefault: z.enum(["report", "suppress", "conditional"]).nullable().optional(),
  plateHint: z.string().nullable().optional(),
  discContent: z.string().nullable().optional(),
});

export const zoneReaderWorklistExportSchema = z.object({
  contractVersion: z.literal(ZONE_READER_CONTRACT_VERSION),
  sourceSystem: z.literal(ZONE_READER_SOURCE_SYSTEM),
  generatedAt: z.string().min(1),
  accessionId: z.string().min(1),
  accessionNumber: z.string().min(1),
  isolateId: z.string().min(1),
  isolateNo: z.number().int().nonnegative(),

  patientDisplayId: z.string().nullable().optional(),
  patientName: z.string().nullable().optional(),
  ward: z.string().nullable().optional(),
  specimenType: z.string().nullable().optional(),
  specimenCode: z.string().nullable().optional(),
  organismName: z.string().nullable().optional(),
  organismCode: z.string().nullable().optional(),
  organismGroup: z.string().nullable().optional(),
  organismDisplay: z.string().optional(),

  astPanelId: z.string().min(1),
  astPanelLabel: z.string().min(1),
  astPanelName: z.string().optional(),
  standard: z.enum(["EUCAST", "CLSI", "LOCAL"]).nullable().optional(),

  method: z.literal("disk_diffusion"),
  expectedDiscs: z.array(expectedDiscSchema).min(1),
});

// ------------------------------------------------------------------
// Result import schema — accepts aliases, normalises to canonical
// ------------------------------------------------------------------

const confidenceBandSchema = z.enum(["high", "medium", "low", "manual"]);
const reviewStatusSchema = z.enum(["pending", "accepted", "rejected", "overridden"]);
const measurementSourceSchema = z.enum([
  // canonical
  "auto_reader",
  "manual_entry",
  "reader_then_manual",
  "imported",
  // accepted v1.0 aliases — normalised in transform
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

/** Tolerant raw row schema — every alias allowed; normalised in transform. */
const rawZoneResultSchema = z
  .object({
    antibioticCode: z.string().min(1),
    // aliases for the diameter
    zoneDiameterMm: z.number().min(0).max(80).optional(),
    zoneMm: z.number().min(0).max(80).optional(),
    // aliases for confidence
    confidence: z.number().min(0).max(1).optional(),
    confidenceNumeric: z.number().min(0).max(1).optional(),
    readerConfidence: confidenceBandSchema.optional(),
    measurementSource: measurementSourceSchema.optional(),
    manualEdited: z.boolean().optional(),
    originalValue: z.number().min(0).max(80).optional(),
    correctedValue: z.number().min(0).max(80).optional(),
    overrideReason: z.string().optional(),
    reviewStatus: reviewStatusSchema.optional(),
    reviewedBy: z.string().optional(),
    reviewedAt: z.string().optional(),
    plateBarcode: z.string().optional(),
    // image aliases
    imageReference: z.string().optional(),
    imageUrl: z.string().optional(),
    imageRef: z.string().optional(),
    // notes aliases
    notes: z.string().optional(),
    comment: z.string().optional(),
  })
  .superRefine((v, ctx) => {
    if (v.zoneDiameterMm == null && v.zoneMm == null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Missing zone diameter — provide zoneDiameterMm or zoneMm.",
      });
    }
  });

function bandFromNumeric(n: number | undefined): ReaderConfidenceBand | undefined {
  if (typeof n !== "number") return undefined;
  if (n >= 0.85) return "high";
  if (n >= 0.6) return "medium";
  return "low";
}

function normaliseRow(raw: z.infer<typeof rawZoneResultSchema>): ZoneResult {
  const zoneDiameterMm = (raw.zoneDiameterMm ?? raw.zoneMm) as number;
  const confidenceNumeric = raw.confidenceNumeric ?? raw.confidence;
  // Confidence band normalisation:
  //   manual_entry / manual_edited (no numeric)  → "manual"
  //   numeric ≥ 0.85                              → "high"
  //   0.6 ≤ numeric < 0.85                        → "medium"
  //   numeric < 0.6                               → "low"
  // An explicit readerConfidence on the row always wins.
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
  const notes = raw.notes ?? raw.comment;
  const imageReference = raw.imageReference ?? raw.imageUrl ?? raw.imageRef;
  const manualEdited =
    raw.manualEdited ??
    (raw.readerConfidence === "manual"
      ? true
      : raw.originalValue != null &&
        raw.correctedValue != null &&
        raw.originalValue !== raw.correctedValue);
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
    originalValue: raw.originalValue,
    correctedValue: raw.correctedValue ?? (manualEdited ? zoneDiameterMm : undefined),
    overrideReason: raw.overrideReason,
    reviewStatus: raw.reviewStatus,
    reviewedBy: raw.reviewedBy,
    reviewedAt: raw.reviewedAt,
    plateBarcode: raw.plateBarcode,
    imageReference,
    imageUrl: imageReference,
    notes,
  };
}

const rawImportSchema = z.object({
  contractVersion: z.literal(ZONE_READER_CONTRACT_VERSION),
  sourceSystem: z.string().min(1),
  // aliases for timestamp
  readAt: z.string().min(1).optional(),
  measuredAt: z.string().min(1).optional(),
  accessionId: z.string().min(1),
  accessionNumber: z.string().optional(),
  isolateId: z.string().min(1),
  astPanelId: z.string().min(1),
  method: z.literal("disk_diffusion"),
  results: z.array(rawZoneResultSchema).min(1),
  // aliases for device
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
      sourceSystem: v.sourceSystem,
      readAt,
      measuredAt: readAt,
      accessionId: v.accessionId,
      accessionNumber: v.accessionNumber,
      isolateId: v.isolateId,
      astPanelId: v.astPanelId,
      method: v.method,
      results: v.results.map(normaliseRow),
      readerDeviceId,
      device: readerDeviceId,
      readerSoftwareVersion: v.readerSoftwareVersion,
      operator: v.operator,
    };
  });
