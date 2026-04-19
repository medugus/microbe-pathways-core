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

export function getAntibiotic(code: string): AntibioticDef | undefined {
  return ANTIBIOTICS.find((a) => a.code === code);
}
