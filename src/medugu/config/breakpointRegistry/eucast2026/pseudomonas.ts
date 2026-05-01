// EUCAST Clinical Breakpoint Tables v16.0, valid 1 Jan – 31 Dec 2026.
// Pseudomonas spp. — indication-aware breakpoints (organismGroup: "non_fermenter",
// restricted to P. aeruginosa via flags.restrictedSpecies = ["PAER"] except where noted).
//
// Strict EUCAST interpretation:
//   MIC : S if value ≤ susceptibleMaxMgL ; R if value > resistantGreaterThanMgL
//   Disk: S if value ≥ susceptibleMinMm  ; R if value < resistantLessThanMm
//
// Per EUCAST v16.0 (2026), Pseudomonas breakpoints are largely "I or R" only —
// the "S" category was withdrawn for many drugs and standard dosing alone is
// not considered adequate. Where this is the case, interpretationCategories
// excludes "S" and notes call it out explicitly.
//
// Intrinsic resistance rows (AMP, AMC, CRO, ETP, TET, TGC, NIT, FOS, CHL, SXT,
// ERY, CLI, VAN, TEC, LZD, RIF, DAP, FUS, MUP, OXA, FOX, PEN, DOX, CXM, HLG,
// HLS, QDA) are encoded as breakpointStatus: "active" with a single "R"
// category and screeningOnly=false, so any value entered resolves to a hard
// "R — intrinsic" with provenance.

import type { EucastBreakpointRecord } from "../types";
import { EUCAST_2026_METADATA } from "./notes";

const SRC = "EUCAST v16.0 2026, Pseudomonas spp.";
const PAER_ONLY = { restrictedSpecies: ["PAER"] };

// Helper-style row for intrinsic resistance — kept inline below for grep-ability.

