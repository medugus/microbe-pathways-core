import type { ASTStandard } from "../../domain/types";
import {
  DEFAULT_EUCAST_INTERPRETATION_LABELS,
  normalizeDiskRecord,
  normalizeMICRecord,
  supportsCategory,
  type AnyBreakpoint,
  type BreakpointCategory,
  type BreakpointFlags,
  type BreakpointIndication,
  type DiskBreakpoint,
  type EucastBreakpointRecord,
  type MICBreakpoint,
} from "./types";
import { EUCAST_2026_ENTEROBACTERALES_BREAKPOINTS } from "./eucast2026/enterobacterales";
import { EUCAST_2026_STAPHYLOCOCCUS_BREAKPOINTS } from "./eucast2026/staphylococcus";
import { EUCAST_2026_STREPTOCOCCUS_BREAKPOINTS } from "./eucast2026/streptococcus";
import { EUCAST_2026_ENTEROCOCCUS_BREAKPOINTS } from "./eucast2026/enterococcus";
import { EUCAST_2026_PSEUDOMONAS_BREAKPOINTS } from "./eucast2026/pseudomonas";
import { EUCAST_2026_ACINETOBACTER_BREAKPOINTS } from "./eucast2026/acinetobacter";
import { EUCAST_2026_METADATA } from "./eucast2026/notes";

export const PRIMARY_STANDARD: ASTStandard = "CLSI";
export const SECONDARY_STANDARD: ASTStandard = "EUCAST";

const CLSI_ED36_STAPH_META = {
  standard: "CLSI" as const,
  version: "M100 Ed36",
  year: 2026,
  sourceLabel: "CLSI M100 Ed36 / FDA-recognised STIC where applicable",
  organismGroup: "staphylococcus",
} as const;

const CLSI_MIC_BREAKPOINTS: MICBreakpoint[] = [
  { organismGroup: "enterobacterales", antibioticCode: "MEM", standard: "CLSI", method: "mic", susceptibleMaxMgL: 1, resistantMinMgL: 4 },
  { organismGroup: "enterobacterales", antibioticCode: "CRO", standard: "CLSI", method: "mic", susceptibleMaxMgL: 1, resistantMinMgL: 4 },
  { organismGroup: "enterobacterales", antibioticCode: "CIP", standard: "CLSI", method: "mic", susceptibleMaxMgL: 0.25, resistantMinMgL: 1 },
  { ...CLSI_ED36_STAPH_META, antibioticCode: "ERY", method: "mic", breakpointStatus: "needs_validation" },
  { ...CLSI_ED36_STAPH_META, antibioticCode: "CLI", method: "mic", breakpointStatus: "needs_validation", notes: "Inducible clindamycin resistance requires D-test context." },
  { ...CLSI_ED36_STAPH_META, antibioticCode: "GEN", method: "mic", breakpointStatus: "needs_validation" },
  { ...CLSI_ED36_STAPH_META, antibioticCode: "CIP", method: "mic", breakpointStatus: "needs_validation" },
  { ...CLSI_ED36_STAPH_META, antibioticCode: "LVX", method: "mic", breakpointStatus: "needs_validation" },
  { ...CLSI_ED36_STAPH_META, antibioticCode: "SXT", method: "mic", breakpointStatus: "needs_validation" },
  { ...CLSI_ED36_STAPH_META, antibioticCode: "TET", method: "mic", breakpointStatus: "needs_validation" },
  {
    ...CLSI_ED36_STAPH_META,
    antibioticCode: "VAN",
    method: "mic",
    breakpointStatus: "active",
    susceptibleMaxMgL: 2,
    resistantMinMgL: 16,
    notes: "Vancomycin for Staphylococcus is MIC-based.",
  },
  { ...CLSI_ED36_STAPH_META, antibioticCode: "TEC", method: "mic", breakpointStatus: "needs_validation" },
  { ...CLSI_ED36_STAPH_META, antibioticCode: "LZD", method: "mic", breakpointStatus: "needs_validation", notes: "Do not infer if validated breakpoint values are absent." },
];

