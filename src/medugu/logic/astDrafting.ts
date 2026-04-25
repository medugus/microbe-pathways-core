// Phase-2 AST drafting helper.
// Builds an ASTResult row with governance/cascade placeholders and a
// trivial draft interpretation against the configured breakpoint table.
// Full expert rules (intrinsic resistance, ESBL/AmpC inference, expert
// overrides, cascade reporting) land in Phase 3.

import type {
  ASTGovernanceState,
  ASTCascadeState,
  ASTResult,
  ASTStandard,
  Accession,
  Isolate,
} from "../domain/types";
import { ASTMethod, type ASTInterpretation } from "../domain/enums";
import { newId } from "../domain/ids";
import { getOrganism } from "../config/organisms";
import {
  PRIMARY_STANDARD,
  findDiskBreakpoint,
  findMICBreakpoint,
} from "../config/breakpoints";

export interface DraftASTInput {
  isolateId: string;
  antibioticCode: string;
  method: ASTMethod;
  standard?: ASTStandard;
  rawValue?: number;
  comment?: string;
}

export function draftInterpretation(
  isolate: Isolate | undefined,
  input: DraftASTInput,
): ASTInterpretation | undefined {
  if (input.rawValue === undefined || !isolate) return undefined;

  const group = getOrganism(isolate.organismCode)?.group;
  const standard = input.standard ?? PRIMARY_STANDARD;

  if (input.method === "disk_diffusion") {
    const bp = findDiskBreakpoint(group, input.antibioticCode, standard);
    return interpretDiskAgainstBreakpoint(input.rawValue, bp);
  }

  const bp = findMICBreakpoint(group, input.antibioticCode, standard);
  return interpretMICAgainstBreakpoint(input.rawValue, bp);
}

function interpretDiskAgainstBreakpoint(
  rawValue: number,
  bp: ReturnType<typeof findDiskBreakpoint> | undefined,
): ASTInterpretation | undefined {
  if (!bp) return undefined;
  if (bp.susceptibleMinMm !== undefined && rawValue >= bp.susceptibleMinMm) return "S";
  if (bp.resistantMaxMm !== undefined && rawValue <= bp.resistantMaxMm) return "R";
  return "I";
}

function interpretMICAgainstBreakpoint(
  rawValue: number,
  bp: ReturnType<typeof findMICBreakpoint> | undefined,
): ASTInterpretation | undefined {
  if (!bp) return undefined;
  if (bp.susceptibleMaxMgL !== undefined && rawValue <= bp.susceptibleMaxMgL) return "S";
  if (bp.resistantMinMgL !== undefined && rawValue >= bp.resistantMinMgL) return "R";
  return "I";
}
export function buildASTResult(accession: Accession, input: DraftASTInput): ASTResult {
  const isolate = accession.isolates.find((i) => i.id === input.isolateId);
  const standard: ASTStandard = input.standard ?? PRIMARY_STANDARD;
  const rawUnit: "mg/L" | "mm" = input.method === "disk_diffusion" ? "mm" : "mg/L";
  const draft = draftInterpretation(isolate, input);
  const governance: ASTGovernanceState = "draft";
  const cascade: ASTCascadeState = "primary";

  return {
    id: newId("ast"),
    isolateId: input.isolateId,
    antibioticCode: input.antibioticCode,
    method: input.method,
    standard,
    rawValue: input.rawValue,
    rawUnit,
    micMgL: rawUnit === "mg/L" ? input.rawValue : undefined,
    zoneMm: rawUnit === "mm" ? input.rawValue : undefined,
    rawInterpretation: draft,
    finalInterpretation: draft,
    governance,
    cascade,
    comment: input.comment,
  };
}

function isMICMethod(method: ASTMethod): boolean {
  return method !== ASTMethod.DiskDiffusion;
}

function resolvedRawUnit(method: ASTMethod): "mg/L" | "mm" {
  return isMICMethod(method) ? "mg/L" : "mm";
}

export function rebuildASTFromRawEdit(
  accession: Accession,
  row: ASTResult,
  patch: {
    rawValue?: number;
    method?: ASTMethod;
    standard?: ASTStandard;
    rawUnit?: "mg/L" | "mm";
  },
): Partial<ASTResult> {
  const method = patch.method ?? row.method;
  const standard = patch.standard ?? row.standard;
  const rawValue = patch.rawValue;
  const rawUnit = patch.rawUnit ?? resolvedRawUnit(method);
  const draft = draftInterpretation(accession.isolates.find((i) => i.id === row.isolateId), {
    isolateId: row.isolateId,
    antibioticCode: row.antibioticCode,
    method,
    standard,
    rawValue,
  });

  const patchOut: Partial<ASTResult> = {
    method,
    standard,
    rawValue,
    rawUnit,
    micMgL: rawUnit === "mg/L" ? rawValue : undefined,
    zoneMm: rawUnit === "mm" ? rawValue : undefined,
    rawInterpretation: draft,
    interpretedSIR: draft,
  };

  const hasManualOverride =
    row.finalInterpretation !== undefined &&
    row.finalInterpretation !== row.interpretedSIR &&
    row.finalInterpretation !== row.rawInterpretation;

  if (!hasManualOverride) {
    patchOut.finalInterpretation = draft;
  }

  return patchOut;
}
