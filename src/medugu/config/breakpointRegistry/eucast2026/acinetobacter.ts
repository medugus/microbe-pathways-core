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
// Per EUCAST v16.0 (2026), Acinetobacter has very few drugs with a clinical
// "S" category — most active agents are encoded as "I or R" only (increased
// exposure required). Several common agents have NO EUCAST breakpoint
// (TZP, CAZ, FEP, CRO, ATM, AMC, CXM, TOL, CZA, ETP) and are encoded with
// breakpointStatus "needs_validation" so they are surfaced but never
// auto-interpreted.
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
  // ─────────────────────────────────────────── MEM — Meropenem (I/R only)
  {
    ...EUCAST_2026_METADATA, organismGroup: "non_fermenter", antibioticCode: "MEM",
    method: "mic", indication: "general",
    susceptibleMaxMgL: 0.001, resistantGreaterThanMgL: 8,
    interpretationCategories: ["I", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, Meropenem`,
    flags: ABAU_ONLY,
    notes: "MIC I≤8, R>8 (no 'S' category — increased exposure required, e.g. 2 g x3 extended infusion).",
  },
  {
    ...EUCAST_2026_METADATA, organismGroup: "non_fermenter", antibioticCode: "MEM",
    method: "disk", indication: "general",
    susceptibleMinMm: 999, resistantLessThanMm: 18,
    interpretationCategories: ["I", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, Meropenem`,
    flags: ABAU_ONLY,
    notes: "Disk 10 µg. I≥18, R<18. No 'S' category.",
  },

  // ─────────────────────────────────────────── IPM — Imipenem (I/R only)
  {
    ...EUCAST_2026_METADATA, organismGroup: "non_fermenter", antibioticCode: "IPM",
    method: "mic", indication: "general",
    susceptibleMaxMgL: 0.001, resistantGreaterThanMgL: 4,
    interpretationCategories: ["I", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, Imipenem`,
    flags: ABAU_ONLY,
    notes: "MIC I≤4, R>4. High-dose 1 g x4/day required.",
  },
  {
    ...EUCAST_2026_METADATA, organismGroup: "non_fermenter", antibioticCode: "IPM",
    method: "disk", indication: "general",
    susceptibleMinMm: 999, resistantLessThanMm: 22,
    interpretationCategories: ["I", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, Imipenem`,
    flags: ABAU_ONLY,
    notes: "Disk 10 µg. I≥22, R<22.",
  },

  // ─────────────────────────────────────────── CIP — Ciprofloxacin (I/R only)
  {
    ...EUCAST_2026_METADATA, organismGroup: "non_fermenter", antibioticCode: "CIP",
    method: "mic", indication: "general",
    susceptibleMaxMgL: 0.001, resistantGreaterThanMgL: 1,
    interpretationCategories: ["I", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, Ciprofloxacin`,
    flags: ABAU_ONLY,
    notes: "MIC I≤1, R>1. High-dose required (e.g. 400 mg x3 IV).",
  },
  {
    ...EUCAST_2026_METADATA, organismGroup: "non_fermenter", antibioticCode: "CIP",
    method: "disk", indication: "general",
    susceptibleMinMm: 999, resistantLessThanMm: 21,
    interpretationCategories: ["I", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, Ciprofloxacin`,
    flags: ABAU_ONLY,
    notes: "Disk 5 µg. I≥21, R<21.",
  },

  // ─────────────────────────────────────────── LVX — Levofloxacin (I/R only)
  {
    ...EUCAST_2026_METADATA, organismGroup: "non_fermenter", antibioticCode: "LVX",
    method: "mic", indication: "general",
    susceptibleMaxMgL: 0.001, resistantGreaterThanMgL: 1,
    interpretationCategories: ["I", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, Levofloxacin`,
    flags: ABAU_ONLY,
    notes: "MIC I≤1, R>1.",
  },
  {
    ...EUCAST_2026_METADATA, organismGroup: "non_fermenter", antibioticCode: "LVX",
    method: "disk", indication: "general",
    susceptibleMinMm: 999, resistantLessThanMm: 19,
    interpretationCategories: ["I", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, Levofloxacin`,
    flags: ABAU_ONLY,
    notes: "Disk 5 µg. I≥19, R<19.",
  },

  // ─────────────────────────────────────────── AMK — Amikacin (S/I/R)
  {
    ...EUCAST_2026_METADATA, organismGroup: "non_fermenter", antibioticCode: "AMK",
    method: "mic", indication: "general",
    susceptibleMaxMgL: 8, resistantGreaterThanMgL: 16,
    interpretationCategories: ["S", "I", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, Amikacin`,
    flags: ABAU_ONLY,
    notes: "MIC S≤8, I=16, R>16.",
  },
  {
    ...EUCAST_2026_METADATA, organismGroup: "non_fermenter", antibioticCode: "AMK",
    method: "disk", indication: "general",
    susceptibleMinMm: 18, resistantLessThanMm: 15,
    interpretationCategories: ["S", "I", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, Amikacin`,
    flags: ABAU_ONLY,
    notes: "Disk 30 µg. S≥18, R<15.",
  },

  // ─────────────────────────────────────────── GEN — Gentamicin (S/I/R)
  {
    ...EUCAST_2026_METADATA, organismGroup: "non_fermenter", antibioticCode: "GEN",
    method: "mic", indication: "general",
    susceptibleMaxMgL: 4, resistantGreaterThanMgL: 4,
    interpretationCategories: ["S", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, Gentamicin`,
    flags: ABAU_ONLY,
    notes: "MIC S≤4, R>4.",
  },
  {
    ...EUCAST_2026_METADATA, organismGroup: "non_fermenter", antibioticCode: "GEN",
    method: "disk", indication: "general",
    susceptibleMinMm: 17, resistantLessThanMm: 17,
    interpretationCategories: ["S", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, Gentamicin`,
    flags: ABAU_ONLY,
    notes: "Disk 10 µg. S≥17, R<17.",
  },

  // ─────────────────────────────────────────── TOB — Tobramycin (S/I/R)
  {
    ...EUCAST_2026_METADATA, organismGroup: "non_fermenter", antibioticCode: "TOB",
    method: "mic", indication: "general",
    susceptibleMaxMgL: 4, resistantGreaterThanMgL: 4,
    interpretationCategories: ["S", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, Tobramycin`,
    flags: ABAU_ONLY,
    notes: "MIC S≤4, R>4.",
  },
  {
    ...EUCAST_2026_METADATA, organismGroup: "non_fermenter", antibioticCode: "TOB",
    method: "disk", indication: "general",
    susceptibleMinMm: 17, resistantLessThanMm: 17,
    interpretationCategories: ["S", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, Tobramycin`,
    flags: ABAU_ONLY,
    notes: "Disk 10 µg. S≥17, R<17.",
  },

  // ─────────────────────────────────────────── CST — Colistin (MIC only, BMD mandatory)
  {
    ...EUCAST_2026_METADATA, organismGroup: "non_fermenter", antibioticCode: "CST",
    method: "mic", indication: "general",
    susceptibleMaxMgL: 2, resistantGreaterThanMgL: 2,
    interpretationCategories: ["S", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, Colistin`,
    flags: ABAU_ONLY,
    notes: "MIC S≤2, R>2. ISO-20776 broth microdilution mandatory; disk diffusion and gradient strips NOT reliable.",
  },
  {
    ...EUCAST_2026_METADATA, organismGroup: "non_fermenter", antibioticCode: "CST",
    method: "disk", indication: "general",
    interpretationCategories: ["ND"], breakpointStatus: "not_applicable",
    sourceTableRef: `${SRC}, Colistin`,
    flags: ABAU_ONLY,
    notes: "Disk diffusion and gradient strip methods are NOT reliable for colistin — use BMD only.",
  },

  // ─────────────────────────────────────────── SXT — Trimethoprim/sulfamethoxazole (S/I/R)
  {
    ...EUCAST_2026_METADATA, organismGroup: "non_fermenter", antibioticCode: "SXT",
    method: "mic", indication: "general",
    susceptibleMaxMgL: 2, resistantGreaterThanMgL: 4,
    interpretationCategories: ["S", "I", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, Trimethoprim-sulfamethoxazole`,
    flags: ABAU_ONLY,
    notes: "MIC S≤2, I=4, R>4 (trimethoprim component).",
  },
  {
    ...EUCAST_2026_METADATA, organismGroup: "non_fermenter", antibioticCode: "SXT",
    method: "disk", indication: "general",
    susceptibleMinMm: 14, resistantLessThanMm: 11,
    interpretationCategories: ["S", "I", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, Trimethoprim-sulfamethoxazole`,
    flags: ABAU_ONLY,
    notes: "Disk 1.25/23.75 µg. S≥14, R<11.",
  },

  // ─────────────────────────────────────────── MIN — Minocycline (needs validation)
  {
    ...EUCAST_2026_METADATA, organismGroup: "non_fermenter", antibioticCode: "MIN",
    method: "mic", indication: "general",
    interpretationCategories: ["S", "I", "R", "ND"], breakpointStatus: "needs_validation",
    sourceTableRef: `${SRC}, Minocycline`,
    flags: ABAU_ONLY,
    notes: "EUCAST has not set clinical breakpoints for minocycline vs Acinetobacter (2026); refer to local validation / CLSI if needed.",
  },
  {
    ...EUCAST_2026_METADATA, organismGroup: "non_fermenter", antibioticCode: "MIN",
    method: "disk", indication: "general",
    interpretationCategories: ["S", "I", "R", "ND"], breakpointStatus: "needs_validation",
    sourceTableRef: `${SRC}, Minocycline`,
    flags: ABAU_ONLY,
    notes: "EUCAST has not set clinical breakpoints for minocycline vs Acinetobacter (2026).",
  },

  // ─────────────────────────────────────────── CFD — Cefiderocol (needs validation)
  {
    ...EUCAST_2026_METADATA, organismGroup: "non_fermenter", antibioticCode: "CFD",
    method: "mic", indication: "general",
    interpretationCategories: ["S", "I", "R", "ND"], breakpointStatus: "needs_validation",
    sourceTableRef: `${SRC}, Cefiderocol`,
    flags: ABAU_ONLY,
    notes: "EUCAST 2026 lists PK/PD insufficient evidence for Acinetobacter clinical breakpoint; iron-depleted CAMHB BMD required if tested.",
  },
  {
    ...EUCAST_2026_METADATA, organismGroup: "non_fermenter", antibioticCode: "CFD",
    method: "disk", indication: "general",
    interpretationCategories: ["S", "I", "R", "ND"], breakpointStatus: "needs_validation",
    sourceTableRef: `${SRC}, Cefiderocol`,
    flags: ABAU_ONLY,
    notes: "Disk diffusion not reliable for cefiderocol vs Acinetobacter; BMD only.",
  },

  // ───────────────────────────────────────────────────────────────────────
  // Intrinsic / no-breakpoint block list (auto-resolves to "R")
  // ───────────────────────────────────────────────────────────────────────
  ...(
    [
      // [code, reason]
      ["AMP", "Ampicillin — no clinically useful activity vs Acinetobacter (intrinsic AmpC + impermeability)."],
      ["AMC", "Amoxicillin-clavulanate — clavulanate does not restore activity against Acinetobacter intrinsic AmpC."],
      ["TZP", "Piperacillin-tazobactam — EUCAST has no clinical breakpoint vs Acinetobacter; do not report S."],
      ["CXM", "Cefuroxime — 2nd-gen cephalosporin; no anti-Acinetobacter activity."],
      ["CRO", "Ceftriaxone — no clinical breakpoint vs Acinetobacter; intrinsic AmpC/efflux."],
      ["CAZ", "Ceftazidime — EUCAST has no clinical breakpoint vs Acinetobacter."],
      ["FEP", "Cefepime — EUCAST has no clinical breakpoint vs Acinetobacter."],
      ["ATM", "Aztreonam — no activity vs Acinetobacter (intrinsic AmpC + low affinity)."],
      ["ETP", "Ertapenem — group 1 carbapenem; no activity vs non-fermenters including Acinetobacter."],
      ["TOL", "Ceftolozane-tazobactam — no clinical breakpoint and no reliable activity vs Acinetobacter."],
      ["CZA", "Ceftazidime-avibactam — no clinical breakpoint vs Acinetobacter; avibactam does not restore CAZ activity."],
      ["TGC", "Tigecycline — EUCAST has no clinical breakpoint vs Acinetobacter (PK/PD inadequate at standard dose)."],
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
      ["DOR", "Doripenem — no EUCAST clinical breakpoint vs Acinetobacter (2026); use IPM/MEM instead."],
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
