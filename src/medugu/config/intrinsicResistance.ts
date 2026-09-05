import { ANTIBIOTICS, getAntibiotic, type AntibioticClass } from "./antibiotics";
import type { ASTInterpretation } from "../domain/enums";
import type { OrganismDef } from "./organisms";

export const INTRINSIC_RESISTANCE_RULESET_VERSION = "expected-resistant-phenotypes-2026.1";

const SOURCE_LABEL = "EUCAST expected resistant phenotype / intrinsic resistance safety layer";

type OrganismMatcher = (organism: OrganismDef) => boolean;

interface IntrinsicResistanceRule {
  ruleCode: string;
  appliesToOrganism: OrganismMatcher;
  antibioticCodes?: readonly string[];
  antibioticClasses?: readonly AntibioticClass[];
  interpretation?: Extract<ASTInterpretation, "R" | "ND">;
  reason: string | ((organism: OrganismDef, antibioticDisplay: string) => string);
}

export interface IntrinsicResistanceMatch {
  ruleCode: string;
  ruleVersion: string;
  sourceLabel: string;
  interpretation: Extract<ASTInterpretation, "R" | "ND">;
  reason: string;
}

const allAntibioticCodes = ANTIBIOTICS.map((antibiotic) => antibiotic.code);

function codes(values: readonly string[]): readonly string[] {
  return values;
}

function classMatches(rule: IntrinsicResistanceRule, antibioticClass: AntibioticClass): boolean {
  return !!rule.antibioticClasses?.includes(antibioticClass);
}

function codeMatches(rule: IntrinsicResistanceRule, antibioticCode: string): boolean {
  return !!rule.antibioticCodes?.includes(antibioticCode);
}

function ruleMatchesAntibiotic(
  rule: IntrinsicResistanceRule,
  antibioticCode: string,
  antibioticClass: AntibioticClass,
): boolean {
  const hasCodeScope = !!rule.antibioticCodes;
  const hasClassScope = !!rule.antibioticClasses;
  if (!hasCodeScope && !hasClassScope) return true;
  return codeMatches(rule, antibioticCode) || classMatches(rule, antibioticClass);
}

function reasonText(
  rule: IntrinsicResistanceRule,
  organism: OrganismDef,
  antibioticDisplay: string,
): string {
  return typeof rule.reason === "function" ? rule.reason(organism, antibioticDisplay) : rule.reason;
}

const gramPositiveOnlyAgentClasses: AntibioticClass[] = [
  "glycopeptide",
  "lipopeptide",
  "oxazolidinone",
  "lincosamide",
  "streptogramin",
  "fusidane",
  "topical",
];

const gramNegativeOnlyAgentCodes = codes(["ATM", "CST", "CAZ", "TOL", "CZA", "CFD"]);

const cephalosporinAndRelatedCodes = codes([
  "CXM",
  "CRO",
  "CTX",
  "CAZ",
  "FEP",
  "CFM",
  "FOX",
  "TOL",
  "CZA",
  "CFD",
]);

