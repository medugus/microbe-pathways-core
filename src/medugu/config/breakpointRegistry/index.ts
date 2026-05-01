import type { ASTStandard } from "../../domain/types";
import {
  DEFAULT_EUCAST_INTERPRETATION_LABELS,
  normalizeDiskRecord,
  normalizeMICRecord,
  supportsCategory,
  type AnyBreakpoint,
  type BreakpointCategory,
  type BreakpointFlags,
  type BreakpointIndication,
  type DiskBreakpoint,
  type EucastBreakpointRecord,
  type MICBreakpoint,
} from "./types";
import { EUCAST_2026_ENTEROBACTERALES_BREAKPOINTS } from "./eucast2026/enterobacterales";
import { EUCAST_2026_STAPHYLOCOCCUS_BREAKPOINTS } from "./eucast2026/staphylococcus";
import { EUCAST_2026_STREPTOCOCCUS_BREAKPOINTS } from "./eucast2026/streptococcus";
import { EUCAST_2026_ENTEROCOCCUS_BREAKPOINTS } from "./eucast2026/enterococcus";
import { EUCAST_2026_PSEUDOMONAS_BREAKPOINTS } from "./eucast2026/pseudomonas";
import { EUCAST_2026_ACINETOBACTER_BREAKPOINTS } from "./eucast2026/acinetobacter";
import { EUCAST_2026_HAEMOPHILUS_MORAXELLA_BREAKPOINTS } from "./eucast2026/haemophilusMoraxella";
import { EUCAST_2026_METADATA } from "./eucast2026/notes";

export const PRIMARY_STANDARD: ASTStandard = "CLSI";
export const SECONDARY_STANDARD: ASTStandard = "EUCAST";

const CLSI_ED36_STAPH_META = {
  standard: "CLSI" as const,
  version: "M100 Ed36",
  year: 2026,
  sourceLabel: "CLSI M100 Ed36 / FDA-recognised STIC where applicable",
  organismGroup: "staphylococcus",
} as const;

const CLSI_MIC_BREAKPOINTS: MICBreakpoint[] = [
  { organismGroup: "enterobacterales", antibioticCode: "MEM", standard: "CLSI", method: "mic", susceptibleMaxMgL: 1, resistantMinMgL: 4 },
  { organismGroup: "enterobacterales", antibioticCode: "CRO", standard: "CLSI", method: "mic", susceptibleMaxMgL: 1, resistantMinMgL: 4 },
  { organismGroup: "enterobacterales", antibioticCode: "CIP", standard: "CLSI", method: "mic", susceptibleMaxMgL: 0.25, resistantMinMgL: 1 },
  { ...CLSI_ED36_STAPH_META, antibioticCode: "ERY", method: "mic", breakpointStatus: "needs_validation" },
  { ...CLSI_ED36_STAPH_META, antibioticCode: "CLI", method: "mic", breakpointStatus: "needs_validation", notes: "Inducible clindamycin resistance requires D-test context." },
  { ...CLSI_ED36_STAPH_META, antibioticCode: "GEN", method: "mic", breakpointStatus: "needs_validation" },
  { ...CLSI_ED36_STAPH_META, antibioticCode: "CIP", method: "mic", breakpointStatus: "needs_validation" },
  { ...CLSI_ED36_STAPH_META, antibioticCode: "LVX", method: "mic", breakpointStatus: "needs_validation" },
  { ...CLSI_ED36_STAPH_META, antibioticCode: "SXT", method: "mic", breakpointStatus: "needs_validation" },
  { ...CLSI_ED36_STAPH_META, antibioticCode: "TET", method: "mic", breakpointStatus: "needs_validation" },
  {
    ...CLSI_ED36_STAPH_META,
    antibioticCode: "VAN",
    method: "mic",
    breakpointStatus: "active",
    susceptibleMaxMgL: 2,
    resistantMinMgL: 16,
    notes: "Vancomycin for Staphylococcus is MIC-based.",
  },
  { ...CLSI_ED36_STAPH_META, antibioticCode: "TEC", method: "mic", breakpointStatus: "needs_validation" },
  { ...CLSI_ED36_STAPH_META, antibioticCode: "LZD", method: "mic", breakpointStatus: "needs_validation", notes: "Do not infer if validated breakpoint values are absent." },
];

