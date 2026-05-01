// EUCAST Clinical Breakpoint Tables v16.0, valid 1 Jan – 31 Dec 2026.
// Streptococcus spp. — split into three EUCAST subgroups, all under
// organismGroup "streptococcus" and disambiguated via flags.restrictedSpecies:
//
//   • SPNE  — Streptococcus pneumoniae
//   • β-haemolytic groups A, B, C, G — SPYO, SAGAL, SDYS
//   • Viridans group streptococci — SVIR
//
// Strict EUCAST interpretation:
//   MIC : S if value ≤ susceptibleMaxMgL ; R if value > resistantGreaterThanMgL
//   Disk: S if value ≥ susceptibleMinMm  ; R if value < resistantLessThanMm
//
// SPNE penicillin uses indication-aware rows (meningitis / non_meningitis /
// iv / oral) — the resolver picks via syndrome chain. β-haemolytic strep
// PEN is a single S-only row (no β-lactam resistance described); viridans
// PEN follows its own (higher) breakpoint.
//
// Intrinsic / no-breakpoint block rows (FOX, OXA, FUS, MUP, CST, NIT, FOS,
// AMK, GEN, TOB, ATM, TZP, CAZ, CFD, etc.) are encoded as a single "R"
// category under each species group.

import type { EucastBreakpointRecord } from "../types";
import { EUCAST_2026_METADATA } from "./notes";

const SRC = "EUCAST v16.0 2026, Streptococcus";
const SPNE_ONLY = { restrictedSpecies: ["SPNE"] };
const BHEM_ONLY = { restrictedSpecies: ["SPYO", "SAGAL", "SDYS"] };
const VIR_ONLY  = { restrictedSpecies: ["SVIR"] };
const ALL_STREP = { restrictedSpecies: ["SPNE", "SPYO", "SAGAL", "SDYS", "SVIR"] };

