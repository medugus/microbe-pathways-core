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
    /** True for non-reportable pseudo-organisms (no growth, mixed, normal flora) — suppresses AST entry. */
  noAst?: boolean;
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
  { code: "SSAP",  display: "Staphylococcus saprophyticus",    gram: "gram_positive", group: "staphylococcus" },
  { code: "SPYO",  display: "Streptococcus pyogenes (GAS)",    gram: "gram_positive", group: "streptococcus" },
  { code: "SAGAL", display: "Streptococcus agalactiae (GBS)",  gram: "gram_positive", group: "streptococcus" },
  { code: "SPNE",  display: "Streptococcus pneumoniae",        gram: "gram_positive", group: "streptococcus" },
  { code: "SDYS",  display: "Streptococcus dysgalactiae / β-haemolytic groups C/G", gram: "gram_positive", group: "streptococcus" },
  { code: "SVIR",  display: "Viridans group streptococci",      gram: "gram_positive", group: "streptococcus" },
  { code: "EFAE",  display: "Enterococcus faecalis",           gram: "gram_positive", group: "enterococcus" },
  { code: "EFAM",  display: "Enterococcus faecium",            gram: "gram_positive", group: "enterococcus", alert: true },
  { code: "CALB",  display: "Candida albicans",                gram: "yeast",         group: "candida" },
  { code: "CGLA",  display: "Candida glabrata",                gram: "yeast",         group: "candida", alert: true },
  { code: "CAUR",  display: "Candida auris",                   gram: "yeast",         group: "candida", alert: true },
  { code: "MTUB",  display: "Mycobacterium tuberculosis complex", gram: "afb", alert: true },
  { code: "NOGRO", display: "No growth",                       gram: "other", noAst: true },
  { code: "MIXED", display: "Mixed growth (no significant pathogen)", gram: "other", noAst: true },
  { code: "NORML", display: "Normal flora",                    gram: "other", noAst: true },
  { code: "OTHER", display: "Other organism (specify in notes)", gram: "other" },
  ];

export function getOrganism(code: string): OrganismDef | undefined {
    return ORGANISMS.find((o) => o.code === code);
}

/**
 * Organism codes that suppress AST entry (no growth, mixed growth, normal flora).
 * Use this constant instead of hardcoding ["NOGRO","MIXED","NORML"] in UI components.
 */
export const NON_GROWTH_ORGANISM_CODES: string[] = ORGANISMS.filter((o) => o.noAst).map((o) => o.code);

export const GROWTH_QUANTIFIERS: { code: string; display: string }[] = [
  { code: "NO_GROWTH",     display: "No growth" },
  { code: "SCANTY",        display: "Scanty growth (<10 CFU)" },
  { code: "LIGHT",         display: "Light growth (1+)" },
  { code: "MODERATE",      display: "Moderate growth (2+)" },
  { code: "HEAVY",         display: "Heavy growth (3+)" },
  { code: "PURE_HEAVY",    display: "Pure heavy growth (4+)" },
  { code: "GT_1E5_CFU_ML", display: ">10⁵ CFU/mL" },
  { code: "GT_1E4_CFU_ML", display: ">10⁴ CFU/mL" },
  { code: "GT_1E3_CFU_ML", display: ">10³ CFU/mL" },
  ];

export const SIGNIFICANCE_OPTIONS = [
  { code: "significant",         label: "Significant pathogen" },
  { code: "probable_contaminant",label: "Probable contaminant" },
  { code: "mixed_growth",        label: "Mixed growth" },
  { code: "normal_flora",        label: "Normal flora" },
  { code: "indeterminate",       label: "Indeterminate" },
  ];
