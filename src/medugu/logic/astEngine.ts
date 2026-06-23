// Phase-3 AST expert-rule engine.
// Pure, framework-agnostic. Consumes an Accession + isolate + AST rows and
// returns phenotype flags, fired rules, cascade decisions per row, and
// updated interpreted SIR. Engine never mutates input — callers persist
// the produced patches via the store.

import type {
  ASTResult,
  Accession,
  ExpertRuleFiring,
  Isolate,
  PhenotypeFlag,
} from "../domain/types";
import type { ASTInterpretation } from "../domain/enums";
import { getOrganism } from "../config/organisms";
import { getAntibiotic } from "../config/antibiotics";
import {
  evaluateIntrinsicResistance,
  formatIntrinsicResistanceMessage,
} from "../config/intrinsicResistance";
import { evaluateCascadeForIsolate } from "./cascadeEngine";

export interface IsolateRuleOutput {
  isolateId: string;
  phenotypeFlags: PhenotypeFlag[];
  fired: ExpertRuleFiring[];
  /** Patches per AST row id. */
  rowPatches: Record<string, Partial<ASTResult>>;
}

const nowIso = () => new Date().toISOString();

function fire(code: string, message: string, ruleVersion = "p3.0.0"): ExpertRuleFiring {
  return { ruleCode: code, message, firedAt: nowIso(), ruleVersion };
}

function rowsFor(ast: ASTResult[], isolateId: string): ASTResult[] {
  return ast.filter((r) => r.isolateId === isolateId);
}
function find(rows: ASTResult[], code: string): ASTResult | undefined {
  return rows.find((r) => r.antibioticCode === code);
}
function isR(r?: ASTResult): boolean {
  return (
    !!r &&
    (r.finalInterpretation === "R" || r.interpretedSIR === "R" || r.rawInterpretation === "R")
  );
}
function isS(r?: ASTResult): boolean {
  return (
    !!r &&
    (r.finalInterpretation === "S" || r.interpretedSIR === "S" || r.rawInterpretation === "S")
  );
}

