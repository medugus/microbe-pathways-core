// Organism dictionary — coded reference. Display labels are not used as logic keys.
// Phase-2 seed; richer organism metadata (gram, group, alert flags) lives here so
// downstream IPC / stewardship engines can resolve without re-importing.

export type GramClass = "gram_positive" | "gram_negative" | "yeast" | "afb" | "anaerobe" | "other";

export interface OrganismDef {
  code: string;
  display: string;
  gram: GramClass;
  /** Coarse taxonomic group used by future expert rules. */
  group?: "enterobacterales" | "non_fermenter" | "staphylococcus" | "streptococcus" | "enterococcus" | "candida" | "other";
  /** Marks alert organisms for IPC engine hooks. */
  alert?: boolean;
  /** Common skin commensal — used for blood culture contamination scaffolding. */
  commonSkinFlora?: boolean;
}

export const ORGANISMS: OrganismDef[] = [
  { code: "ECOL",  display: "Escherichia coli",                gram: "gram_negative", group: "enterobacterales" },
  { code: "KPNE",  display: "Klebsiella pneumoniae",           gram: "gram_negative", group: "enterobacterales", alert: true },
  { code: "PMIR",  display: "Proteus mirabilis",               gram: "gram_negative", group: "enterobacterales" },
  { code: "ENTC",  display: "Enterobacter cloacae complex",    gram: "gram_negative", group: "enterobacterales" },
  { code: "PAER",  display: "Pseudomonas aeruginosa",          gram: "gram_negative", group: "non_fermenter", alert: true },
  { code: "ABAU",  display: "Acinetobacter baumannii complex", gram: "gram_negative", group: "non_fermenter", alert: true },
  { code: "SAUR",  display: "Staphylococcus aureus",           gram: "gram_positive", group: "staphylococcus", alert: true },
  { code: "SEPI",  display: "Staphylococcus epidermidis",      gram: "gram_positive", group: "staphylococcus", commonSkinFlora: true },
  { code: "CONS",  display: "Coagulase-negative staphylococci", gram: "gram_positive", group: "staphylococcus", commonSkinFlora: true },
  { code: "EFAE",  display: "Enterococcus faecalis",           gram: "gram_positive", group: "enterococcus" },
  { code: "EFAM",  display: "Enterococcus faecium",            gram: "gram_positive", group: "enterococcus", alert: true },
  { code: "SPNE",  display: "Streptococcus pneumoniae",        gram: "gram_positive", group: "streptococcus", alert: true },
  { code: "SAGA",  display: "Streptococcus agalactiae",        gram: "gram_positive", group: "streptococcus" },
  { code: "NMEN",  display: "Neisseria meningitidis",          gram: "gram_negative", alert: true },
  { code: "HINF",  display: "Haemophilus influenzae",          gram: "gram_negative", alert: true },
  { code: "CALB",  display: "Candida albicans",                gram: "yeast", group: "candida" },
  { code: "CAUR",  display: "Candida auris",                   gram: "yeast", group: "candida", alert: true },
  { code: "MTUB",  display: "Mycobacterium tuberculosis complex", gram: "afb", alert: true },
  { code: "CDIF",  display: "Clostridioides difficile",          gram: "anaerobe", alert: true },
  { code: "MIXED", display: "Mixed growth (no significant pathogen)", gram: "other" },
  { code: "NOGRO", display: "No growth",                       gram: "other" },
  { code: "NORML", display: "Normal flora",                    gram: "other" },
];

export function getOrganism(code: string): OrganismDef | undefined {
  return ORGANISMS.find((o) => o.code === code);
}

export const GROWTH_QUANTIFIERS: { code: string; display: string }[] = [
  { code: "NO_GROWTH",     display: "No growth" },
  { code: "SCANTY",        display: "Scanty growth (<10 CFU)" },
  { code: "LIGHT",         display: "Light growth (1+)" },
  { code: "MODERATE",      display: "Moderate growth (2+)" },
  { code: "HEAVY",         display: "Heavy growth (3+)" },
  { code: "PURE_HEAVY",    display: "Pure heavy growth (4+)" },
  { code: "MIXED_GROWTH",  display: "Mixed growth" },
];

export const SIGNIFICANCE_OPTIONS = [
  { code: "significant",          display: "Significant" },
  { code: "probable_contaminant", display: "Probable contaminant" },
  { code: "mixed_growth",         display: "Mixed growth" },
  { code: "normal_flora",         display: "Normal flora" },
  { code: "indeterminate",        display: "Indeterminate" },
] as const;
