// EUCAST v16.0 Pseudomonas — regression checks for literal off-scale disk breakpoints.

import { resolveBreakpoint } from "../../config/breakpoints";
import { ASTMethod } from "../../domain/enums";
import type { Accession } from "../../domain/types";
import { buildASTResult } from "../astDrafting";

function assert(condition: unknown, message: string): void {
  if (!condition) throw new Error(`EUCAST 2026 Pseudomonas: ${message}`);
}

const accession = {
  id: "acc-paer",
  accessionNumber: "ACC-PAER",
  specimen: { familyCode: "BLOOD", subtypeCode: "BLOOD_CULTURE" },
  isolates: [{ id: "iso-paer", isolateNo: 1, organismCode: "PAER", organismDisplay: "Pseudomonas aeruginosa" }],
  ast: [],
} as unknown as Accession;

// Cefepime disk: EUCAST v16.0 Pseudomonas spp. is S≥50 / R<21 with no S category.
{
  const r = resolveBreakpoint({
    organismGroup: "non_fermenter",
    organismCode: "PAER",
    antibioticCode: "FEP",
    method: "disk_diffusion",
    standard: "EUCAST",
    syndrome: "bsi",
  });
  const bp = r.breakpoint as { susceptibleMinMm?: number; resistantLessThanMm?: number } | undefined;
  assert(r.status === "matched", "FEP disk must match");
  assert(bp?.susceptibleMinMm === 50, `FEP disk S threshold must be 50, got ${bp?.susceptibleMinMm}`);
  assert(bp?.resistantLessThanMm === 21, `FEP disk R threshold must be <21, got ${bp?.resistantLessThanMm}`);
}

{
  const zone20 = buildASTResult(accession, {
    isolateId: "iso-paer",
    antibioticCode: "FEP",
    method: ASTMethod.DiskDiffusion,
    standard: "EUCAST",
    rawValue: 20,
  });
  const zone21 = buildASTResult(accession, {
    isolateId: "iso-paer",
    antibioticCode: "FEP",
    method: ASTMethod.DiskDiffusion,
    standard: "EUCAST",
    rawValue: 21,
  });
  const zone50 = buildASTResult(accession, {
    isolateId: "iso-paer",
    antibioticCode: "FEP",
    method: ASTMethod.DiskDiffusion,
    standard: "EUCAST",
    rawValue: 50,
  });

  assert(zone20.finalInterpretation === "R", `FEP 20 mm must be R, got ${zone20.finalInterpretation}`);
  assert(zone21.finalInterpretation === "I", `FEP 21 mm must be I, got ${zone21.finalInterpretation}`);
  assert(zone50.finalInterpretation === "I", `FEP 50 mm must remain I because EUCAST has no S category, got ${zone50.finalInterpretation}`);
}

// Cefepime MIC: EUCAST off-scale S≤0.001 / R>8 should also report I, not S, at the off-scale boundary.
{
  const micBoundary = buildASTResult(accession, {
    isolateId: "iso-paer",
    antibioticCode: "FEP",
    method: ASTMethod.MIC_Broth,
    standard: "EUCAST",
    rawValue: 0.001,
  });
  const micResistant = buildASTResult(accession, {
    isolateId: "iso-paer",
    antibioticCode: "FEP",
    method: ASTMethod.MIC_Broth,
    standard: "EUCAST",
    rawValue: 16,
  });

  assert(micBoundary.finalInterpretation === "I", `FEP MIC 0.001 must be I, got ${micBoundary.finalInterpretation}`);
  assert(micResistant.finalInterpretation === "R", `FEP MIC 16 must be R, got ${micResistant.finalInterpretation}`);
}

// eslint-disable-next-line no-console
console.log("EUCAST 2026 Pseudomonas tests passed.");
export {};