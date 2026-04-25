// Breakpoint reference — Phase 2 lightweight scaffold.
// Provides the SHAPE the AST engine will consume; values are illustrative
// placeholders, NOT a clinical breakpoint table. Full CLSI/EUCAST tables
// land in Phase 3 expert-rule integration.

import type { ASTStandard } from "../domain/types";

export type BreakpointStatus = "active" | "missing" | "not_applicable" | "needs_validation";

interface BreakpointMeta {
  standard: ASTStandard;
  version?: string;
  year?: number;
  sourceLabel?: string;
  organismGroup: string; // matches OrganismDef.group
  antibioticCode: string;
  method: "disk_diffusion" | "mic";
  notes?: string;
  breakpointStatus?: BreakpointStatus;
}

export interface MICBreakpoint {
  organismGroup: BreakpointMeta["organismGroup"];
  antibioticCode: BreakpointMeta["antibioticCode"];
  standard: ASTStandard;
  method: "mic";
  version?: string;
  year?: number;
  sourceLabel?: string;
  notes?: string;
  breakpointStatus?: BreakpointStatus;
  susceptibleMaxMgL?: number;  // S if MIC <= this
  resistantMinMgL?: number;    // R if MIC >= this
  /** Anything strictly between is intermediate / I. */
}

export interface DiskBreakpoint {
  organismGroup: BreakpointMeta["organismGroup"];
  antibioticCode: BreakpointMeta["antibioticCode"];
  standard: ASTStandard;
  method: "disk_diffusion";
  version?: string;
  year?: number;
  sourceLabel?: string;
  notes?: string;
  breakpointStatus?: BreakpointStatus;
  susceptibleMinMm?: number;   // S if zone >= this
  resistantMaxMm?: number;     // R if zone <= this
}

/**
 * Primary standard for this build. CLSI is primary; EUCAST is secondary
 * and may override per organism/antibiotic pair via configuredOverrides
 * once the expert-rule engine ships.
 */
export const PRIMARY_STANDARD: ASTStandard = "CLSI";
export const SECONDARY_STANDARD: ASTStandard = "EUCAST";

const CLSI_ED36_STAPH_META = {
  standard: "CLSI" as const,
  version: "M100 Ed36",
  year: 2026,
  sourceLabel: "CLSI M100 Ed36 / FDA-recognised STIC where applicable",
  organismGroup: "staphylococcus",
} as const;

// Existing scaffold entries (non-Staphylococcus values retained as-is).
export const MIC_BREAKPOINTS: MICBreakpoint[] = [
  { organismGroup: "enterobacterales", antibioticCode: "MEM", standard: "CLSI", method: "mic", susceptibleMaxMgL: 1, resistantMinMgL: 4 },
  { organismGroup: "enterobacterales", antibioticCode: "CRO", standard: "CLSI", method: "mic", susceptibleMaxMgL: 1, resistantMinMgL: 4 },
  { organismGroup: "enterobacterales", antibioticCode: "CIP", standard: "CLSI", method: "mic", susceptibleMaxMgL: 0.25, resistantMinMgL: 1 },

  // Staphylococcus panel scaffold (CLSI M100 Ed36 / 2026).
  {
    ...CLSI_ED36_STAPH_META,
    antibioticCode: "ERY",
    method: "mic",
    breakpointStatus: "needs_validation",
  },
  {
    ...CLSI_ED36_STAPH_META,
    antibioticCode: "CLI",
    method: "mic",
    breakpointStatus: "needs_validation",
    notes: "Inducible clindamycin resistance requires D-test context.",
  },
  {
    ...CLSI_ED36_STAPH_META,
    antibioticCode: "GEN",
    method: "mic",
    breakpointStatus: "needs_validation",
  },
  {
    ...CLSI_ED36_STAPH_META,
    antibioticCode: "CIP",
    method: "mic",
    breakpointStatus: "needs_validation",
  },
  {
    ...CLSI_ED36_STAPH_META,
    antibioticCode: "LVX",
    method: "mic",
    breakpointStatus: "needs_validation",
  },
  {
    ...CLSI_ED36_STAPH_META,
    antibioticCode: "SXT",
    method: "mic",
    breakpointStatus: "needs_validation",
  },
  {
    ...CLSI_ED36_STAPH_META,
    antibioticCode: "TET",
    method: "mic",
    breakpointStatus: "needs_validation",
  },
  {
    ...CLSI_ED36_STAPH_META,
    antibioticCode: "VAN",
    method: "mic",
    breakpointStatus: "active",
    susceptibleMaxMgL: 2,
    resistantMinMgL: 16,
    notes: "Vancomycin for Staphylococcus is MIC-based.",
  },
  {
    ...CLSI_ED36_STAPH_META,
    antibioticCode: "TEC",
    method: "mic",
    breakpointStatus: "needs_validation",
  },
  {
    ...CLSI_ED36_STAPH_META,
    antibioticCode: "LZD",
    method: "mic",
    breakpointStatus: "needs_validation",
    notes: "Do not infer if validated breakpoint values are absent.",
  },
];

