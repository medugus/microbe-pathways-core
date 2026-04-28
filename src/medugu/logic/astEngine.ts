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

export interface IsolateRuleOutput {
  isolateId: string;
  phenotypeFlags: PhenotypeFlag[];
  fired: ExpertRuleFiring[];
  /** Patches per AST row id. */
  rowPatches: Record<string, Partial<ASTResult>>;
}

const nowIso = () => new Date().toISOString();

function fire(code: string, message: string): ExpertRuleFiring {
  return { ruleCode: code, message, firedAt: nowIso(), ruleVersion: "p3.0.0" };
}

function rowsFor(ast: ASTResult[], isolateId: string): ASTResult[] {
  return ast.filter((r) => r.isolateId === isolateId);
}
function find(rows: ASTResult[], code: string): ASTResult | undefined {
  return rows.find((r) => r.antibioticCode === code);
}
function isR(r?: ASTResult): boolean {
  return !!r && (r.finalInterpretation === "R" || r.interpretedSIR === "R" || r.rawInterpretation === "R");
}
function isS(r?: ASTResult): boolean {
  return !!r && (r.finalInterpretation === "S" || r.interpretedSIR === "S" || r.rawInterpretation === "S");
}

export function evaluateIsolate(accession: Accession, isolate: Isolate): IsolateRuleOutput {
  const org = getOrganism(isolate.organismCode);
  const rows = rowsFor(accession.ast, isolate.id);
  const flags = new Set<PhenotypeFlag>();
  const fired: ExpertRuleFiring[] = [];
  const patches: Record<string, Partial<ASTResult>> = {};

  function patch(rowId: string, p: Partial<ASTResult>) {
    patches[rowId] = { ...(patches[rowId] ?? {}), ...p };
  }
  function addFlag(rowId: string, f: PhenotypeFlag) {
    flags.add(f);
    const existing = patches[rowId]?.phenotypeFlags ?? [];
    if (!existing.includes(f)) patch(rowId, { phenotypeFlags: [...existing, f] });
  }
  function suppress(row: ASTResult, by: PhenotypeFlag, newSIR: ASTInterpretation = "R") {
    patch(row.id, {
      interpretedSIR: newSIR,
      finalInterpretation: row.consultantOverride ? row.finalInterpretation : newSIR,
      cascadeDecision: "suppressed_by_phenotype",
      stewardshipNote: `Reported as ${newSIR} per ${by} rule`,
    });
  }

  if (!org) return { isolateId: isolate.id, phenotypeFlags: [], fired, rowPatches: patches };

  // ---- Staphylococcus aureus: MRSA / MSSA + ICR
  if (org.code === "SAUR") {
    const fox = find(rows, "FOX") ?? find(rows, "OXA");
    if (fox) {
      if (isR(fox)) {
        flags.add("MRSA");
        addFlag(fox.id, "MRSA");
        fired.push(fire("STA_MRSA", "Cefoxitin/Oxacillin R → MRSA: report all β-lactams as R (except anti-MRSA agents)."));
        // Suppress beta-lactams except anti-MRSA agents
        for (const r of rows) {
          const cls = getAntibiotic(r.antibioticCode)?.class;
          if (
            (cls === "penicillin" || cls === "cephalosporin" || cls === "carbapenem") &&
            !["CRO", "FEP"].includes(r.antibioticCode) // ceftaroline-style anti-MRSA agents would be exempt
          ) {
            suppress(r, "MRSA", "R");
          }
        }
      } else if (isS(fox)) {
        flags.add("MSSA");
        addFlag(fox.id, "MSSA");
        fired.push(fire("STA_MSSA", "Cefoxitin S → MSSA: prefer β-lactam therapy."));
      }
    }
    // Inducible clindamycin resistance (D-test): ERY R + CLI S → ICR
    const ery = find(rows, "ERY");
    const cli = find(rows, "CLI");
    if (ery && cli && isR(ery) && isS(cli)) {
      flags.add("inducible_clindamycin_R");
      addFlag(cli.id, "inducible_clindamycin_R");
      fired.push(fire("STA_ICR", "Erythromycin R + Clindamycin S → suspect inducible clindamycin resistance (D-test). Report Clindamycin as R."));
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
        fired.push(fire("ENT_VRE", "Vancomycin R Enterococcus → VRE; consider Linezolid/Daptomycin per stewardship."));
      } else if (isS(van)) {
        flags.add("VSE");
      }
    }
    // Intrinsic: Enterococci intrinsically R to cephalosporins
    for (const r of rows) {
      if (getAntibiotic(r.antibioticCode)?.class === "cephalosporin") {
        flags.add("intrinsic_R");
        addFlag(r.id, "intrinsic_R");
        suppress(r, "intrinsic_R", "R");
        fired.push(fire("ENT_INTRINSIC_CEPH", `Enterococci are intrinsically resistant to cephalosporins — ${r.antibioticCode} reported R.`));
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
      fired.push(fire("ENB_ESBL", "3rd-generation cephalosporin R, carbapenem S → ESBL phenotype suspected. Report all penicillins/cephalosporins as R."));
      for (const r of rows) {
        const cls = getAntibiotic(r.antibioticCode)?.class;
        if (cls === "penicillin" || cls === "cephalosporin") suppress(r, "ESBL", "R");
      }
    }

    // AmpC suspicion: FEP S but CRO/CAZ R (cefepime stable)
    if (isR(cro) && isS(fep) && !flags.has("ESBL")) {
      flags.add("AmpC_suspected");
      addFlag(cro!.id, "AmpC_suspected");
      fired.push(fire("ENB_AMPC", "Ceftriaxone R, Cefepime S → AmpC β-lactamase suspected. Avoid 3rd-generation cephalosporins clinically."));
    }

    // CRE / carbapenemase suspicion
    if (isR(mem) || isR(etp)) {
      flags.add("CRE");
      flags.add("carbapenemase_suspected");
      const t = (mem ?? etp)!;
      addFlag(t.id, "CRE");
      addFlag(t.id, "carbapenemase_suspected");
      fired.push(fire("ENB_CRE", "Carbapenem R Enterobacterales → CRE; carbapenemase production suspected. IPC notification + stewardship review required."));
    }
  }

  // ---- Pseudomonas / Acinetobacter intrinsic + carbapenem-resistant flagging
  if (org.group === "non_fermenter") {
    const mem = find(rows, "MEM");
    if (isR(mem)) {
      flags.add("CRE"); // generalised carbapenem-R alert; specific code surfaces in IPC engine
      addFlag(mem!.id, "carbapenemase_suspected");
      fired.push(fire("NF_CARB_R", `${org.display} carbapenem-resistant — IPC alert + stewardship review.`));
    }
  }

  // ---- Unusual antibiogram heuristic: any S that is biologically improbable
  // (placeholder rule: E. coli reported as Vancomycin S would be unusual.)
  if (org.group === "enterobacterales") {
    const van = find(rows, "VAN");
    if (van && isS(van)) {
      flags.add("unusual_antibiogram");
      addFlag(van.id, "unusual_antibiogram");
      fired.push(fire("UNUSUAL_GLYCO_GN", "Glycopeptide reported S against gram-negative — biologically implausible; verify ID/AST."));
    }
  }

  // Default: rows not touched get cascadeDecision "shown"
  for (const r of rows) {
    if (!patches[r.id]?.cascadeDecision && !r.cascadeDecision) {
      patch(r.id, { cascadeDecision: "shown" });
    }
    // Default interpretedSIR mirrors raw if engine did not override
    if (patches[r.id]?.interpretedSIR === undefined && r.interpretedSIR === undefined) {
      patch(r.id, { interpretedSIR: r.rawInterpretation });
    }
    // Attach fired rules to row patches that map to it
    const rowFired = fired.filter((f) =>
      Object.entries(patches).some(([rid, p]) => rid === r.id && (p.phenotypeFlags ?? []).length > 0 && f.ruleCode.length > 0),
    );
    if (rowFired.length > 0) {
      patch(r.id, { expertRulesFired: [...(r.expertRulesFired ?? []), ...rowFired] });
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