const RULES: IntrinsicResistanceRule[] = [
  {
    ruleCode: "NO_AST_TARGET",
    appliesToOrganism: (organism) => organism.noAst === true,
    antibioticCodes: allAntibioticCodes,
    interpretation: "ND",
    reason:
      "No-growth, mixed-growth and normal-flora summary entries must not carry antibacterial susceptibility rows.",
  },
  {
    ruleCode: "NON_BACTERIAL_ANTIBACTERIAL_AST",
    appliesToOrganism: (organism) =>
      organism.gram === "yeast" || organism.gram === "afb" || organism.group === "candida",
    antibioticCodes: allAntibioticCodes,
    interpretation: "ND",
    reason:
      "The selected organism is not a bacterial AST target for this antibacterial panel; use the appropriate specialist susceptibility workflow.",
  },
  {
    ruleCode: "KPNE_INTRINSIC_AMINOPENICILLIN_R",
    appliesToOrganism: (organism) => organism.code === "KPNE",
    antibioticCodes: codes(["PEN", "BPN", "AMP", "AMX"]),
    reason:
      "Klebsiella pneumoniae is expected resistant to aminopenicillins/penicillin because of intrinsic beta-lactamase activity.",
  },
  {
    ruleCode: "ENTC_INTRINSIC_BASELINE_BETALACTAM_R",
    appliesToOrganism: (organism) => organism.code === "ENTC",
    antibioticCodes: codes(["PEN", "BPN", "AMP", "AMX", "AMC", "FOX"]),
    reason:
      "Enterobacter cloacae complex has inducible chromosomal AmpC activity; these baseline beta-lactams should not be reported susceptible.",
  },
  {
    ruleCode: "PMIR_INTRINSIC_PROTEAE_R",
    appliesToOrganism: (organism) => organism.code === "PMIR",
    antibioticCodes: codes(["CST", "TGC", "NIT", "TET", "DOX", "MIN"]),
    reason:
      "Proteus mirabilis is expected resistant to Proteae-intrinsic agents such as colistin, tigecycline, nitrofurantoin and tetracyclines.",
  },
  {
    ruleCode: "PAER_INTRINSIC_NARROW_OR_ORAL_AGENT_R",
    appliesToOrganism: (organism) => organism.code === "PAER",
    antibioticCodes: codes([
      "PEN",
      "BPN",
      "AMP",
      "AMX",
      "AMC",
      "CXM",
      "CRO",
      "CTX",
      "CFM",
      "FOX",
      "ETP",
      "TGC",
      "TET",
      "DOX",
      "MIN",
      "SXT",
      "CHL",
      "NIT",
      "FOS",
    ]),
    reason:
      "Pseudomonas aeruginosa is expected resistant to these narrow, oral or non-pseudomonal agents.",
  },
  {
    ruleCode: "ABAU_INTRINSIC_NON_ACINETOBACTER_AGENT_R",
    appliesToOrganism: (organism) => organism.code === "ABAU",
    antibioticCodes: codes([
      "PEN",
      "BPN",
      "AMP",
      "AMX",
      "AMC",
      "CXM",
      "CRO",
      "CTX",
      "CFM",
      "FOX",
      "ETP",
      "ATM",
      "NIT",
      "FOS",
    ]),
    reason:
      "Acinetobacter baumannii complex is expected resistant to these non-Acinetobacter agents.",
  },
  {
    ruleCode: "MCAT_INTRINSIC_AMINOPENICILLIN_R",
    appliesToOrganism: (organism) => organism.code === "MCAT",
    antibioticCodes: codes(["PEN", "BPN", "AMP", "AMX"]),
    reason:
      "Moraxella catarrhalis is expected resistant to penicillin/aminopenicillins because beta-lactamase production is the expected phenotype.",
  },
  {
    ruleCode: "ENTEROCOCCUS_INTRINSIC_CEPH_MONO_POLY_R",
    appliesToOrganism: (organism) => organism.group === "enterococcus",
    antibioticCodes: cephalosporinAndRelatedCodes,
    reason:
      "Enterococci are expected resistant to cephalosporins and related gram-negative cephalosporin agents.",
  },
  {
    ruleCode: "ENTEROCOCCUS_INTRINSIC_NON_SYNERGY_AG_R",
    appliesToOrganism: (organism) => organism.group === "enterococcus",
    antibioticCodes: codes(["GEN", "AMK", "TOB"]),
    reason:
      "Enterococci have intrinsic low-level aminoglycoside resistance; report high-level synergy screens instead of ordinary aminoglycoside susceptibility.",
  },
  {
    ruleCode: "ENTEROCOCCUS_INTRINSIC_CLI_SXT_R",
    appliesToOrganism: (organism) => organism.group === "enterococcus",
    antibioticCodes: codes(["CLI", "SXT"]),
    reason:
      "Enterococci should not be reported susceptible to clindamycin or trimethoprim/sulfamethoxazole for routine therapy.",
  },
  {
    ruleCode: "EFAE_INTRINSIC_QDA_R",
    appliesToOrganism: (organism) => organism.code === "EFAE",
    antibioticCodes: codes(["QDA"]),
    reason: "Enterococcus faecalis is expected resistant to quinupristin/dalfopristin.",
  },
  {
    ruleCode: "GRAM_NEGATIVE_INTRINSIC_GRAM_POSITIVE_AGENT_R",
    appliesToOrganism: (organism) => organism.gram === "gram_negative",
    antibioticClasses: gramPositiveOnlyAgentClasses,
    reason: (organism, antibioticDisplay) =>
      `${organism.display} is Gram-negative; ${antibioticDisplay} is a Gram-positive-only or topical agent and should not be reported susceptible.`,
  },
  {
    ruleCode: "GRAM_POSITIVE_INTRINSIC_GRAM_NEGATIVE_AGENT_R",
    appliesToOrganism: (organism) => organism.gram === "gram_positive",
    antibioticCodes: gramNegativeOnlyAgentCodes,
    antibioticClasses: ["monobactam", "polymyxin", "siderophore_cephalosporin"],
    reason: (organism, antibioticDisplay) =>
      `${organism.display} is Gram-positive; ${antibioticDisplay} is a Gram-negative-only agent and should not be reported susceptible.`,
  },
];

export function evaluateIntrinsicResistance(
  organism: OrganismDef | undefined,
  antibioticCode: string,
): IntrinsicResistanceMatch | null {
  if (!organism) return null;

  const normalizedCode = antibioticCode.toUpperCase();
  const antibiotic = getAntibiotic(normalizedCode);
  if (!antibiotic) return null;

  const rule = RULES.find((candidate) => {
    if (!candidate.appliesToOrganism(organism)) return false;
    return ruleMatchesAntibiotic(candidate, normalizedCode, antibiotic.class);
  });

  if (!rule) return null;

  return {
    ruleCode: rule.ruleCode,
    ruleVersion: INTRINSIC_RESISTANCE_RULESET_VERSION,
    sourceLabel: SOURCE_LABEL,
    interpretation: rule.interpretation ?? "R",
    reason: reasonText(rule, organism, antibiotic.display),
  };
}

export function formatIntrinsicResistanceMessage(
  organism: OrganismDef,
  antibioticCode: string,
  match: IntrinsicResistanceMatch,
): string {
  const antibiotic = getAntibiotic(antibioticCode);
  const drug = antibiotic?.display ?? antibioticCode;
  const result = match.interpretation === "ND" ? "not determined / not applicable" : "R";
  return `${organism.display} + ${drug}: forced to ${result}. ${match.reason}`;
}