const CLSI_DISK_BREAKPOINTS: DiskBreakpoint[] = [
  { organismGroup: "enterobacterales", antibioticCode: "AMC", standard: "CLSI", method: "disk_diffusion", susceptibleMinMm: 18, resistantMaxMm: 13 },
  { ...CLSI_ED36_STAPH_META, antibioticCode: "ERY", method: "disk_diffusion", breakpointStatus: "needs_validation" },
  { ...CLSI_ED36_STAPH_META, antibioticCode: "CLI", method: "disk_diffusion", breakpointStatus: "needs_validation", notes: "Inducible clindamycin resistance requires D-test context." },
  { ...CLSI_ED36_STAPH_META, antibioticCode: "GEN", method: "disk_diffusion", breakpointStatus: "needs_validation" },
  { ...CLSI_ED36_STAPH_META, antibioticCode: "CIP", method: "disk_diffusion", breakpointStatus: "needs_validation" },
  { ...CLSI_ED36_STAPH_META, antibioticCode: "LVX", method: "disk_diffusion", breakpointStatus: "needs_validation" },
  { ...CLSI_ED36_STAPH_META, antibioticCode: "SXT", method: "disk_diffusion", breakpointStatus: "needs_validation" },
  { ...CLSI_ED36_STAPH_META, antibioticCode: "TET", method: "disk_diffusion", breakpointStatus: "needs_validation" },
  {
    ...CLSI_ED36_STAPH_META,
    antibioticCode: "VAN",
    method: "disk_diffusion",
    breakpointStatus: "not_applicable",
    notes: "Vancomycin for Staphylococcus should be interpreted by MIC, not routine disk diffusion.",
  },
  { ...CLSI_ED36_STAPH_META, antibioticCode: "TEC", method: "disk_diffusion", breakpointStatus: "needs_validation" },
  { ...CLSI_ED36_STAPH_META, antibioticCode: "LZD", method: "disk_diffusion", breakpointStatus: "needs_validation", notes: "Do not infer if validated breakpoint values are absent." },
];

export const EUCAST_2026_BREAKPOINT_REGISTRY: EucastBreakpointRecord[] = [
  ...EUCAST_2026_ENTEROBACTERALES_BREAKPOINTS,
  ...EUCAST_2026_STAPHYLOCOCCUS_BREAKPOINTS,
  ...EUCAST_2026_STREPTOCOCCUS_BREAKPOINTS,
  ...EUCAST_2026_ENTEROCOCCUS_BREAKPOINTS,
  ...EUCAST_2026_PSEUDOMONAS_BREAKPOINTS,
  ...EUCAST_2026_ACINETOBACTER_BREAKPOINTS,
  ...EUCAST_2026_HAEMOPHILUS_MORAXELLA_BREAKPOINTS,
];

const EUCAST_MIC_BREAKPOINTS: MICBreakpoint[] = EUCAST_2026_BREAKPOINT_REGISTRY
  .filter((r) => r.method === "mic")
  .map((r) => normalizeMICRecord(r));

const EUCAST_DISK_BREAKPOINTS: DiskBreakpoint[] = EUCAST_2026_BREAKPOINT_REGISTRY
  .filter((r) => r.method === "disk")
  .map((r) => normalizeDiskRecord(r));

export const MIC_BREAKPOINTS: MICBreakpoint[] = [...CLSI_MIC_BREAKPOINTS, ...EUCAST_MIC_BREAKPOINTS];
export const DISK_BREAKPOINTS: DiskBreakpoint[] = [...CLSI_DISK_BREAKPOINTS, ...EUCAST_DISK_BREAKPOINTS];

export function findMICBreakpoint(group: string | undefined, antibioticCode: string, standard: ASTStandard) {
  if (!group) return undefined;
  return MIC_BREAKPOINTS.find(
    (b) =>
      b.organismGroup === group &&
      b.antibioticCode === antibioticCode &&
      b.standard === standard &&
      b.method === "mic" &&
      (b.breakpointStatus ?? "active") === "active" &&
      (
        b.susceptibleMaxMgL !== undefined ||
        b.resistantGreaterThanMgL !== undefined ||
        b.resistantMinMgL !== undefined
      ),
  );
}

export function findDiskBreakpoint(group: string | undefined, antibioticCode: string, standard: ASTStandard) {
  if (!group) return undefined;
  return DISK_BREAKPOINTS.find(
    (b) =>
      b.organismGroup === group &&
      b.antibioticCode === antibioticCode &&
      b.standard === standard &&
      b.method === "disk_diffusion" &&
      (b.breakpointStatus ?? "active") === "active" &&
      (
        b.susceptibleMinMm !== undefined ||
        b.resistantLessThanMm !== undefined ||
        b.resistantMaxMm !== undefined
      ),
  );
}

export function breakpointAllowsIntermediate(breakpoint: AnyBreakpoint): boolean {
  return supportsCategory(breakpoint, "I");
}

