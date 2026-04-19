// Stewardship rule configuration. Pure data; consumed by stewardshipEngine.
// AWaRe categorisation, release classes, syndrome-aware preferences.

export type AWaRe = "Access" | "Watch" | "Reserve" | "NotClassified";
export type ReleaseClass =
  | "unrestricted"
  | "first_line_preferred"
  | "cascade_suppressed"
  | "restricted"
  | "screening_only";

export interface AntibioticStewardship {
  code: string;
  aware: AWaRe;
  defaultReleaseClass: ReleaseClass;
  /** Preferred route hints used by the engine for IV→PO suggestions. */
  oralAvailable?: boolean;
}

export const AB_STEWARDSHIP: AntibioticStewardship[] = [
  { code: "AMP",  aware: "Access",  defaultReleaseClass: "first_line_preferred", oralAvailable: true },
  { code: "AMC",  aware: "Access",  defaultReleaseClass: "first_line_preferred", oralAvailable: true },
  { code: "TZP",  aware: "Watch",   defaultReleaseClass: "restricted" },
  { code: "CXM",  aware: "Watch",   defaultReleaseClass: "first_line_preferred", oralAvailable: true },
  { code: "CRO",  aware: "Watch",   defaultReleaseClass: "restricted" },
  { code: "CAZ",  aware: "Watch",   defaultReleaseClass: "restricted" },
  { code: "FEP",  aware: "Watch",   defaultReleaseClass: "restricted" },
  { code: "MEM",  aware: "Watch",   defaultReleaseClass: "restricted" },
  { code: "ETP",  aware: "Watch",   defaultReleaseClass: "restricted" },
  { code: "GEN",  aware: "Access",  defaultReleaseClass: "unrestricted" },
  { code: "AMK",  aware: "Access",  defaultReleaseClass: "restricted" },
  { code: "CIP",  aware: "Watch",   defaultReleaseClass: "cascade_suppressed", oralAvailable: true },
  { code: "LVX",  aware: "Watch",   defaultReleaseClass: "cascade_suppressed", oralAvailable: true },
  { code: "VAN",  aware: "Watch",   defaultReleaseClass: "restricted" },
  { code: "TEC",  aware: "Watch",   defaultReleaseClass: "restricted" },
  { code: "LZD",  aware: "Reserve", defaultReleaseClass: "restricted", oralAvailable: true },
  { code: "CLI",  aware: "Access",  defaultReleaseClass: "unrestricted", oralAvailable: true },
  { code: "ERY",  aware: "Watch",   defaultReleaseClass: "unrestricted", oralAvailable: true },
  { code: "TET",  aware: "Access",  defaultReleaseClass: "unrestricted", oralAvailable: true },
  { code: "SXT",  aware: "Access",  defaultReleaseClass: "first_line_preferred", oralAvailable: true },
  { code: "CST",  aware: "Reserve", defaultReleaseClass: "restricted" },
  { code: "NIT",  aware: "Access",  defaultReleaseClass: "first_line_preferred", oralAvailable: true },
  { code: "FOS",  aware: "Access",  defaultReleaseClass: "first_line_preferred", oralAvailable: true },
];

export function getStewardship(code: string): AntibioticStewardship | undefined {
  return AB_STEWARDSHIP.find((a) => a.code === code);
}

/** Syndrome-aware preferences: agents that should be promoted/suppressed for a syndrome. */
export interface SyndromePreference {
  syndrome: string;
  prefer: string[];        // agent codes to promote to first-line
  suppress: string[];      // agent codes to suppress unless escalated
  note: string;
}

export const SYNDROME_PREFERENCES: SyndromePreference[] = [
  {
    syndrome: "uti",
    prefer: ["NIT", "FOS", "SXT", "AMC"],
    suppress: ["CRO", "TZP", "MEM", "ETP", "FEP"],
    note: "Uncomplicated UTI: prefer oral first-line; broad-spectrum agents suppressed unless escalated.",
  },
  {
    syndrome: "cauti",
    prefer: ["SXT", "AMC", "CIP"],
    suppress: ["MEM", "ETP"],
    note: "CAUTI: review device necessity; reserve carbapenems for ESBL/CRE.",
  },
  {
    syndrome: "bsi",
    prefer: [],
    suppress: [],
    note: "BSI: broader review — full panel released for clinician decision; consultant input encouraged.",
  },
  {
    syndrome: "meningitis",
    prefer: ["CRO", "VAN", "MEM"],
    suppress: ["NIT", "FOS", "TET"],
    note: "Meningitis: report only CNS-penetrating agents.",
  },
  {
    syndrome: "cap",
    prefer: ["AMC", "CRO", "CXM"],
    suppress: ["MEM"],
    note: "CAP: prefer narrow β-lactams; carbapenems reserved for HAP/VAP context.",
  },
  {
    syndrome: "hap",
    prefer: ["TZP", "FEP", "MEM"],
    suppress: ["AMP"],
    note: "HAP: empirical broader cover acceptable; de-escalate when AST returns.",
  },
  {
    syndrome: "vap",
    prefer: ["TZP", "FEP", "MEM", "AMK"],
    suppress: ["AMP", "CXM"],
    note: "VAP: cover MDR Pseudomonas/Acinetobacter; consider double-cover empirically.",
  },
  {
    syndrome: "colonisation_screen",
    prefer: [],
    suppress: ["AMP","AMC","TZP","CXM","CRO","CAZ","FEP","MEM","ETP","GEN","AMK","CIP","LVX","VAN","TEC","LZD","CLI","ERY","TET","SXT","CST","NIT","FOS"],
    note: "Screening specimen: AST not reported clinically — flag IPC only.",
  },
];

export function getSyndromePref(syndrome?: string | null): SyndromePreference | undefined {
  if (!syndrome) return undefined;
  return SYNDROME_PREFERENCES.find((s) => s.syndrome === syndrome);
}