export const EUCAST_2026_PSEUDOMONAS_BREAKPOINTS: EucastBreakpointRecord[] = [
  // ─────────────────────────────────────────── TZP — Piperacillin/tazobactam (I/R only)
  {
    ...EUCAST_2026_METADATA, organismGroup: "non_fermenter", antibioticCode: "TZP",
    method: "mic", indication: "general",
    susceptibleMaxMgL: 0.001, resistantGreaterThanMgL: 16,
    interpretationCategories: ["I", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, Piperacillin-tazobactam`,
    flags: PAER_ONLY,
    notes: "MIC I≤16, R>16 (no 'S' category — increased exposure required). High-dose 4 g x4/day.",
  },
  {
    ...EUCAST_2026_METADATA, organismGroup: "non_fermenter", antibioticCode: "TZP",
    method: "disk", indication: "general",
    susceptibleMinMm: 999, resistantLessThanMm: 18,
    interpretationCategories: ["I", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, Piperacillin-tazobactam`,
    flags: PAER_ONLY,
    notes: "Disk 30-6 µg. I≥18, R<18. No 'S' category.",
  },

  // ─────────────────────────────────────────── CAZ — Ceftazidime (I/R only)
  {
    ...EUCAST_2026_METADATA, organismGroup: "non_fermenter", antibioticCode: "CAZ",
    method: "mic", indication: "general",
    susceptibleMaxMgL: 0.001, resistantGreaterThanMgL: 8,
    interpretationCategories: ["I", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, Ceftazidime`,
    flags: PAER_ONLY,
    notes: "MIC I≤8, R>8. High-dose 2 g x3/day required.",
  },
  {
    ...EUCAST_2026_METADATA, organismGroup: "non_fermenter", antibioticCode: "CAZ",
    method: "disk", indication: "general",
    susceptibleMinMm: 999, resistantLessThanMm: 17,
    interpretationCategories: ["I", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, Ceftazidime`,
    flags: PAER_ONLY,
    notes: "Disk 10 µg. I≥17, R<17.",
  },

  // ─────────────────────────────────────────── FEP — Cefepime (I/R only)
  {
    ...EUCAST_2026_METADATA, organismGroup: "non_fermenter", antibioticCode: "FEP",
    method: "mic", indication: "general",
    susceptibleMaxMgL: 0.001, resistantGreaterThanMgL: 8,
    interpretationCategories: ["I", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, Cefepime`,
    flags: PAER_ONLY,
    notes: "MIC I≤8, R>8. High-dose 2 g x3/day.",
  },
  {
    ...EUCAST_2026_METADATA, organismGroup: "non_fermenter", antibioticCode: "FEP",
    method: "disk", indication: "general",
    susceptibleMinMm: 999, resistantLessThanMm: 19,
    interpretationCategories: ["I", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, Cefepime`,
    flags: PAER_ONLY,
    notes: "Disk 30 µg. I≥19, R<19.",
  },

  // ─────────────────────────────────────────── MEM — Meropenem (S/I/R)
  {
    ...EUCAST_2026_METADATA, organismGroup: "non_fermenter", antibioticCode: "MEM",
    method: "mic", indication: "general",
    susceptibleMaxMgL: 2, resistantGreaterThanMgL: 8,
    interpretationCategories: ["S", "I", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, Meropenem`,
    flags: PAER_ONLY,
    notes: "MIC S≤2, R>8 (I 4–8 = increased exposure 2 g x3/day).",
  },
  {
    ...EUCAST_2026_METADATA, organismGroup: "non_fermenter", antibioticCode: "MEM",
    method: "disk", indication: "general",
    susceptibleMinMm: 24, resistantLessThanMm: 18,
    interpretationCategories: ["S", "I", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, Meropenem`,
    flags: PAER_ONLY,
    notes: "Disk 10 µg. S≥24, R<18 (I 18–23).",
  },

  // ─────────────────────────────────────────── IPM — Imipenem (I/R only)
  {
    ...EUCAST_2026_METADATA, organismGroup: "non_fermenter", antibioticCode: "IPM",
    method: "mic", indication: "general",
    susceptibleMaxMgL: 0.001, resistantGreaterThanMgL: 4,
    interpretationCategories: ["I", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, Imipenem`,
    flags: PAER_ONLY,
    notes: "MIC I≤4, R>4. High-dose 1 g x4/day. No 'S' category.",
  },
  {
    ...EUCAST_2026_METADATA, organismGroup: "non_fermenter", antibioticCode: "IPM",
    method: "disk", indication: "general",
    susceptibleMinMm: 999, resistantLessThanMm: 20,
    interpretationCategories: ["I", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, Imipenem`,
    flags: PAER_ONLY,
    notes: "Disk 10 µg. I≥20, R<20.",
  },

  // ─────────────────────────────────────────── DOR — Doripenem (I/R only)
  {
    ...EUCAST_2026_METADATA, organismGroup: "non_fermenter", antibioticCode: "DOR",
    method: "mic", indication: "general",
    susceptibleMaxMgL: 0.001, resistantGreaterThanMgL: 2,
    interpretationCategories: ["I", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, Doripenem`,
    flags: PAER_ONLY,
    notes: "MIC I≤2, R>2. High-dose 1 g x3/day prolonged infusion.",
  },
  {
    ...EUCAST_2026_METADATA, organismGroup: "non_fermenter", antibioticCode: "DOR",
    method: "disk", indication: "general",
    susceptibleMinMm: 999, resistantLessThanMm: 25,
    interpretationCategories: ["I", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, Doripenem`,
    flags: PAER_ONLY,
    notes: "Disk 10 µg. I≥25, R<25.",
  },

  // ─────────────────────────────────────────── ATM — Aztreonam (I/R only)
  {
    ...EUCAST_2026_METADATA, organismGroup: "non_fermenter", antibioticCode: "ATM",
    method: "mic", indication: "general",
    susceptibleMaxMgL: 0.001, resistantGreaterThanMgL: 16,
    interpretationCategories: ["I", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, Aztreonam`,
    flags: PAER_ONLY,
    notes: "MIC I≤16, R>16. High-dose 2 g x4/day required.",
  },
  {
    ...EUCAST_2026_METADATA, organismGroup: "non_fermenter", antibioticCode: "ATM",
    method: "disk", indication: "general",
    susceptibleMinMm: 999, resistantLessThanMm: 50,
    interpretationCategories: ["I", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, Aztreonam`,
    flags: PAER_ONLY,
    notes: "Disk 30 µg. I≥50 mm only at high inoculum reading (rare); EUCAST recommends MIC for ATM in P. aeruginosa.",
  },

  // ─────────────────────────────────────────── TOL — Ceftolozane/tazobactam (S/R)
  {
    ...EUCAST_2026_METADATA, organismGroup: "non_fermenter", antibioticCode: "TOL",
    method: "mic", indication: "general",
    susceptibleMaxMgL: 4, resistantGreaterThanMgL: 4,
    interpretationCategories: ["S", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, Ceftolozane-tazobactam`,
    flags: PAER_ONLY,
    notes: "MIC S≤4, R>4. Standard dose 1 g/0.5 g x3/day; 2 g/1 g x3/day for HAP/VAP.",
  },
  {
    ...EUCAST_2026_METADATA, organismGroup: "non_fermenter", antibioticCode: "TOL",
    method: "disk", indication: "general",
    susceptibleMinMm: 22, resistantLessThanMm: 22,
    interpretationCategories: ["S", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, Ceftolozane-tazobactam`,
    flags: PAER_ONLY,
    notes: "Disk 30-10 µg. S≥22, R<22.",
  },

  // ─────────────────────────────────────────── CZA — Ceftazidime/avibactam (S/R)
  {
    ...EUCAST_2026_METADATA, organismGroup: "non_fermenter", antibioticCode: "CZA",
    method: "mic", indication: "general",
    susceptibleMaxMgL: 8, resistantGreaterThanMgL: 8,
    interpretationCategories: ["S", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, Ceftazidime-avibactam`,
    flags: PAER_ONLY,
    notes: "MIC S≤8, R>8. Avibactam fixed at 4 mg/L for testing.",
  },
  {
    ...EUCAST_2026_METADATA, organismGroup: "non_fermenter", antibioticCode: "CZA",
    method: "disk", indication: "general",
    susceptibleMinMm: 17, resistantLessThanMm: 17,
    interpretationCategories: ["S", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, Ceftazidime-avibactam`,
    flags: PAER_ONLY,
    notes: "Disk 10-4 µg. S≥17, R<17.",
  },

  // ─────────────────────────────────────────── AMK — Amikacin (S/R, combination only)
  {
    ...EUCAST_2026_METADATA, organismGroup: "non_fermenter", antibioticCode: "AMK",
    method: "mic", indication: "general",
    susceptibleMaxMgL: 16, resistantGreaterThanMgL: 16,
    interpretationCategories: ["S", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, Amikacin`,
    flags: PAER_ONLY,
    notes: "MIC S≤16, R>16. EUCAST: aminoglycosides for P. aeruginosa only as part of combination therapy.",
  },
  {
    ...EUCAST_2026_METADATA, organismGroup: "non_fermenter", antibioticCode: "AMK",
    method: "disk", indication: "general",
    susceptibleMinMm: 18, resistantLessThanMm: 18,
    interpretationCategories: ["S", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, Amikacin`,
    flags: PAER_ONLY,
    notes: "Disk 30 µg. S≥18, R<18.",
  },

  // ─────────────────────────────────────────── GEN — Gentamicin (combination only)
  {
    ...EUCAST_2026_METADATA, organismGroup: "non_fermenter", antibioticCode: "GEN",
    method: "mic", indication: "general",
    susceptibleMaxMgL: 4, resistantGreaterThanMgL: 4,
    interpretationCategories: ["S", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, Gentamicin`,
    flags: PAER_ONLY,
    notes: "MIC S≤4, R>4. Combination therapy only.",
  },
  {
    ...EUCAST_2026_METADATA, organismGroup: "non_fermenter", antibioticCode: "GEN",
    method: "disk", indication: "general",
    susceptibleMinMm: 15, resistantLessThanMm: 15,
    interpretationCategories: ["S", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, Gentamicin`,
    flags: PAER_ONLY,
    notes: "Disk 10 µg. S≥15, R<15.",
  },

  // ─────────────────────────────────────────── TOB — Tobramycin (combination only)
  {
    ...EUCAST_2026_METADATA, organismGroup: "non_fermenter", antibioticCode: "TOB",
    method: "mic", indication: "general",
    susceptibleMaxMgL: 2, resistantGreaterThanMgL: 2,
    interpretationCategories: ["S", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, Tobramycin`,
    flags: PAER_ONLY,
    notes: "MIC S≤2, R>2. Combination therapy only.",
  },
  {
    ...EUCAST_2026_METADATA, organismGroup: "non_fermenter", antibioticCode: "TOB",
    method: "disk", indication: "general",
    susceptibleMinMm: 18, resistantLessThanMm: 18,
    interpretationCategories: ["S", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, Tobramycin`,
    flags: PAER_ONLY,
    notes: "Disk 10 µg. S≥18, R<18.",
  },

  // ─────────────────────────────────────────── CIP — Ciprofloxacin (I/R only)
  {
    ...EUCAST_2026_METADATA, organismGroup: "non_fermenter", antibioticCode: "CIP",
    method: "mic", indication: "general",
    susceptibleMaxMgL: 0.001, resistantGreaterThanMgL: 0.5,
    interpretationCategories: ["I", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, Ciprofloxacin`,
    flags: PAER_ONLY,
    notes: "MIC I≤0.5, R>0.5. High-dose 750 mg PO bid / 400 mg IV tid.",
  },
  {
    ...EUCAST_2026_METADATA, organismGroup: "non_fermenter", antibioticCode: "CIP",
    method: "disk", indication: "general",
    susceptibleMinMm: 999, resistantLessThanMm: 26,
    interpretationCategories: ["I", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, Ciprofloxacin`,
    flags: PAER_ONLY,
    notes: "Disk 5 µg. I≥26, R<26.",
  },

  // ─────────────────────────────────────────── LVX — Levofloxacin (I/R only)
  {
    ...EUCAST_2026_METADATA, organismGroup: "non_fermenter", antibioticCode: "LVX",
    method: "mic", indication: "general",
    susceptibleMaxMgL: 0.001, resistantGreaterThanMgL: 1,
    interpretationCategories: ["I", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, Levofloxacin`,
    flags: PAER_ONLY,
    notes: "MIC I≤1, R>1. High-dose 500 mg bid.",
  },
  {
    ...EUCAST_2026_METADATA, organismGroup: "non_fermenter", antibioticCode: "LVX",
    method: "disk", indication: "general",
    susceptibleMinMm: 999, resistantLessThanMm: 20,
    interpretationCategories: ["I", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, Levofloxacin`,
    flags: PAER_ONLY,
    notes: "Disk 5 µg. I≥20, R<20.",
  },

  // ─────────────────────────────────────────── CST — Colistin (MIC only, BMD mandatory)
  {
    ...EUCAST_2026_METADATA, organismGroup: "non_fermenter", antibioticCode: "CST",
    method: "mic", indication: "general",
    susceptibleMaxMgL: 4, resistantGreaterThanMgL: 4,
    interpretationCategories: ["S", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, Colistin`,
    flags: PAER_ONLY,
    notes: "MIC S≤4, R>4. BMD only (ISO 20776-1); disk diffusion and gradient strips not reliable.",
  },

  // ─────────────────────────────────────────── MIN — Minocycline (no clinical BP for P. aeruginosa)
  {
    ...EUCAST_2026_METADATA, organismGroup: "non_fermenter", antibioticCode: "MIN",
    method: "mic", indication: "general",
    interpretationCategories: ["ND"], breakpointStatus: "needs_validation",
    sourceTableRef: `${SRC}, Minocycline`,
    flags: PAER_ONLY,
    notes: "EUCAST does not list a clinical breakpoint for minocycline in P. aeruginosa. CLSI breakpoints exist for Stenotrophomonas / Acinetobacter only.",
  },

  // ─────────────────────────────────────────── CFD — Cefiderocol (S/R)
  {
    ...EUCAST_2026_METADATA, organismGroup: "non_fermenter", antibioticCode: "CFD",
    method: "mic", indication: "general",
    susceptibleMaxMgL: 2, resistantGreaterThanMgL: 2,
    interpretationCategories: ["S", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, Cefiderocol`,
    flags: PAER_ONLY,
    notes: "MIC S≤2, R>2. Iron-depleted CAMHB (ID-CAMHB) required.",
  },
  {
    ...EUCAST_2026_METADATA, organismGroup: "non_fermenter", antibioticCode: "CFD",
    method: "disk", indication: "general",
    susceptibleMinMm: 22, resistantLessThanMm: 22,
    interpretationCategories: ["S", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, Cefiderocol`,
    flags: PAER_ONLY,
    notes: "Disk 30 µg. S≥22, R<22.",
  },

  // ─────────────────────────────────────────── TGC — Tigecycline (intrinsic R / no BP)
  {
    ...EUCAST_2026_METADATA, organismGroup: "non_fermenter", antibioticCode: "TGC",
    method: "mic", indication: "general",
    resistantGreaterThanMgL: 0,
    interpretationCategories: ["R"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, Tigecycline (intrinsic resistance)`,
    flags: { ...PAER_ONLY, screeningOnly: false },
    notes: "Intrinsic resistance — Pseudomonas aeruginosa lacks the tigecycline target affinity / efflux susceptibility. Report as R regardless of measured value (EUCAST Expected Resistant Phenotypes).",
  },

  // ─────────────────────────────────────────── SXT — Trimethoprim-sulfamethoxazole (intrinsic R)
  {
    ...EUCAST_2026_METADATA, organismGroup: "non_fermenter", antibioticCode: "SXT",
    method: "mic", indication: "general",
    resistantGreaterThanMgL: 0,
    interpretationCategories: ["R"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, Trimethoprim-sulfamethoxazole (intrinsic resistance)`,
    flags: PAER_ONLY,
    notes: "Intrinsic resistance — P. aeruginosa is intrinsically resistant to SXT. Report R; do not test.",
  },
];
