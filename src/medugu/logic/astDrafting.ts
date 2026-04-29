// Phase-2 AST drafting helper — EUCAST v16.0 indication-aware.
//
// Builds an ASTResult row with governance/cascade placeholders and a draft
// interpretation against the configured breakpoint table. Resolution uses
// the indication-aware composite key (organism × drug × method × indication),
// driven by the specimen syndrome and isolate organism code.

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
  SECONDARY_STANDARD,
  resolveBreakpoint,
  type BreakpointResolution,
  type ResolverSyndrome,
} from "../config/breakpoints";
import { resolveSpecimen } from "./specimenResolver";

export interface DraftASTInput {
  isolateId: string;
  antibioticCode: string;
  method: ASTMethod;
  standard?: ASTStandard;
  rawValue?: number;
  comment?: string;
}

/** Lift the syndrome from the accession's resolved specimen profile. */
function syndromeFor(accession: Accession): ResolverSyndrome {
  const r = resolveSpecimen(accession.specimen.familyCode, accession.specimen.subtypeCode);
  if (!r.ok) return null;
  return (r.profile.syndrome ?? null) as ResolverSyndrome;
}

export interface DraftResult {
  interpretation?: ASTInterpretation;
  resolution?: BreakpointResolution;
  standardUsed?: ASTStandard;
}

function defaultStandardForGroup(group: string | undefined): ASTStandard {
  return group === "enterobacterales" ? SECONDARY_STANDARD : PRIMARY_STANDARD;
}

export function draftInterpretationFull(
  accession: Accession | undefined,
  isolate: Isolate | undefined,
  input: DraftASTInput,
): DraftResult {
  if (input.rawValue === undefined || !isolate) return {};

  const group = getOrganism(isolate.organismCode)?.group;
  if (!group) return {};
  const standard = input.standard ?? defaultStandardForGroup(group);
  const method = input.method === ASTMethod.DiskDiffusion ? "disk_diffusion" : "mic";

  const resolution = resolveBreakpoint({
    organismGroup: group,
    organismCode: isolate.organismCode,
    antibioticCode: input.antibioticCode,
    method,
    standard,
    syndrome: accession ? syndromeFor(accession) : undefined,
  });

  if (resolution.status !== "matched" || !resolution.breakpoint) {
    // species_restricted_block returns a resolution carrying flags; engine
    // surfaces this as a validation issue but does not interpret S/I/R.
    return { resolution, standardUsed: standard };
  }

  const bp = resolution.breakpoint;
  const interp =
    bp.method === "disk_diffusion"
      ? interpretDisk(input.rawValue, bp)
      : interpretMIC(input.rawValue, bp);
  return { interpretation: interp, resolution, standardUsed: standard };
}

/** Backwards-compatible thin wrapper for callers that only need S/I/R. */
export function draftInterpretation(
  isolate: Isolate | undefined,
  input: DraftASTInput,
): ASTInterpretation | undefined {
  return draftInterpretationFull(undefined, isolate, input).interpretation;
}

function interpretDisk(rawValue: number, bp: { susceptibleMinMm?: number; resistantLessThanMm?: number; resistantMaxMm?: number }): ASTInterpretation | undefined {
  if (bp.susceptibleMinMm !== undefined && rawValue >= bp.susceptibleMinMm) return "S";
  if (bp.resistantLessThanMm !== undefined && rawValue < bp.resistantLessThanMm) return "R";
  if (bp.resistantMaxMm !== undefined && rawValue <= bp.resistantMaxMm) return "R";
  return "I";
}

function interpretMIC(rawValue: number, bp: { susceptibleMaxMgL?: number; resistantGreaterThanMgL?: number; resistantMinMgL?: number }): ASTInterpretation | undefined {
  if (bp.susceptibleMaxMgL !== undefined && rawValue <= bp.susceptibleMaxMgL) return "S";
  if (bp.resistantGreaterThanMgL !== undefined && rawValue > bp.resistantGreaterThanMgL) return "R";
  if (bp.resistantMinMgL !== undefined && rawValue >= bp.resistantMinMgL) return "R";
  return "I";
}

export function buildASTResult(accession: Accession, input: DraftASTInput): ASTResult {
  const isolate = accession.isolates.find((i) => i.id === input.isolateId);
  const standard: ASTStandard = input.standard ?? defaultStandardForGroup(getOrganism(isolate?.organismCode ?? "")?.group);
  const rawUnit: "mg/L" | "mm" = input.method === "disk_diffusion" ? "mm" : "mg/L";
  const { interpretation, resolution, standardUsed } = draftInterpretationFull(accession, isolate, { ...input, standard });
  const governance: ASTGovernanceState = "draft";
  const cascade: ASTCascadeState = "primary";

  return {
    id: newId("ast"),
    isolateId: input.isolateId,
    antibioticCode: input.antibioticCode,
    method: input.method,
    standard: standardUsed ?? standard,
    rawValue: input.rawValue,
    rawUnit,
    micMgL: rawUnit === "mg/L" ? input.rawValue : undefined,
    zoneMm: rawUnit === "mm" ? input.rawValue : undefined,
    rawInterpretation: interpretation,
    finalInterpretation: interpretation,
    governance,
    cascade,
    comment: input.comment,
    breakpointKey: resolution?.breakpointKey,
    indicationUsed: resolution?.indicationUsed,
    breakpointSource: resolution?.source,
    breakpointFlags: resolution?.flags,
    breakpointSpeciesViolation: resolution?.status === "species_restricted_block",
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
  const isolate = accession.isolates.find((i) => i.id === row.isolateId);
  const standard = patch.standard ?? (getOrganism(isolate?.organismCode ?? "")?.group === "enterobacterales" ? SECONDARY_STANDARD : row.standard);
  const rawValue = patch.rawValue;
  const rawUnit = patch.rawUnit ?? resolvedRawUnit(method);
  const { interpretation: draft, resolution } = draftInterpretationFull(
    accession,
    isolate,
    {
      isolateId: row.isolateId,
      antibioticCode: row.antibioticCode,
      method,
      standard,
      rawValue,
    },
  );

  const patchOut: Partial<ASTResult> = {
    method,
    standard,
    rawValue,
    rawUnit,
    micMgL: rawUnit === "mg/L" ? rawValue : undefined,
    zoneMm: rawUnit === "mm" ? rawValue : undefined,
    rawInterpretation: draft,
    interpretedSIR: draft,
    breakpointKey: resolution?.breakpointKey,
    indicationUsed: resolution?.indicationUsed,
    breakpointSource: resolution?.source,
    breakpointFlags: resolution?.flags ?? {},
    breakpointSpeciesViolation: resolution?.status === "species_restricted_block",
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
