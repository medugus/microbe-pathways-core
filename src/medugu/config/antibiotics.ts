// Antibiotic dictionary — coded reference for AST entry.
// Logic-bearing properties (class, route) live here so engines do not re-derive them.

export type AntibioticClass =
  | "penicillin"
  | "cephalosporin"
  | "carbapenem"
  | "aminoglycoside"
  | "fluoroquinolone"
  | "glycopeptide"
  | "macrolide"
  | "lincosamide"
  | "tetracycline"
  | "sulfonamide"
  | "polymyxin"
  | "oxazolidinone"
  | "nitrofuran"
  | "fosfomycin"
  | "other";

export interface AntibioticDef {
  code: string;
  display: string;
  class: AntibioticClass;
  /** Restricted/protected agent — flagged by stewardship engine in later phases. */
  restricted?: boolean;
}

export const ANTIBIOTICS: AntibioticDef[] = [
  { code: "AMP",  display: "Ampicillin",            class: "penicillin" },
  { code: "AMC",  display: "Amoxicillin/clavulanate", class: "penicillin" },
  { code: "TZP",  display: "Piperacillin/tazobactam", class: "penicillin", restricted: true },
  { code: "CXM",  display: "Cefuroxime",            class: "cephalosporin" },
  { code: "CRO",  display: "Ceftriaxone",           class: "cephalosporin", restricted: true },
  { code: "CAZ",  display: "Ceftazidime",           class: "cephalosporin", restricted: true },
  { code: "FEP",  display: "Cefepime",              class: "cephalosporin", restricted: true },
  { code: "MEM",  display: "Meropenem",             class: "carbapenem", restricted: true },
  { code: "ETP",  display: "Ertapenem",             class: "carbapenem", restricted: true },
  { code: "GEN",  display: "Gentamicin",            class: "aminoglycoside" },
  { code: "AMK",  display: "Amikacin",              class: "aminoglycoside", restricted: true },
  { code: "CIP",  display: "Ciprofloxacin",         class: "fluoroquinolone" },
  { code: "LVX",  display: "Levofloxacin",          class: "fluoroquinolone" },
  { code: "VAN",  display: "Vancomycin",            class: "glycopeptide", restricted: true },
  { code: "TEC",  display: "Teicoplanin",           class: "glycopeptide", restricted: true },
  { code: "LZD",  display: "Linezolid",             class: "oxazolidinone", restricted: true },
  { code: "CLI",  display: "Clindamycin",           class: "lincosamide" },
  { code: "ERY",  display: "Erythromycin",          class: "macrolide" },
  { code: "TET",  display: "Tetracycline",          class: "tetracycline" },
  { code: "SXT",  display: "Trimethoprim/sulfamethoxazole", class: "sulfonamide" },
  { code: "CST",  display: "Colistin",              class: "polymyxin", restricted: true },
  { code: "NIT",  display: "Nitrofurantoin",        class: "nitrofuran" },
  { code: "FOS",  display: "Fosfomycin",            class: "fosfomycin" },
];

const CODE_SET = new Set(ANTIBIOTICS.map((a) => a.code));

const REQUESTED_NAME_TO_CODE: Record<string, string> = {
  ampicillin: "AMP",
  "amoxicillin-clavulanate": "AMC",
  "piperacillin-tazobactam": "TZP",
  cefuroxime: "CXM",
  ceftriaxone: "CRO",
  ceftazidime: "CAZ",
  cefepime: "FEP",
  meropenem: "MEM",
  ertapenem: "ETP",
  gentamicin: "GEN",
  amikacin: "AMK",
  ciprofloxacin: "CIP",
  levofloxacin: "LVX",
  vancomycin: "VAN",
  teicoplanin: "TEC",
  linezolid: "LZD",
  clindamycin: "CLI",
  erythromycin: "ERY",
  tetracycline: "TET",
  "trimethoprim-sulfamethoxazole": "SXT",
  colistin: "CST",
  nitrofurantoin: "NIT",
  fosfomycin: "FOS",
};

export interface ASTPanelDef {
  id:
    | "staphylococcus"
    | "streptococcus"
    | "enterococcus"
    | "enterobacterales"
    | "urine_enterobacterales"
    | "nonfermenters"
    | "reserve_cre"
    | "other";
  label: string;
  codes: string[];
  missingRequested: string[];
  allowedOrganismGroups?: Array<
    "enterobacterales" | "non_fermenter" | "staphylococcus" | "streptococcus" | "enterococcus" | "candida" | "other"
  >;
}

