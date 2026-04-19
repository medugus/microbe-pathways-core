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
import type { ASTInterpretation, ASTMethod } from "../domain/enums";
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
    if (!bp) return undefined;
    if (bp.susceptibleMinMm !== undefined && input.rawValue >= bp.susceptibleMinMm) return "S";
    if (bp.resistantMaxMm !== undefined && input.rawValue <= bp.resistantMaxMm) return "R";
    return "I";
  }
  // MIC family
  const bp = findMICBreakpoint(group, input.antibioticCode, standard);
  if (!bp) return undefined;
  if (bp.susceptibleMaxMgL !== undefined && input.rawValue <= bp.susceptibleMaxMgL) return "S";
  if (bp.resistantMinMgL !== undefined && input.rawValue >= bp.resistantMinMgL) return "R";
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
