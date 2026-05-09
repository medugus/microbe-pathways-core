// EUCAST Clinical Breakpoint Tables v16.0, valid 1 Jan – 31 Dec 2026.
// Acinetobacter spp. — indication-aware breakpoints.
//
// All rows live under organismGroup "non_fermenter" and are restricted to
// A. baumannii complex (ABAU) via flags.restrictedSpecies = ["ABAU"] so they
// do not collide with the Pseudomonas rows (restricted to PAER) that share
// the same organismGroup.
//
// Strict EUCAST interpretation:
//   MIC : S if value ≤ susceptibleMaxMgL ; R if value > resistantGreaterThanMgL
//   Disk: S if value ≥ susceptibleMinMm  ; R if value < resistantLessThanMm
//
// Per EUCAST v16.0 (2026), Acinetobacter HAS clinical S categories for:
//   MEM (non-meningitis), IPM, LVX, SXT, AMK (UTI), GEN (UTI), TOB (UTI), CST.
// CIP is I/R only (off-scale S). Aminoglycosides for systemic infections are
// "bracketed" — same numeric thresholds, flagged for guidance.
//
// IE rows (TGC, MIN IV, eravacycline, netilmicin, gentamicin/tobramycin in
// older versions) are encoded as needs_validation so they are surfaced but
// never auto-interpreted.
//
// Intrinsic resistance / "no clinical activity" rows (AMP, AMC, CXM, CRO,
// ETP, ERY, CLI, VAN, TEC, LZD, FUS, MUP, OXA, FOX, PEN, NIT, FOS, CHL,
// RIF, DAP, HLG, HLS, QDA, TZP, CAZ, FEP, ATM, TOL, CZA) are encoded as
// breakpointStatus "active" with a single "R" category, so any value
// resolves to a hard "R — intrinsic / no breakpoint" with provenance.

import type { EucastBreakpointRecord } from "../types";
import { EUCAST_2026_METADATA } from "./notes";

const SRC = "EUCAST v16.0 2026, Acinetobacter spp.";
const ABAU_ONLY = { restrictedSpecies: ["ABAU"] };