export const DISK_BREAKPOINTS: DiskBreakpoint[] = [
  { organismGroup: "enterobacterales", antibioticCode: "AMC", standard: "CLSI", method: "disk_diffusion", susceptibleMinMm: 18, resistantMaxMm: 13 },

  // Staphylococcus panel scaffold (CLSI M100 Ed36 / 2026).
  {
    ...CLSI_ED36_STAPH_META,
    antibioticCode: "ERY",
    method: "disk_diffusion",
    breakpointStatus: "needs_validation",
  },
  {
    ...CLSI_ED36_STAPH_META,
    antibioticCode: "CLI",
    method: "disk_diffusion",
    breakpointStatus: "needs_validation",
    notes: "Inducible clindamycin resistance requires D-test context.",
  },
  {
    ...CLSI_ED36_STAPH_META,
    antibioticCode: "GEN",
    method: "disk_diffusion",
    breakpointStatus: "needs_validation",
  },
  {
    ...CLSI_ED36_STAPH_META,
    antibioticCode: "CIP",
    method: "disk_diffusion",
    breakpointStatus: "needs_validation",
  },
  {
    ...CLSI_ED36_STAPH_META,
    antibioticCode: "LVX",
    method: "disk_diffusion",
    breakpointStatus: "needs_validation",
  },
  {
    ...CLSI_ED36_STAPH_META,
    antibioticCode: "SXT",
    method: "disk_diffusion",
    breakpointStatus: "needs_validation",
  },
  {
    ...CLSI_ED36_STAPH_META,
    antibioticCode: "TET",
    method: "disk_diffusion",
    breakpointStatus: "needs_validation",
  },
  {
    ...CLSI_ED36_STAPH_META,
    antibioticCode: "VAN",
    method: "disk_diffusion",
    breakpointStatus: "not_applicable",
    notes: "Vancomycin for Staphylococcus should be interpreted by MIC, not routine disk diffusion.",
  },
  {
    ...CLSI_ED36_STAPH_META,
    antibioticCode: "TEC",
    method: "disk_diffusion",
    breakpointStatus: "needs_validation",
  },
  {
    ...CLSI_ED36_STAPH_META,
    antibioticCode: "LZD",
    method: "disk_diffusion",
    breakpointStatus: "needs_validation",
    notes: "Do not infer if validated breakpoint values are absent.",
  },
];

export function findMICBreakpoint(group: string | undefined, antibioticCode: string, standard: ASTStandard) {
  if (!group) return undefined;
  return MIC_BREAKPOINTS.find(
    (b) =>
      b.organismGroup === group &&
      b.antibioticCode === antibioticCode &&
      b.standard === standard &&
      b.method === "mic" &&
      (b.breakpointStatus ?? "active") === "active" &&
      (b.susceptibleMaxMgL !== undefined || b.resistantMinMgL !== undefined),
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
      (b.susceptibleMinMm !== undefined || b.resistantMaxMm !== undefined),
  );
}
