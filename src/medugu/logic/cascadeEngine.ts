// Selective / cascading reporting engine.
//
// Pure logic. Evaluates each isolate's AST rows against the cascade rule
// table for (organism group × standard) and emits patches that mark
// 2nd/3rd-line agents as `hidden_until_promoted` with a human-readable
// suppression note. Phenotype-driven suppression from astEngine is left
// untouched (those rows already carry `suppressed_by_phenotype`).
//
// Manual override is honoured: if a row has cascadeOverride.released === true
// the engine clears the cascade decision back to "shown" while preserving
// the audit trail in cascadeOverride.

import type { ASTResult, Accession, Isolate } from "../domain/types";
import { getOrganism } from "../config/organisms";
import { getCascadeRules, type CascadeRule } from "../config/cascadeRules";

export interface CascadeEvaluation {
  isolateId: string;
  /** Patches per AST row id — caller merges into existing engine patches. */
  rowPatches: Record<string, Partial<ASTResult>>;
  /** Rules that fired against this isolate (audit). */
  fired: Array<{ ruleCode: string; drug: string; reason: string; triggers: string[] }>;
}

function isS(r: ASTResult | undefined): boolean {
  if (!r) return false;
  const v = r.finalInterpretation ?? r.interpretedSIR ?? r.rawInterpretation;
  return v === "S";
}

function findRow(rows: ASTResult[], code: string): ASTResult | undefined {
  return rows.find((r) => r.antibioticCode === code);
}

export function evaluateCascadeForIsolate(
  accession: Accession,
  isolate: Isolate,
): CascadeEvaluation {
  const out: CascadeEvaluation = { isolateId: isolate.id, rowPatches: {}, fired: [] };
  const org = getOrganism(isolate.organismCode);
  if (!org) return out;

  const rows = accession.ast.filter((r) => r.isolateId === isolate.id);
  if (rows.length === 0) return out;

  // Cascade ruleset is keyed by the standard active on each row. In practice
  // a single panel uses one standard, but resolve per-row to be safe.
  for (const row of rows) {
    // Skip rows already suppressed by a phenotype rule — that decision wins.
    if (row.cascadeDecision === "suppressed_by_phenotype") continue;

    const ruleset = getCascadeRules(org.group, row.standard);
    if (!ruleset) {
      // No cascade rules for this group/standard — ensure decision is "shown".
      if (!row.cascadeDecision) {
        out.rowPatches[row.id] = {
          ...(out.rowPatches[row.id] ?? {}),
          cascadeDecision: "shown",
        };
      }
      continue;
    }

    const rule: CascadeRule | undefined = ruleset.rules.find(
      (r) => r.drug === row.antibioticCode,
    );

    // Honour manual override (clinician/lab released the cascaded drug anyway).
    if (row.cascadeOverride?.released) {
      out.rowPatches[row.id] = {
        ...(out.rowPatches[row.id] ?? {}),
        cascadeDecision: "shown",
        cascade: "primary",
      };
      continue;
    }

    if (!rule) {
      // Tier-1 (always reported) drug — make sure it shows.
      if (!row.cascadeDecision) {
        out.rowPatches[row.id] = {
          ...(out.rowPatches[row.id] ?? {}),
          cascadeDecision: "shown",
        };
      }
      continue;
    }

    // Cascade-tier drug. Suppress when ANY trigger drug is reported S.
    const susceptibleTriggers = rule.suppressIfSusceptible.filter((code) =>
      isS(findRow(rows, code)),
    );

    if (susceptibleTriggers.length > 0) {
      out.rowPatches[row.id] = {
        ...(out.rowPatches[row.id] ?? {}),
        cascadeDecision: "hidden_until_promoted",
        cascade: "suppressed",
        cascadeReason: `${rule.reason} (Trigger: ${susceptibleTriggers.join(", ")} S — ${ruleset.version})`,
        cascadeRuleCode: rule.ruleCode,
        cascadeRulesetVersion: ruleset.version,
      };
      out.fired.push({
        ruleCode: rule.ruleCode,
        drug: rule.drug,
        reason: rule.reason,
        triggers: susceptibleTriggers,
      });
    } else {
      // Cascade-tier drug, but no trigger is S → promote to shown.
      out.rowPatches[row.id] = {
        ...(out.rowPatches[row.id] ?? {}),
        cascadeDecision: "shown",
        cascade: "cascaded",
        cascadeReason: undefined,
        cascadeRuleCode: undefined,
      };
    }
  }

  return out;
}

export function evaluateCascadeForAccession(accession: Accession): CascadeEvaluation[] {
  return accession.isolates.map((iso) => evaluateCascadeForIsolate(accession, iso));
}