export function getInterpretationLabel(
  standard: ASTStandard,
  category: Extract<BreakpointCategory, "S" | "I" | "R" | "ND">,
): string {
  if (standard === "EUCAST") {
    return DEFAULT_EUCAST_INTERPRETATION_LABELS[category];
  }
  const generic = {
    S: "Susceptible",
    I: "Intermediate",
    R: "Resistant",
    ND: "No defined breakpoint",
  } as const;
  return generic[category];
}

// ────────────────────────────────────────────────────────────────────────────
// EUCAST v16.0 indication-aware breakpoint resolution
// ────────────────────────────────────────────────────────────────────────────

/** Coarse syndrome codes consumed by resolveBreakpoint. Mirrors specimenResolver. */
export type ResolverSyndrome =
  | "bsi" | "uti" | "cauti" | "uti_uncomplicated"
  | "cap" | "hap" | "vap"
  | "meningitis"
  | "spontaneous_bacterial_peritonitis"
  | "septic_arthritis" | "pleural_empyema" | "pericarditis"
  | "pd_peritonitis" | "abscess" | "colonisation_screen"
  | null
  | undefined;

export interface BreakpointLookup {
  organismGroup: string;
  organismCode?: string;
  antibioticCode: string;
  /** Domain ASTMethod ("disk_diffusion" | "MIC" | ...) — normalised internally. */
  method: string;
  standard: ASTStandard;
  syndrome?: ResolverSyndrome;
  /** Optional explicit indication override (advanced callers). */
  indication?: BreakpointIndication;
}

export type BreakpointResolutionStatus =
  | "matched"
  | "no_breakpoint"
  | "species_restricted_block";

export interface BreakpointResolution {
  status: BreakpointResolutionStatus;
  breakpoint?: AnyBreakpoint;
  /** Composite key used to find the row: organismGroup|antibiotic|method|indication. */
  breakpointKey?: string;
  indicationUsed?: BreakpointIndication;
  source?: string;
  flags: BreakpointFlags;
  /** Human-readable explanation of any block / fallback decision. */
  reason?: string;
}

/** Build a stable composite key for audit + dedup. */
export function makeBreakpointKey(
  organismGroup: string,
  antibioticCode: string,
  method: "mic" | "disk_diffusion",
  indication: BreakpointIndication | undefined,
): string {
  return `${organismGroup}|${antibioticCode}|${method}|${indication ?? "general"}`;
}

/** Map a clinical syndrome to the ordered list of EUCAST indications to try. */
export function syndromeToIndicationChain(
  syndrome: ResolverSyndrome,
): BreakpointIndication[] {
  switch (syndrome) {
    case "uti_uncomplicated":
      return ["uti_uncomplicated", "uti", "general", "iv", "non_meningitis"];
    case "uti":
    case "cauti":
      return ["uti", "uti_uncomplicated", "general", "iv", "non_meningitis"];
    case "meningitis":
      return ["meningitis", "general", "non_meningitis"];
    case "bsi":
    case "cap": case "hap": case "vap":
    case "spontaneous_bacterial_peritonitis":
    case "septic_arthritis": case "pleural_empyema":
    case "pericarditis": case "pd_peritonitis": case "abscess":
      return ["non_meningitis", "systemic", "iv", "general"];
    default:
      // No syndrome resolved — prefer general / non-meningitis canonical rows.
      return ["general", "non_meningitis", "iv"];
  }
}

function normaliseMethod(method: string): "mic" | "disk_diffusion" | undefined {
  const m = method.toLowerCase();
  if (m === "mic" || m === "etest" || m === "broth_microdilution" || m === "agar_dilution" || m === "gradient") return "mic";
  if (m === "disk_diffusion" || m === "disk" || m === "disc" || m === "kirby_bauer") return "disk_diffusion";
  return undefined;
}

/**
 * Indication-aware breakpoint resolution.
 *
 * Resolution order:
 *   1. Caller-provided indication override (if present).
 *   2. Each indication in syndromeToIndicationChain(syndrome) in turn.
 *   3. Any active row for (group, antibiotic, method, standard) regardless of indication.
 *   4. Status "no_breakpoint".
 *
 * Species restriction: if the matched row carries flags.restrictedSpecies and
 * organismCode is provided but not in that list, status becomes
 * "species_restricted_block" — caller MUST surface as a hard validation issue.
 */