const CLSI_DISK_BREAKPOINTS: DiskBreakpoint[] = [
  { organismGroup: "enterobacterales", antibioticCode: "AMC", standard: "CLSI", method: "disk_diffusion", susceptibleMinMm: 18, resistantMaxMm: 13 },
  { ...CLSI_ED36_STAPH_META, antibioticCode: "ERY", method: "disk_diffusion", breakpointStatus: "needs_validation" },
  { ...CLSI_ED36_STAPH_META, antibioticCode: "CLI", method: "disk_diffusion", breakpointStatus: "needs_validation", notes: "Inducible clindamycin resistance requires D-test context." },
  { ...CLSI_ED36_STAPH_META, antibioticCode: "GEN", method: "disk_diffusion", breakpointStatus: "needs_validation" },
  { ...CLSI_ED36_STAPH_META, antibioticCode: "CIP", method: "disk_diffusion", breakpointStatus: "needs_validation" },
  { ...CLSI_ED36_STAPH_META, antibioticCode: "LVX", method: "disk_diffusion", breakpointStatus: "needs_validation" },
  { ...CLSI_ED36_STAPH_META, antibioticCode: "SXT", method: "disk_diffusion", breakpointStatus: "needs_validation" },
  { ...CLSI_ED36_STAPH_META, antibioticCode: "TET", method: "disk_diffusion", breakpointStatus: "needs_validation" },
  {
    ...CLSI_ED36_STAPH_META,
    antibioticCode: "VAN",
    method: "disk_diffusion",
    breakpointStatus: "not_applicable",
    notes: "Vancomycin for Staphylococcus should be interpreted by MIC, not routine disk diffusion.",
  },
  { ...CLSI_ED36_STAPH_META, antibioticCode: "TEC", method: "disk_diffusion", breakpointStatus: "needs_validation" },
  { ...CLSI_ED36_STAPH_META, antibioticCode: "LZD", method: "disk_diffusion", breakpointStatus: "needs_validation", notes: "Do not infer if validated breakpoint values are absent." },
];

export const EUCAST_2026_BREAKPOINT_REGISTRY: EucastBreakpointRecord[] = [
  ...EUCAST_2026_ENTEROBACTERALES_BREAKPOINTS,
  ...EUCAST_2026_STAPHYLOCOCCUS_BREAKPOINTS,
  ...EUCAST_2026_STREPTOCOCCUS_BREAKPOINTS,
  ...EUCAST_2026_ENTEROCOCCUS_BREAKPOINTS,
  ...EUCAST_2026_PSEUDOMONAS_BREAKPOINTS,
  ...EUCAST_2026_ACINETOBACTER_BREAKPOINTS,
];

const EUCAST_MIC_BREAKPOINTS: MICBreakpoint[] = EUCAST_2026_BREAKPOINT_REGISTRY
  .filter((r) => r.method === "mic")
  .map((r) => normalizeMICRecord(r));

const EUCAST_DISK_BREAKPOINTS: DiskBreakpoint[] = EUCAST_2026_BREAKPOINT_REGISTRY
  .filter((r) => r.method === "disk")
  .map((r) => normalizeDiskRecord(r));

export const MIC_BREAKPOINTS: MICBreakpoint[] = [...CLSI_MIC_BREAKPOINTS, ...EUCAST_MIC_BREAKPOINTS];
export const DISK_BREAKPOINTS: DiskBreakpoint[] = [...CLSI_DISK_BREAKPOINTS, ...EUCAST_DISK_BREAKPOINTS];

export function findMICBreakpoint(group: string | undefined, antibioticCode: string, standard: ASTStandard) {
  if (!group) return undefined;
  return MIC_BREAKPOINTS.find(
    (b) =>
      b.organismGroup === group &&
      b.antibioticCode === antibioticCode &&
      b.standard === standard &&
      b.method === "mic" &&
      (b.breakpointStatus ?? "active") === "active" &&
      (
        b.susceptibleMaxMgL !== undefined ||
        b.resistantGreaterThanMgL !== undefined ||
        b.resistantMinMgL !== undefined
      ),
  );
}

export function findDiskBreakpoint(group: string | undefined, antibioticCode: string, standard: ASTStandard) {
  if (!group) return undefined;
  return DISK_BREAKPOINTS.find(
    (b) =>
      b.organismGroup === group &&
      b.antibioticCode === antibioticCode &&
      b.standard === standard &&
      b.method === "disk_diffusion" &&
      (b.breakpointStatus ?? "active") === "active" &&
      (
        b.susceptibleMinMm !== undefined ||
        b.resistantLessThanMm !== undefined ||
        b.resistantMaxMm !== undefined
      ),
  );
}

export function breakpointAllowsIntermediate(breakpoint: AnyBreakpoint): boolean {
  return supportsCategory(breakpoint, "I");
}

export function getInterpretationLabel(
  standard: ASTStandard,
  category: Extract<BreakpointCategory, "S" | "I" | "R" | "ND">,
): string {
  if (standard === "EUCAST") {
    return DEFAULT_EUCAST_INTERPRETATION_LABELS[category];
  }
  const generic = {
    S: "Susceptible",
    I: "Intermediate",
    R: "Resistant",
    ND: "No defined breakpoint",
  } as const;
  return generic[category];
}

export { EUCAST_2026_METADATA };
export * from "./types";
