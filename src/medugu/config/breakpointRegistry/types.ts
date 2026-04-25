import type { ASTInterpretation } from "../../domain/enums";
import type { ASTStandard } from "../../domain/types";

export type BreakpointStatus = "active" | "missing" | "not_applicable" | "needs_validation";
export type BreakpointMethod = "disk" | "mic";
export type BreakpointCategory = "S" | "I" | "R" | "ND";

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
  };
}

export function normalizeMICRecord(record: EucastBreakpointRecord): MICBreakpoint {
  return {
    ...record,
    method: "mic",
    resistantMinMgL: record.resistantMinMgL ?? record.resistantGreaterThanMgL,
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