export const EUCAST_2026_STREPTOCOCCUS_BREAKPOINTS: EucastBreakpointRecord[] = [
  // ═══════════════════════════════════════════════════════════════════════
  // S. pneumoniae (SPNE)
  // ═══════════════════════════════════════════════════════════════════════

  // ─── PEN — meningitis (IV)
  {
    ...EUCAST_2026_METADATA, organismGroup: "streptococcus", antibioticCode: "PEN",
    method: "mic", indication: "meningitis",
    susceptibleMaxMgL: 0.06, resistantGreaterThanMgL: 0.06,
    interpretationCategories: ["S", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, S. pneumoniae, Penicillin (meningitis)`,
    flags: SPNE_ONLY,
    notes: "Meningitis: MIC S≤0.06, R>0.06 mg/L. IV high-dose required.",
  },
  // ─── PEN — non-meningitis IV (high-dose)
  {
    ...EUCAST_2026_METADATA, organismGroup: "streptococcus", antibioticCode: "PEN",
    method: "mic", indication: "non_meningitis",
    susceptibleMaxMgL: 2, resistantGreaterThanMgL: 2,
    interpretationCategories: ["S", "I", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, S. pneumoniae, Penicillin (non-meningitis IV)`,
    flags: SPNE_ONLY,
    notes: "Non-meningitis IV high-dose 2.4 g x4-6/day: MIC S≤2, R>2 mg/L. Standard IV: S≤0.5.",
  },
  // ─── PEN — IV standard dose
  {
    ...EUCAST_2026_METADATA, organismGroup: "streptococcus", antibioticCode: "PEN",
    method: "mic", indication: "iv",
    susceptibleMaxMgL: 0.5, resistantGreaterThanMgL: 2,
    interpretationCategories: ["S", "I", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, S. pneumoniae, Penicillin (IV standard)`,
    flags: SPNE_ONLY,
    notes: "Standard IV (1.2 g x4/day): MIC S≤0.5, I=1-2, R>2.",
  },
  // ─── PEN — oral (phenoxymethylpenicillin)
  {
    ...EUCAST_2026_METADATA, organismGroup: "streptococcus", antibioticCode: "PEN",
    method: "mic", indication: "oral",
    susceptibleMaxMgL: 0.06, resistantGreaterThanMgL: 2,
    interpretationCategories: ["S", "I", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, S. pneumoniae, Penicillin V (oral)`,
    flags: SPNE_ONLY,
    notes: "Oral penicillin V: MIC S≤0.06, I=0.125-2, R>2.",
  },
  // ─── PEN — disk (oxacillin 1µg screen)
  {
    ...EUCAST_2026_METADATA, organismGroup: "streptococcus", antibioticCode: "PEN",
    method: "disk", indication: "general",
    susceptibleMinMm: 20, resistantLessThanMm: 20,
    interpretationCategories: ["S", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, S. pneumoniae, Oxacillin 1µg screen for PEN`,
    flags: SPNE_ONLY,
    notes: "Oxacillin 1µg screen: zone ≥20 mm → PEN-S all indications. Zone <20 → MIC required for definitive PEN/AMP/CTX/CRO categorisation.",
  },

  // ─── AMP / AMX — non-meningitis
  {
    ...EUCAST_2026_METADATA, organismGroup: "streptococcus", antibioticCode: "AMP",
    method: "mic", indication: "non_meningitis",
    susceptibleMaxMgL: 0.5, resistantGreaterThanMgL: 2,
    interpretationCategories: ["S", "I", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, S. pneumoniae, Ampicillin`,
    flags: SPNE_ONLY,
    notes: "Non-meningitis: MIC S≤0.5, I=1-2, R>2.",
  },
  {
    ...EUCAST_2026_METADATA, organismGroup: "streptococcus", antibioticCode: "AMX",
    method: "mic", indication: "non_meningitis",
    susceptibleMaxMgL: 0.5, resistantGreaterThanMgL: 2,
    interpretationCategories: ["S", "I", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, S. pneumoniae, Amoxicillin`,
    flags: SPNE_ONLY,
    notes: "Non-meningitis: MIC S≤0.5, I=1-2, R>2.",
  },
  {
    ...EUCAST_2026_METADATA, organismGroup: "streptococcus", antibioticCode: "AMC",
    method: "mic", indication: "non_meningitis",
    susceptibleMaxMgL: 0.5, resistantGreaterThanMgL: 2,
    interpretationCategories: ["S", "I", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, S. pneumoniae, Amoxicillin-clavulanate`,
    flags: SPNE_ONLY,
    notes: "Breakpoints expressed for amoxicillin component. MIC S≤0.5, R>2.",
  },

  // ─── CRO — meningitis
  {
    ...EUCAST_2026_METADATA, organismGroup: "streptococcus", antibioticCode: "CRO",
    method: "mic", indication: "meningitis",
    susceptibleMaxMgL: 0.5, resistantGreaterThanMgL: 2,
    interpretationCategories: ["S", "I", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, S. pneumoniae, Ceftriaxone (meningitis)`,
    flags: SPNE_ONLY,
    notes: "Meningitis: MIC S≤0.5, R>2.",
  },
  {
    ...EUCAST_2026_METADATA, organismGroup: "streptococcus", antibioticCode: "CRO",
    method: "mic", indication: "non_meningitis",
    susceptibleMaxMgL: 0.5, resistantGreaterThanMgL: 2,
    interpretationCategories: ["S", "I", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, S. pneumoniae, Ceftriaxone (non-meningitis)`,
    flags: SPNE_ONLY,
    notes: "Non-meningitis: MIC S≤0.5, I=1-2, R>2.",
  },
  // ─── CTX — same as CRO
  {
    ...EUCAST_2026_METADATA, organismGroup: "streptococcus", antibioticCode: "CTX",
    method: "mic", indication: "meningitis",
    susceptibleMaxMgL: 0.5, resistantGreaterThanMgL: 2,
    interpretationCategories: ["S", "I", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, S. pneumoniae, Cefotaxime (meningitis)`,
    flags: SPNE_ONLY,
    notes: "Meningitis: MIC S≤0.5, R>2.",
  },
  {
    ...EUCAST_2026_METADATA, organismGroup: "streptococcus", antibioticCode: "CTX",
    method: "mic", indication: "non_meningitis",
    susceptibleMaxMgL: 0.5, resistantGreaterThanMgL: 2,
    interpretationCategories: ["S", "I", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, S. pneumoniae, Cefotaxime (non-meningitis)`,
    flags: SPNE_ONLY,
    notes: "Non-meningitis: MIC S≤0.5, I=1-2, R>2.",
  },

  // ─── FEP / MEM — pneumonia
  {
    ...EUCAST_2026_METADATA, organismGroup: "streptococcus", antibioticCode: "FEP",
    method: "mic", indication: "general",
    susceptibleMaxMgL: 1, resistantGreaterThanMgL: 2,
    interpretationCategories: ["S", "I", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, S. pneumoniae, Cefepime`,
    flags: SPNE_ONLY,
    notes: "MIC S≤1, I=2, R>2.",
  },
  {
    ...EUCAST_2026_METADATA, organismGroup: "streptococcus", antibioticCode: "MEM",
    method: "mic", indication: "meningitis",
    susceptibleMaxMgL: 0.25, resistantGreaterThanMgL: 1,
    interpretationCategories: ["S", "I", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, S. pneumoniae, Meropenem (meningitis)`,
    flags: SPNE_ONLY,
    notes: "Meningitis: MIC S≤0.25, I=0.5-1, R>1.",
  },
  {
    ...EUCAST_2026_METADATA, organismGroup: "streptococcus", antibioticCode: "MEM",
    method: "mic", indication: "non_meningitis",
    susceptibleMaxMgL: 2, resistantGreaterThanMgL: 2,
    interpretationCategories: ["S", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, S. pneumoniae, Meropenem (non-meningitis)`,
    flags: SPNE_ONLY,
    notes: "Non-meningitis: MIC S≤2, R>2.",
  },

  // ─── ERY (SPNE)
  {
    ...EUCAST_2026_METADATA, organismGroup: "streptococcus", antibioticCode: "ERY",
    method: "mic", indication: "general",
    susceptibleMaxMgL: 0.25, resistantGreaterThanMgL: 0.5,
    interpretationCategories: ["S", "I", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, S. pneumoniae, Erythromycin`,
    flags: SPNE_ONLY,
    notes: "MIC S≤0.25, I=0.5, R>0.5. D-test (CLI) required for inducible MLSb.",
  },
  {
    ...EUCAST_2026_METADATA, organismGroup: "streptococcus", antibioticCode: "ERY",
    method: "disk", indication: "general",
    susceptibleMinMm: 22, resistantLessThanMm: 19,
    interpretationCategories: ["S", "I", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, S. pneumoniae, Erythromycin`,
    flags: SPNE_ONLY,
    notes: "Disk 15 µg. S≥22, R<19.",
  },
  // ─── CLI (SPNE)
  {
    ...EUCAST_2026_METADATA, organismGroup: "streptococcus", antibioticCode: "CLI",
    method: "mic", indication: "general",
    susceptibleMaxMgL: 0.5, resistantGreaterThanMgL: 0.5,
    interpretationCategories: ["S", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, S. pneumoniae, Clindamycin`,
    flags: SPNE_ONLY,
    notes: "MIC S≤0.5, R>0.5. D-test for inducible MLSb when ERY-R / CLI-S.",
  },
  {
    ...EUCAST_2026_METADATA, organismGroup: "streptococcus", antibioticCode: "CLI",
    method: "disk", indication: "general",
    susceptibleMinMm: 19, resistantLessThanMm: 19,
    interpretationCategories: ["S", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, S. pneumoniae, Clindamycin`,
    flags: SPNE_ONLY,
    notes: "Disk 2 µg. S≥19, R<19.",
  },

  // ─── LVX / MXF (SPNE)
  {
    ...EUCAST_2026_METADATA, organismGroup: "streptococcus", antibioticCode: "LVX",
    method: "mic", indication: "general",
    susceptibleMaxMgL: 2, resistantGreaterThanMgL: 2,
    interpretationCategories: ["S", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, S. pneumoniae, Levofloxacin`,
    flags: SPNE_ONLY,
    notes: "MIC S≤2, R>2.",
  },
  {
    ...EUCAST_2026_METADATA, organismGroup: "streptococcus", antibioticCode: "LVX",
    method: "disk", indication: "general",
    susceptibleMinMm: 17, resistantLessThanMm: 17,
    interpretationCategories: ["S", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, S. pneumoniae, Levofloxacin`,
    flags: SPNE_ONLY,
    notes: "Disk 5 µg. S≥17, R<17.",
  },
  {
    ...EUCAST_2026_METADATA, organismGroup: "streptococcus", antibioticCode: "MXF",
    method: "mic", indication: "general",
    susceptibleMaxMgL: 0.5, resistantGreaterThanMgL: 0.5,
    interpretationCategories: ["S", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, S. pneumoniae, Moxifloxacin`,
    flags: SPNE_ONLY,
    notes: "MIC S≤0.5, R>0.5.",
  },
  {
    ...EUCAST_2026_METADATA, organismGroup: "streptococcus", antibioticCode: "MXF",
    method: "disk", indication: "general",
    susceptibleMinMm: 22, resistantLessThanMm: 22,
    interpretationCategories: ["S", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, S. pneumoniae, Moxifloxacin`,
    flags: SPNE_ONLY,
    notes: "Disk 5 µg. S≥22, R<22.",
  },

  // ─── TET / DOX (SPNE)
  {
    ...EUCAST_2026_METADATA, organismGroup: "streptococcus", antibioticCode: "TET",
    method: "mic", indication: "general",
    susceptibleMaxMgL: 1, resistantGreaterThanMgL: 2,
    interpretationCategories: ["S", "I", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, S. pneumoniae, Tetracycline`,
    flags: SPNE_ONLY,
    notes: "MIC S≤1, I=2, R>2.",
  },
  {
    ...EUCAST_2026_METADATA, organismGroup: "streptococcus", antibioticCode: "DOX",
    method: "mic", indication: "general",
    susceptibleMaxMgL: 1, resistantGreaterThanMgL: 2,
    interpretationCategories: ["S", "I", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, S. pneumoniae, Doxycycline`,
    flags: SPNE_ONLY,
    notes: "MIC S≤1, I=2, R>2.",
  },

  // ─── SXT (SPNE)
  {
    ...EUCAST_2026_METADATA, organismGroup: "streptococcus", antibioticCode: "SXT",
    method: "mic", indication: "general",
    susceptibleMaxMgL: 1, resistantGreaterThanMgL: 2,
    interpretationCategories: ["S", "I", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, S. pneumoniae, Trimethoprim-sulfamethoxazole`,
    flags: SPNE_ONLY,
    notes: "MIC S≤1, I=2, R>2 (TMP component).",
  },

  // ─── VAN / LZD / CHL / RIF (SPNE)
  {
    ...EUCAST_2026_METADATA, organismGroup: "streptococcus", antibioticCode: "VAN",
    method: "mic", indication: "general",
    susceptibleMaxMgL: 2, resistantGreaterThanMgL: 2,
    interpretationCategories: ["S", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, S. pneumoniae, Vancomycin`,
    flags: SPNE_ONLY,
    notes: "MIC S≤2, R>2.",
  },
  {
    ...EUCAST_2026_METADATA, organismGroup: "streptococcus", antibioticCode: "LZD",
    method: "mic", indication: "general",
    susceptibleMaxMgL: 2, resistantGreaterThanMgL: 4,
    interpretationCategories: ["S", "I", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, S. pneumoniae, Linezolid`,
    flags: SPNE_ONLY,
    notes: "MIC S≤2, I=4, R>4.",
  },
  {
    ...EUCAST_2026_METADATA, organismGroup: "streptococcus", antibioticCode: "CHL",
    method: "mic", indication: "general",
    susceptibleMaxMgL: 8, resistantGreaterThanMgL: 8,
    interpretationCategories: ["S", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, S. pneumoniae, Chloramphenicol`,
    flags: SPNE_ONLY,
    notes: "MIC S≤8, R>8.",
  },
  {
    ...EUCAST_2026_METADATA, organismGroup: "streptococcus", antibioticCode: "RIF",
    method: "mic", indication: "meningitis",
    susceptibleMaxMgL: 0.06, resistantGreaterThanMgL: 0.5,
    interpretationCategories: ["S", "I", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, S. pneumoniae, Rifampicin (meningitis adjunct)`,
    flags: SPNE_ONLY,
    notes: "Meningitis adjunct only — not for monotherapy. MIC S≤0.06, R>0.5.",
  },

  // ═══════════════════════════════════════════════════════════════════════
  // β-haemolytic streptococci groups A/B/C/G (SPYO, SAGAL, SDYS)
  // ═══════════════════════════════════════════════════════════════════════

  // PEN / AMP / AMX / CRO / CTX — universally S, no resistance described
  ...(["PEN", "AMP", "AMX", "AMC", "CRO", "CTX", "FEP", "MEM"] as const).map<EucastBreakpointRecord>((code) => ({
    ...EUCAST_2026_METADATA, organismGroup: "streptococcus", antibioticCode: code,
    method: "mic", indication: "general",
    susceptibleMaxMgL: 0.25, resistantGreaterThanMgL: 0.25,
    interpretationCategories: ["S", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, β-haemolytic strep (A,B,C,G), ${code}`,
    flags: BHEM_ONLY,
    notes: `β-haemolytic strep (A/B/C/G) are uniformly S to ${code}; no acquired β-lactam resistance described — report S without MIC.`,
  })),

  // ─── ERY / CLI (β-haemolytic) — same numeric breakpoints as SPNE
  {
    ...EUCAST_2026_METADATA, organismGroup: "streptococcus", antibioticCode: "ERY",
    method: "mic", indication: "general",
    susceptibleMaxMgL: 0.25, resistantGreaterThanMgL: 0.5,
    interpretationCategories: ["S", "I", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, β-haemolytic strep, Erythromycin`,
    flags: BHEM_ONLY,
    notes: "MIC S≤0.25, I=0.5, R>0.5. D-test for inducible MLSb.",
  },
  {
    ...EUCAST_2026_METADATA, organismGroup: "streptococcus", antibioticCode: "ERY",
    method: "disk", indication: "general",
    susceptibleMinMm: 21, resistantLessThanMm: 18,
    interpretationCategories: ["S", "I", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, β-haemolytic strep, Erythromycin`,
    flags: BHEM_ONLY,
    notes: "Disk 15 µg. S≥21, R<18.",
  },
  {
    ...EUCAST_2026_METADATA, organismGroup: "streptococcus", antibioticCode: "CLI",
    method: "mic", indication: "general",
    susceptibleMaxMgL: 0.5, resistantGreaterThanMgL: 0.5,
    interpretationCategories: ["S", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, β-haemolytic strep, Clindamycin`,
    flags: BHEM_ONLY,
    notes: "MIC S≤0.5, R>0.5. D-test required when ERY-R / CLI-S.",
  },
  {
    ...EUCAST_2026_METADATA, organismGroup: "streptococcus", antibioticCode: "CLI",
    method: "disk", indication: "general",
    susceptibleMinMm: 17, resistantLessThanMm: 17,
    interpretationCategories: ["S", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, β-haemolytic strep, Clindamycin`,
    flags: BHEM_ONLY,
    notes: "Disk 2 µg. S≥17, R<17.",
  },

  // ─── LVX / MXF (β-haemolytic)
  {
    ...EUCAST_2026_METADATA, organismGroup: "streptococcus", antibioticCode: "LVX",
    method: "mic", indication: "general",
    susceptibleMaxMgL: 1, resistantGreaterThanMgL: 2,
    interpretationCategories: ["S", "I", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, β-haemolytic strep, Levofloxacin`,
    flags: BHEM_ONLY,
    notes: "MIC S≤1, I=2, R>2.",
  },
  {
    ...EUCAST_2026_METADATA, organismGroup: "streptococcus", antibioticCode: "MXF",
    method: "mic", indication: "general",
    susceptibleMaxMgL: 0.5, resistantGreaterThanMgL: 1,
    interpretationCategories: ["S", "I", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, β-haemolytic strep, Moxifloxacin`,
    flags: BHEM_ONLY,
    notes: "MIC S≤0.5, I=1, R>1.",
  },

  // ─── TET / DOX / SXT / VAN / LZD / CHL (β-haemolytic)
  {
    ...EUCAST_2026_METADATA, organismGroup: "streptococcus", antibioticCode: "TET",
    method: "mic", indication: "general",
    susceptibleMaxMgL: 1, resistantGreaterThanMgL: 2,
    interpretationCategories: ["S", "I", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, β-haemolytic strep, Tetracycline`,
    flags: BHEM_ONLY,
    notes: "MIC S≤1, I=2, R>2.",
  },
  {
    ...EUCAST_2026_METADATA, organismGroup: "streptococcus", antibioticCode: "DOX",
    method: "mic", indication: "general",
    susceptibleMaxMgL: 1, resistantGreaterThanMgL: 2,
    interpretationCategories: ["S", "I", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, β-haemolytic strep, Doxycycline`,
    flags: BHEM_ONLY,
    notes: "MIC S≤1, I=2, R>2.",
  },
  {
    ...EUCAST_2026_METADATA, organismGroup: "streptococcus", antibioticCode: "SXT",
    method: "mic", indication: "general",
    susceptibleMaxMgL: 1, resistantGreaterThanMgL: 2,
    interpretationCategories: ["S", "I", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, β-haemolytic strep, Trimethoprim-sulfamethoxazole`,
    flags: BHEM_ONLY,
    notes: "MIC S≤1, I=2, R>2 (TMP component).",
  },
  {
    ...EUCAST_2026_METADATA, organismGroup: "streptococcus", antibioticCode: "VAN",
    method: "mic", indication: "general",
    susceptibleMaxMgL: 2, resistantGreaterThanMgL: 2,
    interpretationCategories: ["S", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, β-haemolytic strep, Vancomycin`,
    flags: BHEM_ONLY,
    notes: "MIC S≤2, R>2.",
  },
  {
    ...EUCAST_2026_METADATA, organismGroup: "streptococcus", antibioticCode: "LZD",
    method: "mic", indication: "general",
    susceptibleMaxMgL: 2, resistantGreaterThanMgL: 4,
    interpretationCategories: ["S", "I", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, β-haemolytic strep, Linezolid`,
    flags: BHEM_ONLY,
    notes: "MIC S≤2, I=4, R>4.",
  },
  {
    ...EUCAST_2026_METADATA, organismGroup: "streptococcus", antibioticCode: "CHL",
    method: "mic", indication: "general",
    susceptibleMaxMgL: 8, resistantGreaterThanMgL: 8,
    interpretationCategories: ["S", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, β-haemolytic strep, Chloramphenicol`,
    flags: BHEM_ONLY,
    notes: "MIC S≤8, R>8.",
  },
  {
    ...EUCAST_2026_METADATA, organismGroup: "streptococcus", antibioticCode: "RIF",
    method: "mic", indication: "general",
    susceptibleMaxMgL: 0.06, resistantGreaterThanMgL: 0.5,
    interpretationCategories: ["S", "I", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, β-haemolytic strep, Rifampicin`,
    flags: BHEM_ONLY,
    notes: "Adjunct only. MIC S≤0.06, I=0.125-0.5, R>0.5.",
  },
  {
    ...EUCAST_2026_METADATA, organismGroup: "streptococcus", antibioticCode: "GEN",
    method: "mic", indication: "general",
    interpretationCategories: ["S", "I", "R", "ND"], breakpointStatus: "needs_validation",
    sourceTableRef: `${SRC}, β-haemolytic strep, Gentamicin (synergy)`,
    flags: BHEM_ONLY,
    notes: "Aminoglycosides used only for synergy with β-lactams in invasive disease — no monotherapy breakpoint.",
  },

  // ═══════════════════════════════════════════════════════════════════════
  // Viridans group streptococci (SVIR)
  // ═══════════════════════════════════════════════════════════════════════
  {
    ...EUCAST_2026_METADATA, organismGroup: "streptococcus", antibioticCode: "PEN",
    method: "mic", indication: "general",
    susceptibleMaxMgL: 0.25, resistantGreaterThanMgL: 2,
    interpretationCategories: ["S", "I", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, Viridans group, Penicillin`,
    flags: VIR_ONLY,
    notes: "MIC S≤0.25, I=0.5-2, R>2. Endocarditis: S≤0.125 with synergy.",
  },
  {
    ...EUCAST_2026_METADATA, organismGroup: "streptococcus", antibioticCode: "AMP",
    method: "mic", indication: "general",
    susceptibleMaxMgL: 0.5, resistantGreaterThanMgL: 4,
    interpretationCategories: ["S", "I", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, Viridans group, Ampicillin`,
    flags: VIR_ONLY,
    notes: "MIC S≤0.5, I=1-4, R>4.",
  },
  {
    ...EUCAST_2026_METADATA, organismGroup: "streptococcus", antibioticCode: "CRO",
    method: "mic", indication: "general",
    susceptibleMaxMgL: 0.5, resistantGreaterThanMgL: 2,
    interpretationCategories: ["S", "I", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, Viridans group, Ceftriaxone`,
    flags: VIR_ONLY,
    notes: "MIC S≤0.5, I=1-2, R>2.",
  },
  {
    ...EUCAST_2026_METADATA, organismGroup: "streptococcus", antibioticCode: "CTX",
    method: "mic", indication: "general",
    susceptibleMaxMgL: 0.5, resistantGreaterThanMgL: 2,
    interpretationCategories: ["S", "I", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, Viridans group, Cefotaxime`,
    flags: VIR_ONLY,
    notes: "MIC S≤0.5, I=1-2, R>2.",
  },
  {
    ...EUCAST_2026_METADATA, organismGroup: "streptococcus", antibioticCode: "MEM",
    method: "mic", indication: "general",
    susceptibleMaxMgL: 2, resistantGreaterThanMgL: 2,
    interpretationCategories: ["S", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, Viridans group, Meropenem`,
    flags: VIR_ONLY,
    notes: "MIC S≤2, R>2.",
  },
  {
    ...EUCAST_2026_METADATA, organismGroup: "streptococcus", antibioticCode: "VAN",
    method: "mic", indication: "general",
    susceptibleMaxMgL: 2, resistantGreaterThanMgL: 2,
    interpretationCategories: ["S", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, Viridans group, Vancomycin`,
    flags: VIR_ONLY,
    notes: "MIC S≤2, R>2.",
  },
  {
    ...EUCAST_2026_METADATA, organismGroup: "streptococcus", antibioticCode: "LZD",
    method: "mic", indication: "general",
    susceptibleMaxMgL: 2, resistantGreaterThanMgL: 4,
    interpretationCategories: ["S", "I", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, Viridans group, Linezolid`,
    flags: VIR_ONLY,
    notes: "MIC S≤2, I=4, R>4.",
  },
  {
    ...EUCAST_2026_METADATA, organismGroup: "streptococcus", antibioticCode: "CLI",
    method: "mic", indication: "general",
    susceptibleMaxMgL: 0.5, resistantGreaterThanMgL: 0.5,
    interpretationCategories: ["S", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, Viridans group, Clindamycin`,
    flags: VIR_ONLY,
    notes: "MIC S≤0.5, R>0.5.",
  },
  {
    ...EUCAST_2026_METADATA, organismGroup: "streptococcus", antibioticCode: "ERY",
    method: "mic", indication: "general",
    susceptibleMaxMgL: 0.25, resistantGreaterThanMgL: 0.5,
    interpretationCategories: ["S", "I", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, Viridans group, Erythromycin`,
    flags: VIR_ONLY,
    notes: "MIC S≤0.25, I=0.5, R>0.5.",
  },
  {
    ...EUCAST_2026_METADATA, organismGroup: "streptococcus", antibioticCode: "LVX",
    method: "mic", indication: "general",
    susceptibleMaxMgL: 2, resistantGreaterThanMgL: 2,
    interpretationCategories: ["S", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, Viridans group, Levofloxacin`,
    flags: VIR_ONLY,
    notes: "MIC S≤2, R>2.",
  },
  {
    ...EUCAST_2026_METADATA, organismGroup: "streptococcus", antibioticCode: "MXF",
    method: "mic", indication: "general",
    susceptibleMaxMgL: 0.5, resistantGreaterThanMgL: 0.5,
    interpretationCategories: ["S", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, Viridans group, Moxifloxacin`,
    flags: VIR_ONLY,
    notes: "MIC S≤0.5, R>0.5.",
  },
  {
    ...EUCAST_2026_METADATA, organismGroup: "streptococcus", antibioticCode: "TET",
    method: "mic", indication: "general",
    susceptibleMaxMgL: 1, resistantGreaterThanMgL: 2,
    interpretationCategories: ["S", "I", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, Viridans group, Tetracycline`,
    flags: VIR_ONLY,
    notes: "MIC S≤1, I=2, R>2.",
  },
  {
    ...EUCAST_2026_METADATA, organismGroup: "streptococcus", antibioticCode: "DOX",
    method: "mic", indication: "general",
    susceptibleMaxMgL: 1, resistantGreaterThanMgL: 2,
    interpretationCategories: ["S", "I", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, Viridans group, Doxycycline`,
    flags: VIR_ONLY,
    notes: "MIC S≤1, I=2, R>2.",
  },
  {
    ...EUCAST_2026_METADATA, organismGroup: "streptococcus", antibioticCode: "GEN",
    method: "mic", indication: "general",
    interpretationCategories: ["S", "I", "R", "ND"], breakpointStatus: "needs_validation",
    sourceTableRef: `${SRC}, Viridans group, Gentamicin (synergy)`,
    flags: VIR_ONLY,
    notes: "Used only for synergy with β-lactams in endocarditis — no monotherapy breakpoint.",
  },
  {
    ...EUCAST_2026_METADATA, organismGroup: "streptococcus", antibioticCode: "RIF",
    method: "mic", indication: "general",
    interpretationCategories: ["S", "I", "R", "ND"], breakpointStatus: "needs_validation",
    sourceTableRef: `${SRC}, Viridans group, Rifampicin`,
    flags: VIR_ONLY,
    notes: "No EUCAST clinical breakpoint vs viridans streptococci — adjunct only.",
  },

  // ═══════════════════════════════════════════════════════════════════════
  // Intrinsic / not-applicable block list — applies to ALL streptococci
  // ═══════════════════════════════════════════════════════════════════════
  ...(
    [
      ["AMK", "Amikacin — aminoglycosides have no monotherapy activity vs streptococci (intrinsic low-level R)."],
      ["TOB", "Tobramycin — intrinsic low-level R; no monotherapy breakpoint."],
      ["TZP", "Piperacillin-tazobactam — no streptococcal breakpoint; use PEN/AMP/CRO."],
      ["CAZ", "Ceftazidime — Gram-negative spectrum cephalosporin; no streptococcal activity."],
      ["CXM", "Cefuroxime — no EUCAST clinical breakpoint vs streptococci (use PEN/CRO)."],
      ["ATM", "Aztreonam — Gram-negative spectrum only."],
      ["CST", "Colistin — Gram-negative spectrum; intrinsic R in Gram-positives."],
      ["NIT", "Nitrofurantoin — no streptococcal clinical breakpoint."],
      ["FOS", "Fosfomycin — no EUCAST clinical breakpoint vs streptococci."],
      ["FOX", "Cefoxitin — staphylococcal mecA screen; not for streptococci."],
      ["OXA", "Oxacillin — anti-staphylococcal penicillin (other than the SPNE 1µg PEN screen, which is encoded separately)."],
      ["FUS", "Fusidic acid — no streptococcal clinical breakpoint."],
      ["MUP", "Mupirocin — topical anti-staphylococcal; not for streptococci."],
      ["DAP", "Daptomycin — no EUCAST streptococcal clinical breakpoint (used vs Gram-positives but not validated for strep)."],
      ["TGC", "Tigecycline — no EUCAST streptococcal breakpoint."],
      ["IPM", "Imipenem — no specific streptococcal breakpoint (use MEM)."],
      ["DOR", "Doripenem — no streptococcal clinical breakpoint."],
      ["ETP", "Ertapenem — no streptococcal clinical breakpoint (use MEM/CRO)."],
      ["TOL", "Ceftolozane-tazobactam — Gram-negative spectrum; no streptococcal breakpoint."],
      ["CZA", "Ceftazidime-avibactam — Gram-negative spectrum; no streptococcal breakpoint."],
      ["CFD", "Cefiderocol — Gram-negative siderophore cephalosporin; no streptococcal breakpoint."],
      ["MIN", "Minocycline — no EUCAST streptococcal breakpoint (use TET/DOX)."],
      ["TEC", "Teicoplanin — limited streptococcal data; rely on VAN."],
      ["CIP", "Ciprofloxacin — insufficient activity vs streptococci; use LVX/MXF instead."],
      ["HLG", "High-level Gentamicin — enterococcal synergy screen; not applicable to streptococci."],
      ["HLS", "High-level Streptomycin — enterococcal synergy screen; not applicable to streptococci."],
      ["QDA", "Quinupristin/dalfopristin — no routine EUCAST streptococcal breakpoint."],
    ] as const
  ).flatMap<EucastBreakpointRecord>(([code, reason]) => [
    {
      ...EUCAST_2026_METADATA, organismGroup: "streptococcus", antibioticCode: code,
      method: "mic", indication: "general",
      resistantGreaterThanMgL: 0,
      interpretationCategories: ["R"], breakpointStatus: "active",
      sourceTableRef: `${SRC}, ${code} (intrinsic / no clinical breakpoint)`,
      flags: { ...ALL_STREP, screeningOnly: false },
      notes: `${reason} Report R regardless of measured value (EUCAST Expected Resistant Phenotypes / no clinical breakpoint).`,
    },
    {
      ...EUCAST_2026_METADATA, organismGroup: "streptococcus", antibioticCode: code,
      method: "disk", indication: "general",
      resistantLessThanMm: 999,
      interpretationCategories: ["R"], breakpointStatus: "active",
      sourceTableRef: `${SRC}, ${code} (intrinsic / no clinical breakpoint)`,
      flags: { ...ALL_STREP, screeningOnly: false },
      notes: `${reason} Report R regardless of measured zone (EUCAST Expected Resistant Phenotypes / no clinical breakpoint).`,
    },
  ]),
];
