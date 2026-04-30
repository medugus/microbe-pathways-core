// Selective / cascading reporting rule tables.
//
// Architecture mirrors the breakpoint registry: pure data, keyed by
// (organism group × standard). The cascade engine consumes these rules
// and never embeds policy of its own.
//
// Tier semantics:
//   - Tier 1 = first-line agents always reported.
//   - Tier 2+ = cascaded agents, suppressed on the released report when
//     ANY first-line agent in the same therapeutic class is susceptible.
//   - Tier U = urinary-only agents (already gated by indication breakpoints).
//
// Suppression is "show with note" by default — the row remains visible to
// lab/AMS staff, flagged with a human-readable reason. Override is allowed
// per-row via the consultantOverride mechanism with a documented reason
// (logged to audit_event by the UI layer).

import type { ASTStandard } from "../../domain/types";

export type CascadeOrganismGroup = "enterobacterales" | "staphylococcus";

export interface CascadeRule {
  /** Cascaded (2nd-line) drug code. */
  drug: string;
  /** Tier label, used for UI grouping and audit. */
  tier: 2 | 3;
  /** First-line drug codes whose Susceptible result suppresses this drug.
   *  Suppression fires if ANY trigger drug is reported S (raw, interpreted,
   *  or final). */
  suppressIfSusceptible: string[];
  /** Human-readable reason shown alongside the suppressed row. */
  reason: string;
  /** Reference for audit/governance. */
  ruleCode: string;
}

export interface CascadeRuleSet {
  group: CascadeOrganismGroup;
  standard: ASTStandard;
  version: string;
  rules: CascadeRule[];
}

// ---------- EUCAST v3.2 / v16.0 selective reporting (2026) ----------

const EUCAST_ENTEROBACTERALES: CascadeRuleSet = {
  group: "enterobacterales",
  standard: "EUCAST",
  version: "EUCAST Selective Reporting v3.2 / v16.0 (2026)",
  rules: [
    {
      drug: "TZP",
      tier: 2,
      suppressIfSusceptible: ["AMC"],
      reason: "Amoxicillin/clavulanate susceptible — broader β-lactam/β-lactamase inhibitor not routinely reported.",
      ruleCode: "EUCAST_ENB_TZP_CASCADE",
    },
    {
      drug: "FEP",
      tier: 2,
      suppressIfSusceptible: ["CRO", "CAZ"],
      reason: "3rd-generation cephalosporin susceptible — 4th-generation cephalosporin not routinely reported.",
      ruleCode: "EUCAST_ENB_FEP_CASCADE",
    },
    {
      drug: "MEM",
      tier: 3,
      suppressIfSusceptible: ["CRO", "CAZ", "FEP", "TZP", "AMC"],
      reason: "Susceptible β-lactam alternative available — carbapenem reserved per stewardship.",
      ruleCode: "EUCAST_ENB_MEM_CASCADE",
    },
    {
      drug: "ETP",
      tier: 3,
      suppressIfSusceptible: ["CRO", "CAZ", "FEP", "TZP", "AMC"],
      reason: "Susceptible β-lactam alternative available — carbapenem reserved per stewardship.",
      ruleCode: "EUCAST_ENB_ETP_CASCADE",
    },
    {
      drug: "AMK",
      tier: 2,
      suppressIfSusceptible: ["GEN"],
      reason: "Gentamicin susceptible — extended-spectrum aminoglycoside not routinely reported.",
      ruleCode: "EUCAST_ENB_AMK_CASCADE",
    },
    {
      drug: "LVX",
      tier: 2,
      suppressIfSusceptible: ["CIP"],
      reason: "Ciprofloxacin susceptible — alternate fluoroquinolone redundant for routine reporting.",
      ruleCode: "EUCAST_ENB_LVX_CASCADE",
    },
  ],
};

const EUCAST_STAPHYLOCOCCUS: CascadeRuleSet = {
  group: "staphylococcus",
  standard: "EUCAST",
  version: "EUCAST Selective Reporting v3.2 / v16.0 (2026)",
  rules: [
    {
      drug: "LVX",
      tier: 2,
      suppressIfSusceptible: ["CIP"],
      reason: "Ciprofloxacin susceptible — alternate fluoroquinolone not routinely reported.",
      ruleCode: "EUCAST_STA_LVX_CASCADE",
    },
    {
      drug: "TEC",
      tier: 2,
      suppressIfSusceptible: ["VAN"],
      reason: "Vancomycin susceptible — teicoplanin not routinely reported (reserve for intolerance).",
      ruleCode: "EUCAST_STA_TEC_CASCADE",
    },
    {
      drug: "LZD",
      tier: 3,
      suppressIfSusceptible: ["VAN"],
      reason: "Vancomycin susceptible — linezolid reserved per stewardship.",
      ruleCode: "EUCAST_STA_LZD_CASCADE",
    },
  ],
};