export const EUCAST_2026_ACINETOBACTER_BREAKPOINTS: EucastBreakpointRecord[] = [
  // ─────────────────────────────────────────── MEM — Meropenem, non-meningitis (S/I/R)
  {
    ...EUCAST_2026_METADATA, organismGroup: "non_fermenter", antibioticCode: "MEM",
    method: "mic", indication: "non_meningitis",
    susceptibleMaxMgL: 2, resistantGreaterThanMgL: 8,
    interpretationCategories: ["S", "I", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, Meropenem (indications other than meningitis)`,
    flags: ABAU_ONLY,
    notes: "MIC S≤2, R>8 (I 4–8 = increased exposure 2 g x3 extended infusion).",
  },
  {
    ...EUCAST_2026_METADATA, organismGroup: "non_fermenter", antibioticCode: "MEM",
    method: "disk", indication: "non_meningitis",
    susceptibleMinMm: 21, resistantLessThanMm: 15,
    interpretationCategories: ["S", "I", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, Meropenem (indications other than meningitis)`,
    flags: ABAU_ONLY,
    notes: "Disk 10 µg. S≥21, R<15 (zones 15–20 = I).",
  },
  // ─────────────────────────────────────────── MEM — Meropenem, meningitis (S/R)
  {
    ...EUCAST_2026_METADATA, organismGroup: "non_fermenter", antibioticCode: "MEM",
    method: "mic", indication: "meningitis",
    susceptibleMaxMgL: 2, resistantGreaterThanMgL: 2,
    interpretationCategories: ["S", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, Meropenem (meningitis)`,
    flags: { ...ABAU_ONLY, meningitisOnly: true },
    notes: "Meningitis: MIC S≤2, R>2 (no I band).",
  },
  {
    ...EUCAST_2026_METADATA, organismGroup: "non_fermenter", antibioticCode: "MEM",
    method: "disk", indication: "meningitis",
    susceptibleMinMm: 21, resistantLessThanMm: 21,
    interpretationCategories: ["S", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, Meropenem (meningitis)`,
    flags: { ...ABAU_ONLY, meningitisOnly: true },
    notes: "Meningitis: disk 10 µg. S≥21, R<21.",
  },

  // ─────────────────────────────────────────── IPM — Imipenem (S/I/R)
  {
    ...EUCAST_2026_METADATA, organismGroup: "non_fermenter", antibioticCode: "IPM",
    method: "mic", indication: "general",
    susceptibleMaxMgL: 2, resistantGreaterThanMgL: 4,
    interpretationCategories: ["S", "I", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, Imipenem`,
    flags: ABAU_ONLY,
    notes: "MIC S≤2, R>4 (I=4 = increased exposure, 1 g x4/day).",
  },
  {
    ...EUCAST_2026_METADATA, organismGroup: "non_fermenter", antibioticCode: "IPM",
    method: "disk", indication: "general",
    susceptibleMinMm: 24, resistantLessThanMm: 21,
    interpretationCategories: ["S", "I", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, Imipenem`,
    flags: ABAU_ONLY,
    notes: "Disk 10 µg. S≥24, R<21 (zones 21–23 = I).",
  },

  // ─────────────────────────────────────────── DOR — Doripenem (I/R only)
  {
    ...EUCAST_2026_METADATA, organismGroup: "non_fermenter", antibioticCode: "DOR",
    method: "mic", indication: "general",
    susceptibleMaxMgL: 0.001, resistantGreaterThanMgL: 2,
    interpretationCategories: ["I", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, Doripenem`,
    flags: ABAU_ONLY,
    notes: "MIC I≤2, R>2. High-dose 1 g x3 prolonged infusion. No 'S' category.",
  },
  {
    ...EUCAST_2026_METADATA, organismGroup: "non_fermenter", antibioticCode: "DOR",
    method: "disk", indication: "general",
    susceptibleMinMm: 50, resistantLessThanMm: 22,
    interpretationCategories: ["I", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, Doripenem`,
    flags: ABAU_ONLY,
    notes: "Disk 10 µg. EUCAST off-scale S≥50, R<22; report I for zones ≥22. No 'S' category.",
  },

  // ─────────────────────────────────────────── CIP — Ciprofloxacin (I/R only)
  {
    ...EUCAST_2026_METADATA, organismGroup: "non_fermenter", antibioticCode: "CIP",
    method: "mic", indication: "general",
    susceptibleMaxMgL: 0.001, resistantGreaterThanMgL: 1,
    interpretationCategories: ["I", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, Ciprofloxacin`,
    flags: ABAU_ONLY,
    notes: "MIC I≤1, R>1. High-dose required (e.g. 400 mg x3 IV). No 'S' category.",
  },
  {
    ...EUCAST_2026_METADATA, organismGroup: "non_fermenter", antibioticCode: "CIP",
    method: "disk", indication: "general",
    susceptibleMinMm: 50, resistantLessThanMm: 21,
    interpretationCategories: ["I", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, Ciprofloxacin`,
    flags: ABAU_ONLY,
    notes: "Disk 5 µg. EUCAST off-scale S≥50, R<21; report I for zones ≥21. No 'S' category.",
  },

  // ─────────────────────────────────────────── LVX — Levofloxacin (S/I/R)
  {
    ...EUCAST_2026_METADATA, organismGroup: "non_fermenter", antibioticCode: "LVX",
    method: "mic", indication: "general",
    susceptibleMaxMgL: 0.5, resistantGreaterThanMgL: 1,
    interpretationCategories: ["S", "I", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, Levofloxacin`,
    flags: ABAU_ONLY,
    notes: "MIC S≤0.5, R>1 (I=1 = increased exposure 500 mg bid).",
  },
  {
    ...EUCAST_2026_METADATA, organismGroup: "non_fermenter", antibioticCode: "LVX",
    method: "disk", indication: "general",
    susceptibleMinMm: 23, resistantLessThanMm: 20,
    interpretationCategories: ["S", "I", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, Levofloxacin`,
    flags: ABAU_ONLY,
    notes: "Disk 5 µg. S≥23, R<20 (zones 20–22 = I).",
  },

  // ─────────────────────────────────────────── AMK — Amikacin (systemic bracketed + UTI)
  {
    ...EUCAST_2026_METADATA, organismGroup: "non_fermenter", antibioticCode: "AMK",
    method: "mic", indication: "systemic",
    susceptibleMaxMgL: 8, resistantGreaterThanMgL: 8,
    interpretationCategories: ["S", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, Amikacin (systemic)`,
    flags: { ...ABAU_ONLY, bracketed: true },
    notes: "Systemic: bracketed MIC S≤(8), R>(8). See EUCAST guidance on bracketed breakpoints.",
  },
  {
    ...EUCAST_2026_METADATA, organismGroup: "non_fermenter", antibioticCode: "AMK",
    method: "disk", indication: "systemic",
    susceptibleMinMm: 19, resistantLessThanMm: 19,
    interpretationCategories: ["S", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, Amikacin (systemic)`,
    flags: { ...ABAU_ONLY, bracketed: true },
    notes: "Systemic: bracketed disk 30 µg S≥(19), R<(19).",
  },
  {
    ...EUCAST_2026_METADATA, organismGroup: "non_fermenter", antibioticCode: "AMK",
    method: "mic", indication: "uti",
    susceptibleMaxMgL: 8, resistantGreaterThanMgL: 8,
    interpretationCategories: ["S", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, Amikacin (UTI)`,
    flags: { ...ABAU_ONLY, urinaryOnly: true },
    notes: "UTI origin: MIC S≤8, R>8.",
  },
  {
    ...EUCAST_2026_METADATA, organismGroup: "non_fermenter", antibioticCode: "AMK",
    method: "disk", indication: "uti",
    susceptibleMinMm: 19, resistantLessThanMm: 19,
    interpretationCategories: ["S", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, Amikacin (UTI)`,
    flags: { ...ABAU_ONLY, urinaryOnly: true },
    notes: "UTI origin: disk 30 µg S≥19, R<19.",
  },

  // ─────────────────────────────────────────── GEN — Gentamicin (NEW in v16.0: bracketed systemic + UTI)
  {
    ...EUCAST_2026_METADATA, organismGroup: "non_fermenter", antibioticCode: "GEN",
    method: "mic", indication: "systemic",
    susceptibleMaxMgL: 4, resistantGreaterThanMgL: 4,
    interpretationCategories: ["S", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, Gentamicin (systemic)`,
    flags: { ...ABAU_ONLY, bracketed: true },
    notes: "v16.0: systemic bracketed MIC S≤(4), R>(4). See EUCAST guidance on bracketed breakpoints.",
  },
  {
    ...EUCAST_2026_METADATA, organismGroup: "non_fermenter", antibioticCode: "GEN",
    method: "disk", indication: "systemic",
    susceptibleMinMm: 17, resistantLessThanMm: 17,
    interpretationCategories: ["S", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, Gentamicin (systemic)`,
    flags: { ...ABAU_ONLY, bracketed: true },
    notes: "v16.0: systemic bracketed disk 10 µg S≥(17), R<(17).",
  },
  {
    ...EUCAST_2026_METADATA, organismGroup: "non_fermenter", antibioticCode: "GEN",
    method: "mic", indication: "uti",
    susceptibleMaxMgL: 4, resistantGreaterThanMgL: 4,
    interpretationCategories: ["S", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, Gentamicin (UTI)`,
    flags: { ...ABAU_ONLY, urinaryOnly: true },
    notes: "v16.0: UTI origin MIC S≤4, R>4.",
  },
  {
    ...EUCAST_2026_METADATA, organismGroup: "non_fermenter", antibioticCode: "GEN",
    method: "disk", indication: "uti",
    susceptibleMinMm: 17, resistantLessThanMm: 17,
    interpretationCategories: ["S", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, Gentamicin (UTI)`,
    flags: { ...ABAU_ONLY, urinaryOnly: true },
    notes: "v16.0: UTI origin disk 10 µg S≥17, R<17.",
  },

  // ─────────────────────────────────────────── TOB — Tobramycin (NEW in v16.0: bracketed systemic + UTI)
  {
    ...EUCAST_2026_METADATA, organismGroup: "non_fermenter", antibioticCode: "TOB",
    method: "mic", indication: "systemic",
    susceptibleMaxMgL: 4, resistantGreaterThanMgL: 4,
    interpretationCategories: ["S", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, Tobramycin (systemic)`,
    flags: { ...ABAU_ONLY, bracketed: true },
    notes: "v16.0: systemic bracketed MIC S≤(4), R>(4).",
  },
  {
    ...EUCAST_2026_METADATA, organismGroup: "non_fermenter", antibioticCode: "TOB",
    method: "disk", indication: "systemic",
    susceptibleMinMm: 17, resistantLessThanMm: 17,
    interpretationCategories: ["S", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, Tobramycin (systemic)`,
    flags: { ...ABAU_ONLY, bracketed: true },
    notes: "v16.0: systemic bracketed disk 10 µg S≥(17), R<(17).",
  },
  {
    ...EUCAST_2026_METADATA, organismGroup: "non_fermenter", antibioticCode: "TOB",
    method: "mic", indication: "uti",
    susceptibleMaxMgL: 4, resistantGreaterThanMgL: 4,
    interpretationCategories: ["S", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, Tobramycin (UTI)`,
    flags: { ...ABAU_ONLY, urinaryOnly: true },
    notes: "v16.0: UTI origin MIC S≤4, R>4.",
  },
  {
    ...EUCAST_2026_METADATA, organismGroup: "non_fermenter", antibioticCode: "TOB",
    method: "disk", indication: "uti",
    susceptibleMinMm: 17, resistantLessThanMm: 17,
    interpretationCategories: ["S", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, Tobramycin (UTI)`,
    flags: { ...ABAU_ONLY, urinaryOnly: true },
    notes: "v16.0: UTI origin disk 10 µg S≥17, R<17.",
  },

  // ─────────────────────────────────────────── CST — Colistin (MIC only, BMD mandatory, bracketed)
  {
    ...EUCAST_2026_METADATA, organismGroup: "non_fermenter", antibioticCode: "CST",
    method: "mic", indication: "general",
    susceptibleMaxMgL: 2, resistantGreaterThanMgL: 2,
    interpretationCategories: ["S", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, Colistin`,
    flags: { ...ABAU_ONLY, bracketed: true },
    notes: "Bracketed MIC S≤(2), R>(2). ISO-20776 broth microdilution mandatory; QC with mcr-1 E. coli NCTC 13846. Disk and gradient strips NOT reliable.",
  },
  {
    ...EUCAST_2026_METADATA, organismGroup: "non_fermenter", antibioticCode: "CST",
    method: "disk", indication: "general",
    interpretationCategories: ["ND"], breakpointStatus: "not_applicable",
    sourceTableRef: `${SRC}, Colistin`,
    flags: ABAU_ONLY,
    notes: "Disk diffusion and gradient strip methods NOT reliable for colistin — use BMD only.",
  },

  // ─────────────────────────────────────────── SXT — Trimethoprim/sulfamethoxazole (S/R only)
  {
    ...EUCAST_2026_METADATA, organismGroup: "non_fermenter", antibioticCode: "SXT",
    method: "mic", indication: "general",
    susceptibleMaxMgL: 0.5, resistantGreaterThanMgL: 0.5,
    interpretationCategories: ["S", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, Trimethoprim-sulfamethoxazole`,
    flags: ABAU_ONLY,
    notes: "MIC S≤0.5, R>0.5 (trimethoprim component, ratio 1:19). No I band per v16.0.",
  },
  {
    ...EUCAST_2026_METADATA, organismGroup: "non_fermenter", antibioticCode: "SXT",
    method: "disk", indication: "general",
    susceptibleMinMm: 16, resistantLessThanMm: 16,
    interpretationCategories: ["S", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, Trimethoprim-sulfamethoxazole`,
    flags: ABAU_ONLY,
    notes: "Disk 1.25/23.75 µg. S≥16, R<16. No I band per v16.0.",
  },

  // ─────────────────────────────────────────── MIN — Minocycline (IE per v16.0)
  {
    ...EUCAST_2026_METADATA, organismGroup: "non_fermenter", antibioticCode: "MIN",
    method: "mic", indication: "general",
    interpretationCategories: ["S", "I", "R", "ND"], breakpointStatus: "needs_validation",
    sourceTableRef: `${SRC}, Minocycline`,
    flags: ABAU_ONLY,
    notes: "EUCAST v16.0: IE (insufficient evidence). IV only — oral does not achieve sufficient exposure. Refer to local validation / CLSI if needed.",
  },
  {
    ...EUCAST_2026_METADATA, organismGroup: "non_fermenter", antibioticCode: "MIN",
    method: "disk", indication: "general",
    interpretationCategories: ["S", "I", "R", "ND"], breakpointStatus: "needs_validation",
    sourceTableRef: `${SRC}, Minocycline`,
    flags: ABAU_ONLY,
    notes: "EUCAST v16.0: IE (insufficient evidence) for minocycline vs Acinetobacter.",
  },

  // ─────────────────────────────────────────── TGC — Tigecycline (IE per v16.0, NOT intrinsic R)
  {
    ...EUCAST_2026_METADATA, organismGroup: "non_fermenter", antibioticCode: "TGC",
    method: "mic", indication: "general",
    interpretationCategories: ["S", "I", "R", "ND"], breakpointStatus: "needs_validation",
    sourceTableRef: `${SRC}, Tigecycline`,
    flags: ABAU_ONLY,
    notes: "EUCAST v16.0: IE (insufficient evidence) — do not auto-interpret. Used in MDR Acinetobacter as last-line; refer to local validation.",
  },

  // ─────────────────────────────────────────── CFD — Cefiderocol (Note guidance)
  {
    ...EUCAST_2026_METADATA, organismGroup: "non_fermenter", antibioticCode: "CFD",
    method: "mic", indication: "general",
    interpretationCategories: ["S", "I", "R", "ND"], breakpointStatus: "needs_validation",
    sourceTableRef: `${SRC}, Cefiderocol`,
    flags: ABAU_ONLY,
    notes: "EUCAST v16.0: no clinical breakpoint. Guidance: MIC ≤0.5 (zone ≥21) likely target; MIC 1–2 acquired mechanisms, may still be option; MIC >2 (zone <17) likely R. Iron-depleted CAMHB BMD required.",
  },
  {
    ...EUCAST_2026_METADATA, organismGroup: "non_fermenter", antibioticCode: "CFD",
    method: "disk", indication: "general",
    interpretationCategories: ["S", "I", "R", "ND"], breakpointStatus: "needs_validation",
    sourceTableRef: `${SRC}, Cefiderocol`,
    flags: ABAU_ONLY,
    notes: "Disk 30 µg. EUCAST v16.0 guidance only: zone ≥21 likely target, <17 likely R.",
  },

  // ───────────────────────────────────────────────────────────────────────
  // Intrinsic / no-breakpoint block list (auto-resolves to "R")
  // Note: GEN, TOB, DOR, TGC, MIN removed from this list — see explicit rows above.
  // ───────────────────────────────────────────────────────────────────────
  ...(
    [
      // [code, reason]
      ["AMP", "Ampicillin — no clinically useful activity vs Acinetobacter (intrinsic AmpC + impermeability)."],
      ["AMC", "Amoxicillin-clavulanate — clavulanate does not restore activity against Acinetobacter intrinsic AmpC."],
      ["TZP", "Piperacillin-tazobactam — EUCAST v16.0: IE. No clinical breakpoint vs Acinetobacter; do not report S."],
      ["CXM", "Cefuroxime — 2nd-gen cephalosporin; no anti-Acinetobacter activity."],
      ["CRO", "Ceftriaxone — no clinical breakpoint vs Acinetobacter; intrinsic AmpC/efflux."],
      ["CAZ", "Ceftazidime — EUCAST has no clinical breakpoint vs Acinetobacter."],
      ["FEP", "Cefepime — EUCAST has no clinical breakpoint vs Acinetobacter."],
      ["ATM", "Aztreonam — no activity vs Acinetobacter (intrinsic AmpC + low affinity)."],
      ["ETP", "Ertapenem — group 1 carbapenem; no activity vs non-fermenters including Acinetobacter."],
      ["TOL", "Ceftolozane-tazobactam — no clinical breakpoint and no reliable activity vs Acinetobacter."],
      ["CZA", "Ceftazidime-avibactam — no clinical breakpoint vs Acinetobacter; avibactam does not restore CAZ activity."],
      ["NIT", "Nitrofurantoin — no clinically useful activity vs Acinetobacter."],
      ["FOS", "Fosfomycin — no EUCAST clinical breakpoint vs Acinetobacter for systemic infection."],
      ["CHL", "Chloramphenicol — no clinical breakpoint; intrinsic efflux."],
      ["ERY", "Erythromycin — Gram-negative impermeability + efflux; intrinsic R."],
      ["CLI", "Clindamycin — Gram-negative impermeability; intrinsic R."],
      ["VAN", "Vancomycin — Gram-negative outer membrane impermeable to glycopeptides."],
      ["TEC", "Teicoplanin — Gram-negative outer membrane impermeable to glycopeptides."],
      ["LZD", "Linezolid — Gram-positive spectrum only; no activity vs Acinetobacter."],
      ["RIF", "Rifampicin — no EUCAST clinical breakpoint vs Acinetobacter; not for monotherapy."],
      ["DAP", "Daptomycin — Gram-positive spectrum only."],
      ["FUS", "Fusidic acid — Gram-positive spectrum (mainly staphylococci)."],
      ["MUP", "Mupirocin — topical Gram-positive agent only."],
      ["OXA", "Oxacillin — anti-staphylococcal penicillin; no Gram-negative activity."],
      ["FOX", "Cefoxitin — used as mecA screen for staphylococci; not for Acinetobacter."],
      ["PEN", "Penicillin G — no activity vs Gram-negative non-fermenters."],
      ["DOX", "Doxycycline — no EUCAST clinical breakpoint vs Acinetobacter (2026)."],
      ["TET", "Tetracycline — no EUCAST clinical breakpoint vs Acinetobacter (2026)."],
      ["HLG", "High-level Gentamicin — enterococcal synergy screen; not applicable to Acinetobacter."],
      ["HLS", "High-level Streptomycin — enterococcal synergy screen; not applicable to Acinetobacter."],
      ["QDA", "Quinupristin/dalfopristin — Gram-positive spectrum; intrinsic R in Gram-negatives."],
    ] as const
  ).flatMap<EucastBreakpointRecord>(([code, reason]) => [
    {
      ...EUCAST_2026_METADATA, organismGroup: "non_fermenter", antibioticCode: code,
      method: "mic", indication: "general",
      resistantGreaterThanMgL: 0,
      interpretationCategories: ["R"], breakpointStatus: "active",
      sourceTableRef: `${SRC}, ${code} (intrinsic / no clinical breakpoint)`,
      flags: { ...ABAU_ONLY, screeningOnly: false },
      notes: `${reason} Report R regardless of measured value (EUCAST Expected Resistant Phenotypes / no clinical breakpoint).`,
    },
    {
      ...EUCAST_2026_METADATA, organismGroup: "non_fermenter", antibioticCode: code,
      method: "disk", indication: "general",
      resistantLessThanMm: 999,
      interpretationCategories: ["R"], breakpointStatus: "active",
      sourceTableRef: `${SRC}, ${code} (intrinsic / no clinical breakpoint)`,
      flags: { ...ABAU_ONLY, screeningOnly: false },
      notes: `${reason} Report R regardless of measured zone (EUCAST Expected Resistant Phenotypes / no clinical breakpoint).`,
    },
  ]),
];