export function resolveBreakpoint(input: BreakpointLookup): BreakpointResolution {
  const normMethod = normaliseMethod(input.method);
  if (!normMethod) {
    return { status: "no_breakpoint", flags: {}, reason: `Unknown AST method: ${input.method}` };
  }

  const pool: AnyBreakpoint[] = normMethod === "mic" ? MIC_BREAKPOINTS : DISK_BREAKPOINTS;
  const candidates = pool.filter(
    (b) =>
      b.organismGroup === input.organismGroup &&
      b.antibioticCode === input.antibioticCode &&
      b.standard === input.standard &&
      b.method === normMethod &&
      (b.breakpointStatus ?? "active") === "active",
  );

  if (candidates.length === 0) {
    return { status: "no_breakpoint", flags: {}, reason: "No active EUCAST row for this (group, drug, method, standard)." };
  }

  const chain: BreakpointIndication[] = input.indication
    ? [input.indication]
    : syndromeToIndicationChain(input.syndrome);

  // Prefer rows whose restrictedSpecies explicitly includes the organism code
  // over rows restricted to other species in the same group. Unrestricted
  // rows are last-resort fallbacks. This prevents e.g. an HINF-only AMC row
  // being picked for MCAT just because it appeared first in the registry.
  function speciesScore(b: AnyBreakpoint): number {
    const rs = b.flags?.restrictedSpecies;
    if (!rs || rs.length === 0) return 1; // generic row
    if (input.organismCode && rs.includes(input.organismCode)) return 2; // exact match
    return 0; // restricted to other species — block candidate
  }

  let matched: AnyBreakpoint | undefined;
  let usedIndication: BreakpointIndication | undefined;
  for (const ind of chain) {
    const indMatches = candidates.filter((c) => (c.indication ?? "general") === ind);
    if (indMatches.length === 0) continue;
    indMatches.sort((a, b) => speciesScore(b) - speciesScore(a));
    if (speciesScore(indMatches[0]) > 0) {
      matched = indMatches[0];
      usedIndication = ind;
      break;
    }
  }
  // Fallback: any active row, regardless of indication, preferring species match.
  if (!matched) {
    const sorted = [...candidates].sort((a, b) => speciesScore(b) - speciesScore(a));
    if (sorted.length > 0 && speciesScore(sorted[0]) > 0) {
      matched = sorted[0];
      usedIndication = matched.indication;
    }
  }
  if (!matched) {
    return { status: "no_breakpoint", flags: {}, reason: "No EUCAST row matches this organism within the group." };
  }

  const flags = { ...(matched.flags ?? {}) };
  const key = makeBreakpointKey(matched.organismGroup, matched.antibioticCode, normMethod, matched.indication);

  if (
    flags.restrictedSpecies &&
    flags.restrictedSpecies.length > 0 &&
    input.organismCode &&
    !flags.restrictedSpecies.includes(input.organismCode)
  ) {
    return {
      status: "species_restricted_block",
      breakpoint: matched,
      breakpointKey: key,
      indicationUsed: usedIndication,
      source: matched.sourceTableRef ?? matched.sourceLabel,
      flags,
      reason: `${input.antibioticCode} EUCAST breakpoint is restricted to: ${flags.restrictedSpecies.join(", ")}.`,
    };
  }

  return {
    status: "matched",
    breakpoint: matched,
    breakpointKey: key,
    indicationUsed: usedIndication,
    source: matched.sourceTableRef ?? matched.sourceLabel,
    flags,
  };
}

/**
 * Validate registry uniqueness on the composite key. Throws (in dev) or
 * returns the duplicate set so callers can surface the issue.
 */
export function findDuplicateBreakpointKeys(
  records: AnyBreakpoint[] = [...MIC_BREAKPOINTS, ...DISK_BREAKPOINTS],
): string[] {
  const seen = new Map<string, number>();
  for (const r of records) {
    if ((r.breakpointStatus ?? "active") !== "active") continue;
    // Composite key includes standard so CLSI + EUCAST rows for the same
    // (group, drug, method, indication) are not falsely flagged as duplicates.
    // Also include restrictedSpecies so two species-restricted rows sharing
    // the same organismGroup (e.g. PAER vs ABAU under "non_fermenter") are
    // treated as distinct.
    const speciesKey = (r.flags?.restrictedSpecies ?? []).slice().sort().join(",") || "*";
    const k = `${r.standard}|${makeBreakpointKey(r.organismGroup, r.antibioticCode, r.method, r.indication)}|${speciesKey}`;
    seen.set(k, (seen.get(k) ?? 0) + 1);
  }
  return Array.from(seen.entries()).filter(([, n]) => n > 1).map(([k]) => k);
}

export { EUCAST_2026_METADATA };
export * from "./types";
