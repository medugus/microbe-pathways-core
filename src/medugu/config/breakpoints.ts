// Breakpoint reference — Phase 2 lightweight scaffold.
// Provides the SHAPE the AST engine will consume; values are illustrative
// placeholders, NOT a clinical breakpoint table. Full CLSI/EUCAST tables
// land in Phase 3 expert-rule integration.

import type { ASTStandard } from "../domain/types";

export interface MICBreakpoint {
  organismGroup: string;       // matches OrganismDef.group
  antibioticCode: string;
  standard: ASTStandard;
  susceptibleMaxMgL?: number;  // S if MIC <= this
  resistantMinMgL?: number;    // R if MIC >= this
  /** Anything strictly between is intermediate / I. */
}

export interface DiskBreakpoint {
  organismGroup: string;
  antibioticCode: string;
  standard: ASTStandard;
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

// Illustrative scaffolding — Phase 2 only.
export const MIC_BREAKPOINTS: MICBreakpoint[] = [
  { organismGroup: "enterobacterales", antibioticCode: "MEM", standard: "CLSI", susceptibleMaxMgL: 1, resistantMinMgL: 4 },
  { organismGroup: "enterobacterales", antibioticCode: "CRO", standard: "CLSI", susceptibleMaxMgL: 1, resistantMinMgL: 4 },
  { organismGroup: "enterobacterales", antibioticCode: "CIP", standard: "CLSI", susceptibleMaxMgL: 0.25, resistantMinMgL: 1 },
  { organismGroup: "staphylococcus",   antibioticCode: "VAN", standard: "CLSI", susceptibleMaxMgL: 2, resistantMinMgL: 16 },
];

export const DISK_BREAKPOINTS: DiskBreakpoint[] = [
  { organismGroup: "enterobacterales", antibioticCode: "AMC", standard: "CLSI", susceptibleMinMm: 18, resistantMaxMm: 13 },
];

export function findMICBreakpoint(group: string | undefined, antibioticCode: string, standard: ASTStandard) {
  if (!group) return undefined;
  return MIC_BREAKPOINTS.find(
    (b) => b.organismGroup === group && b.antibioticCode === antibioticCode && b.standard === standard,
  );
}
export function findDiskBreakpoint(group: string | undefined, antibioticCode: string, standard: ASTStandard) {
  if (!group) return undefined;
  return DISK_BREAKPOINTS.find(
    (b) => b.organismGroup === group && b.antibioticCode === antibioticCode && b.standard === standard,
  );
}
