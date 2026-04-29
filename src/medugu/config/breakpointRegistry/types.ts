import type { ASTInterpretation } from "../../domain/enums";
import type { ASTStandard } from "../../domain/types";

export type BreakpointStatus = "active" | "missing" | "not_applicable" | "needs_validation";
export type BreakpointMethod = "disk" | "mic";
export type BreakpointCategory = "S" | "I" | "R" | "ND";

/**
 * Indication context for an EUCAST breakpoint row.
 * Used to disambiguate rows that share (organism, antibiotic, method) but
 * differ by syndrome / route / population.
 *
 *  - "general"            : default route used when no indication context applies
 *  - "uti"                : urinary-tract / urinary-origin infection
 *  - "uti_uncomplicated"  : oral, uncomplicated lower UTI only
 *  - "meningitis"         : CNS / CSF infection
 *  - "non_meningitis"     : explicit non-CNS variant where EUCAST splits the row
 *  - "systemic"           : systemic / bloodstream / deep-seated (non-UTI)
 *  - "oral"               : oral route (non-UTI specific)
 *  - "iv"                 : intravenous route
 */
export type BreakpointIndication =
  | "general"
  | "uti"
  | "uti_uncomplicated"
  | "meningitis"
  | "non_meningitis"
  | "systemic"
  | "oral"
  | "iv";

/** Flags surfaced alongside an interpreted result for downstream UI/validation. */
export interface BreakpointFlags {
  bracketed?: boolean;
  screeningOnly?: boolean;
  /** When set, the breakpoint may only be applied to these organism codes. */
  restrictedSpecies?: string[];
  meningitisOnly?: boolean;
  urinaryOnly?: boolean;
  oralOnly?: boolean;
}

export interface BreakpointMeta {
  standard: ASTStandard;
  version?: string;
  year?: number;
  sourceLabel?: string;
  sourceTableRef?: string;
  organismGroup: string;
  antibioticCode: string;
  notes?: string;
  breakpointStatus?: BreakpointStatus;
  interpretationCategories?: BreakpointCategory[];
  indication?: BreakpointIndication;
  flags?: BreakpointFlags;
}

export interface MICBreakpoint extends BreakpointMeta {
  method: "mic";
  susceptibleMaxMgL?: number;
  resistantMinMgL?: number;
  resistantGreaterThanMgL?: number;
}

export interface DiskBreakpoint extends BreakpointMeta {
  method: "disk_diffusion";
  susceptibleMinMm?: number;
  resistantMaxMm?: number;
  resistantLessThanMm?: number;
}

export type AnyBreakpoint = MICBreakpoint | DiskBreakpoint;

export interface EucastBreakpointRecord extends BreakpointMeta {
  standard: "EUCAST";
  version: "2026 v16.0";
  sourceLabel: "EUCAST Clinical Breakpoint Tables v16.0, 2026";
  method: BreakpointMethod;
  susceptibleMinMm?: number;
  resistantMaxMm?: number;
  resistantLessThanMm?: number;
  susceptibleMaxMgL?: number;
  resistantMinMgL?: number;
  resistantGreaterThanMgL?: number;
}

export const DEFAULT_EUCAST_INTERPRETATION_LABELS: Record<BreakpointCategory, string> = {
  S: "Susceptible, standard dosing regimen",
  I: "Susceptible, increased exposure",
  R: "Resistant",
  ND: "No defined breakpoint",
};

export function normalizeDiskRecord(record: EucastBreakpointRecord): DiskBreakpoint {
  return {
    ...record,
    method: "disk_diffusion",
    resistantMaxMm: record.resistantMaxMm ?? record.resistantLessThanMm,
    resistantLessThanMm: record.resistantLessThanMm,
  };
}

export function normalizeMICRecord(record: EucastBreakpointRecord): MICBreakpoint {
  return {
    ...record,
    method: "mic",
    resistantMinMgL: record.resistantMinMgL ?? record.resistantGreaterThanMgL,
    resistantGreaterThanMgL: record.resistantGreaterThanMgL,
  };
}

export function supportsCategory(
  breakpoint: { interpretationCategories?: BreakpointCategory[] },
  category: Extract<ASTInterpretation, "S" | "I" | "R" | "ND">,
): boolean {
  const categories = breakpoint.interpretationCategories;
  if (!categories || categories.length === 0) return true;
  return categories.includes(category);
}