export function evaluateIsolate(accession: Accession, isolate: Isolate): IsolateRuleOutput {
  const org = getOrganism(isolate.organismCode);
  const rows = rowsFor(accession.ast, isolate.id);
  const flags = new Set<PhenotypeFlag>();
  const fired: ExpertRuleFiring[] = [];
  const firedByRow: Record<string, ExpertRuleFiring[]> = {};
  const patches: Record<string, Partial<ASTResult>> = {};

  function patch(rowId: string, p: Partial<ASTResult>) {
    patches[rowId] = { ...(patches[rowId] ?? {}), ...p };
  }
  function addFlag(rowId: string, f: PhenotypeFlag) {
    flags.add(f);
    const row = rows.find((r) => r.id === rowId);
    const existing = [...(row?.phenotypeFlags ?? []), ...(patches[rowId]?.phenotypeFlags ?? [])];
    if (!existing.includes(f)) patch(rowId, { phenotypeFlags: [...existing, f] });
  }
  function suppress(row: ASTResult, by: PhenotypeFlag, newSIR: ASTInterpretation = "R") {
    patch(row.id, {
      interpretedSIR: newSIR,
      finalInterpretation: row.consultantOverride ? row.finalInterpretation : newSIR,
      cascade: "suppressed",
      cascadeDecision: "suppressed_by_phenotype",
      stewardshipNote: `Reported as ${newSIR} per ${by} rule`,
    });
  }
  function attachFiring(rowId: string, firing: ExpertRuleFiring) {
    const existing = firedByRow[rowId] ?? [];
    if (existing.some((item) => item.ruleCode === firing.ruleCode)) return;
    firedByRow[rowId] = [...existing, firing];
  }
  function recordFiring(
    code: string,
    message: string,
    rowIds: string[] = [],
    ruleVersion?: string,
  ): ExpertRuleFiring {
    const firing = fire(code, message, ruleVersion);
    fired.push(firing);
    for (const rowId of rowIds) attachFiring(rowId, firing);
    return firing;
  }

  if (!org) return { isolateId: isolate.id, phenotypeFlags: [], fired, rowPatches: patches };

  // ---- Expected resistant phenotype / intrinsic resistance safety layer
  // Runs before syndrome-specific expert rules so biologically impossible
  // susceptible calls never leak into cascade/report previews.
  for (const row of rows) {
    const intrinsic = evaluateIntrinsicResistance(org, row.antibioticCode);
    if (!intrinsic) continue;

    flags.add("intrinsic_R");
    addFlag(row.id, "intrinsic_R");
    suppress(row, "intrinsic_R", intrinsic.interpretation);
    const message = formatIntrinsicResistanceMessage(org, row.antibioticCode, intrinsic);
    patch(row.id, {
      stewardshipNote: message,
      cascadeReason: intrinsic.reason,
      cascadeRuleCode: intrinsic.ruleCode,
      cascadeRulesetVersion: intrinsic.ruleVersion,
    });
    recordFiring(intrinsic.ruleCode, message, [row.id], intrinsic.ruleVersion);
  }

  // ---- Staphylococcus aureus: MRSA / MSSA + ICR
  if (org.code === "SAUR") {
    const fox = find(rows, "FOX") ?? find(rows, "OXA");
    if (fox) {
      if (isR(fox)) {
        flags.add("MRSA");
        addFlag(fox.id, "MRSA");
        const firing = recordFiring(
          "STA_MRSA",
          "Cefoxitin/Oxacillin R -> MRSA: report all beta-lactams as R (except anti-MRSA agents).",
          [fox.id],
        );
        // Suppress beta-lactams except anti-MRSA agents
        for (const r of rows) {
          const cls = getAntibiotic(r.antibioticCode)?.class;
          if (
            (cls === "penicillin" || cls === "cephalosporin" || cls === "carbapenem") &&
            !["CRO", "FEP"].includes(r.antibioticCode) // ceftaroline-style anti-MRSA agents would be exempt
          ) {
            suppress(r, "MRSA", "R");
            attachFiring(r.id, firing);
          }
        }
      } else if (isS(fox)) {
        flags.add("MSSA");
        addFlag(fox.id, "MSSA");
        recordFiring("STA_MSSA", "Cefoxitin S -> MSSA: prefer beta-lactam therapy.", [fox.id]);
      }
    }
    // Inducible clindamycin resistance (D-test): ERY R + CLI S → ICR
    const ery = find(rows, "ERY");
    const cli = find(rows, "CLI");
    if (ery && cli && isR(ery) && isS(cli)) {
      flags.add("inducible_clindamycin_R");
      addFlag(cli.id, "inducible_clindamycin_R");
      recordFiring(
        "STA_ICR",
        "Erythromycin R + Clindamycin S -> suspect inducible clindamycin resistance (D-test). Report Clindamycin as R.",
        [ery.id, cli.id],
      );
      suppress(cli, "inducible_clindamycin_R", "R");
    }
  }

  // ---- Enterococcus: VRE / VSE
  if (org.group === "enterococcus") {
    const van = find(rows, "VAN");
    if (van) {
      if (isR(van)) {
        flags.add("VRE");
        addFlag(van.id, "VRE");
        recordFiring(
          "ENT_VRE",
          "Vancomycin R Enterococcus -> VRE; consider Linezolid/Daptomycin per stewardship.",
          [van.id],
        );
      } else if (isS(van)) {
        flags.add("VSE");
      }
    }
  }

  // ---- Enterobacterales: ESBL / AmpC / CRE
  if (org.group === "enterobacterales") {
    const cro = find(rows, "CRO");
    const caz = find(rows, "CAZ");
    const fep = find(rows, "FEP");
    const mem = find(rows, "MEM");
    const etp = find(rows, "ETP");

    // ESBL suspicion: CRO or CAZ R, FEP often R, carbapenems S
    if ((isR(cro) || isR(caz)) && !isR(mem) && !isR(etp)) {
      flags.add("ESBL");
      const target = cro ?? caz!;
      addFlag(target.id, "ESBL");
      const firing = recordFiring(
        "ENB_ESBL",
        "3rd-generation cephalosporin R, carbapenem S -> ESBL phenotype suspected. Report all penicillins/cephalosporins as R.",
        [target.id],
      );
      for (const r of rows) {
        const cls = getAntibiotic(r.antibioticCode)?.class;
        if (cls === "penicillin" || cls === "cephalosporin") {
          suppress(r, "ESBL", "R");
          attachFiring(r.id, firing);
        }
      }
    }

    // AmpC suspicion: FEP S but CRO/CAZ R (cefepime stable)
    if (isR(cro) && isS(fep) && !flags.has("ESBL")) {
      flags.add("AmpC_suspected");
      addFlag(cro!.id, "AmpC_suspected");
      recordFiring(
        "ENB_AMPC",
        "Ceftriaxone R, Cefepime S -> AmpC beta-lactamase suspected. Avoid 3rd-generation cephalosporins clinically.",
        [cro!.id, fep!.id],
      );
    }

    // CRE / carbapenemase suspicion
    if (isR(mem) || isR(etp)) {
      flags.add("CRE");
      flags.add("carbapenemase_suspected");
      const t = (mem ?? etp)!;
      addFlag(t.id, "CRE");
      addFlag(t.id, "carbapenemase_suspected");
      recordFiring(
        "ENB_CRE",
        "Carbapenem R Enterobacterales -> CRE; carbapenemase production suspected. IPC notification + stewardship review required.",
        [t.id],
      );
    }
  }

  // ---- Pseudomonas / Acinetobacter intrinsic + carbapenem-resistant flagging
  if (org.group === "non_fermenter") {
    const mem = find(rows, "MEM");
    if (isR(mem)) {
      flags.add("CRE"); // generalised carbapenem-R alert; specific code surfaces in IPC engine
      addFlag(mem!.id, "carbapenemase_suspected");
      recordFiring(
        "NF_CARB_R",
        `${org.display} carbapenem-resistant - IPC alert + stewardship review.`,
        [mem!.id],
      );
    }
  }

  // Apply phenotype patches to a synthetic accession view, then run the
  // cascade engine so selective-reporting decisions see the post-rule SIRs.
  const patchedAst = accession.ast.map((r) => (patches[r.id] ? { ...r, ...patches[r.id] } : r));
  const cascadeOut = evaluateCascadeForIsolate({ ...accession, ast: patchedAst }, isolate);
  for (const [rid, p] of Object.entries(cascadeOut.rowPatches)) {
    patch(rid, p);
  }

  // Default: rows still untouched get cascadeDecision "shown" + interpretedSIR mirror.
  for (const r of rows) {
    if (!patches[r.id]?.cascadeDecision && !r.cascadeDecision) {
      patch(r.id, { cascadeDecision: "shown" });
    }
    // Default interpretedSIR mirrors raw if engine did not override
    if (patches[r.id]?.interpretedSIR === undefined && r.interpretedSIR === undefined) {
      patch(r.id, { interpretedSIR: r.rawInterpretation });
    }
    // Attach fired rules to row patches that map to it
    const rowFired = firedByRow[r.id] ?? [];
    if (rowFired.length > 0) {
      const existing = r.expertRulesFired ?? [];
      const next = [...existing];
      for (const firing of rowFired) {
        if (!next.some((item) => item.ruleCode === firing.ruleCode)) next.push(firing);
      }
      patch(r.id, { expertRulesFired: next });
    }
  }

  return {
    isolateId: isolate.id,
    phenotypeFlags: Array.from(flags),
    fired,
    rowPatches: patches,
  };
}

export function evaluateAccession(accession: Accession): IsolateRuleOutput[] {
  return accession.isolates.map((iso) => evaluateIsolate(accession, iso));
}