// ---------- CLSI M100 selective reporting (Appendix A — tiered) ----------

const CLSI_ENTEROBACTERALES: CascadeRuleSet = {
  group: "enterobacterales",
  standard: "CLSI",
  version: "CLSI M100 Appendix A (Tier 2 selective reporting)",
  rules: [
    {
      drug: "TZP",
      tier: 2,
      suppressIfSusceptible: ["AMC", "AMP"],
      reason: "Tier-1 β-lactam susceptible — Tier-2 β-lactam/β-lactamase inhibitor cascaded per CLSI M100 App. A.",
      ruleCode: "CLSI_ENB_TZP_CASCADE",
    },
    {
      drug: "FEP",
      tier: 2,
      suppressIfSusceptible: ["CRO", "CAZ"],
      reason: "Tier-1 cephalosporin susceptible — Tier-2 cefepime cascaded per CLSI M100 App. A.",
      ruleCode: "CLSI_ENB_FEP_CASCADE",
    },
    {
      drug: "MEM",
      tier: 3,
      suppressIfSusceptible: ["CRO", "CAZ", "FEP", "TZP"],
      reason: "Tier-1/2 β-lactam susceptible — Tier-3 carbapenem cascaded per CLSI M100 App. A.",
      ruleCode: "CLSI_ENB_MEM_CASCADE",
    },
    {
      drug: "ETP",
      tier: 3,
      suppressIfSusceptible: ["CRO", "CAZ", "FEP", "TZP"],
      reason: "Tier-1/2 β-lactam susceptible — Tier-3 carbapenem cascaded per CLSI M100 App. A.",
      ruleCode: "CLSI_ENB_ETP_CASCADE",
    },
    {
      drug: "AMK",
      tier: 2,
      suppressIfSusceptible: ["GEN"],
      reason: "Gentamicin susceptible — amikacin cascaded per CLSI M100 App. A.",
      ruleCode: "CLSI_ENB_AMK_CASCADE",
    },
    {
      drug: "LVX",
      tier: 2,
      suppressIfSusceptible: ["CIP"],
      reason: "Ciprofloxacin susceptible — levofloxacin cascaded per CLSI M100 App. A.",
      ruleCode: "CLSI_ENB_LVX_CASCADE",
    },
  ],
};

const CLSI_STAPHYLOCOCCUS: CascadeRuleSet = {
  group: "staphylococcus",
  standard: "CLSI",
  version: "CLSI M100 Appendix A (Tier 2 selective reporting)",
  rules: [
    {
      drug: "LVX",
      tier: 2,
      suppressIfSusceptible: ["CIP"],
      reason: "Ciprofloxacin susceptible — levofloxacin cascaded per CLSI M100 App. A.",
      ruleCode: "CLSI_STA_LVX_CASCADE",
    },
    {
      drug: "TEC",
      tier: 2,
      suppressIfSusceptible: ["VAN"],
      reason: "Vancomycin susceptible — teicoplanin cascaded per CLSI M100 App. A.",
      ruleCode: "CLSI_STA_TEC_CASCADE",
    },
    {
      drug: "LZD",
      tier: 3,
      suppressIfSusceptible: ["VAN"],
      reason: "Vancomycin susceptible — linezolid cascaded per CLSI M100 App. A.",
      ruleCode: "CLSI_STA_LZD_CASCADE",
    },
  ],
};

const REGISTRY: CascadeRuleSet[] = [
  EUCAST_ENTEROBACTERALES,
  EUCAST_STAPHYLOCOCCUS,
  CLSI_ENTEROBACTERALES,
  CLSI_STAPHYLOCOCCUS,
];

export function getCascadeRules(
  group: string | undefined,
  standard: ASTStandard,
): CascadeRuleSet | undefined {
  if (group !== "enterobacterales" && group !== "staphylococcus") return undefined;
  return REGISTRY.find((r) => r.group === group && r.standard === standard);
}
