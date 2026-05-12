// Zod schemas for Zone Reader contract v1.
// Used to (a) guarantee export envelope shape and (b) parse untrusted import
// payloads before mapping. All structural rules live here; semantic rules
// (panel match, range checks, etc.) live in validateImport.ts.

import { z } from "zod";
import { ZONE_READER_CONTRACT_VERSION, ZONE_READER_SOURCE_SYSTEM } from "./types";

export const expectedDiscSchema = z.object({
  antibioticCode: z.string().min(1),
  discContent: z.string().optional(),
  plateHint: z.string().optional(),
});

export const zoneReaderWorklistExportSchema = z.object({
  contractVersion: z.literal(ZONE_READER_CONTRACT_VERSION),
  sourceSystem: z.literal(ZONE_READER_SOURCE_SYSTEM),
  generatedAt: z.string().min(1),
  accessionId: z.string().min(1),
  accessionNumber: z.string().min(1),
  isolateId: z.string().min(1),
  isolateNo: z.number().int().nonnegative(),
  organismDisplay: z.string().optional(),
  astPanelId: z.string().min(1),
  astPanelLabel: z.string().min(1),
  method: z.literal("disk_diffusion"),
  expectedDiscs: z.array(expectedDiscSchema).min(1),
});

export const zoneResultSchema = z.object({
  antibioticCode: z.string().min(1),
  zoneMm: z.number().min(0).max(60),
  confidence: z.number().min(0).max(1).optional(),
  notes: z.string().optional(),
  imageRef: z.string().optional(),
});

export const zoneReaderResultImportSchema = z.object({
  contractVersion: z.literal(ZONE_READER_CONTRACT_VERSION),
  sourceSystem: z.string().min(1),
  measuredAt: z.string().min(1),
  accessionId: z.string().min(1),
  accessionNumber: z.string().optional(),
  isolateId: z.string().min(1),
  astPanelId: z.string().min(1),
  method: z.literal("disk_diffusion"),
  results: z.array(zoneResultSchema).min(1),
  operator: z.string().optional(),
  device: z.string().optional(),
});