function makePanel(
  id: ASTPanelDef["id"],
  label: string,
  requested: string[],
  allowedOrganismGroups?: ASTPanelDef["allowedOrganismGroups"],
): ASTPanelDef {
  const uniqueRequested = Array.from(new Set(requested));
  const codes = uniqueRequested
    .map((name) => REQUESTED_NAME_TO_CODE[name])
    .filter((code): code is string => Boolean(code) && CODE_SET.has(code));

  const missingRequested = uniqueRequested.filter((name) => {
    const mapped = REQUESTED_NAME_TO_CODE[name];
    return !mapped || !CODE_SET.has(mapped);
  });

  return { id, label, codes, missingRequested, allowedOrganismGroups };
}

export const AST_PANELS: ASTPanelDef[] = [
  makePanel("staphylococcus", "Staphylococcus panel", [
    "penicillin", "cefoxitin", "oxacillin", "erythromycin", "clindamycin", "gentamicin", "ciprofloxacin",
    "levofloxacin", "trimethoprim-sulfamethoxazole", "tetracycline", "doxycycline", "rifampicin", "fusidic acid",
    "mupirocin", "vancomycin", "teicoplanin", "linezolid", "daptomycin",
  ], ["staphylococcus"]),
  makePanel("streptococcus", "Streptococcus panel", [
    "penicillin", "ampicillin", "amoxicillin-clavulanate", "ceftriaxone", "cefotaxime", "cefepime", "meropenem",
    "erythromycin", "clindamycin", "levofloxacin", "moxifloxacin", "tetracycline", "trimethoprim-sulfamethoxazole",
    "vancomycin", "linezolid", "chloramphenicol", "rifampicin", "gentamicin",
  ], ["streptococcus"]),
  makePanel("enterococcus", "Enterococcus panel", [
    "ampicillin", "penicillin", "vancomycin", "teicoplanin", "linezolid", "daptomycin", "tigecycline",
    "nitrofurantoin", "fosfomycin", "ciprofloxacin", "levofloxacin", "tetracycline", "doxycycline", "chloramphenicol",
    "high-level gentamicin", "high-level streptomycin", "quinupristin-dalfopristin", "rifampicin",
  ], ["enterococcus"]),
  makePanel("enterobacterales", "Enterobacterales panel", [
    "ampicillin", "amoxicillin-clavulanate", "piperacillin-tazobactam", "cefuroxime", "ceftriaxone", "cefotaxime",
    "ceftazidime", "cefepime", "aztreonam", "ertapenem", "meropenem", "imipenem", "amikacin", "gentamicin",
    "ciprofloxacin", "levofloxacin", "trimethoprim-sulfamethoxazole", "tigecycline",
  ], ["enterobacterales"]),
  makePanel("urine_enterobacterales", "Urine Enterobacterales panel", [
    "ampicillin", "amoxicillin-clavulanate", "cefuroxime", "cefixime", "cefpodoxime", "ceftriaxone", "ceftazidime",
    "cefepime", "piperacillin-tazobactam", "ertapenem", "meropenem", "gentamicin", "amikacin", "ciprofloxacin",
    "levofloxacin", "nitrofurantoin", "fosfomycin", "trimethoprim-sulfamethoxazole",
  ], ["enterobacterales"]),
  makePanel("nonfermenters", "Non-fermenting Gram-negative bacilli panel", [
    "piperacillin-tazobactam", "ceftazidime", "cefepime", "ceftolozane-tazobactam", "ceftazidime-avibactam", "imipenem",
    "meropenem", "doripenem", "aztreonam", "amikacin", "gentamicin", "tobramycin", "ciprofloxacin", "levofloxacin",
    "colistin", "minocycline", "tigecycline", "trimethoprim-sulfamethoxazole",
  ], ["non_fermenter"]),
  makePanel("reserve_cre", "Reserve / CRE panel", [
    "meropenem", "imipenem", "ertapenem", "ceftazidime-avibactam", "ceftolozane-tazobactam", "imipenem-relebactam",
    "meropenem-vaborbactam", "cefiderocol", "aztreonam", "aztreonam-avibactam", "amikacin", "gentamicin", "tigecycline",
    "eravacycline", "fosfomycin", "colistin", "trimethoprim-sulfamethoxazole", "ciprofloxacin",
  ], ["enterobacterales", "non_fermenter"]),
  {
    id: "other",
    label: "Other / custom panel",
    codes: Array.from(new Set(ANTIBIOTICS.map((a) => a.code))),
    missingRequested: [],
  },
];

export function getASTPanel(panelId: string): ASTPanelDef | undefined {
  return AST_PANELS.find((p) => p.id === panelId);
}

export function getAntibiotic(code: string): AntibioticDef | undefined {
  return ANTIBIOTICS.find((a) => a.code === code);
}
