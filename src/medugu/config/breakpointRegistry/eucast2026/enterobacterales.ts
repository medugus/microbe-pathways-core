// EUCAST Clinical Breakpoint Tables v16.0, valid 1 Jan – 31 Dec 2026.
// Enterobacterales — full indication-aware breakpoint table.
//
// Strict EUCAST interpretation:
//   MIC : S if value ≤ susceptibleMaxMgL ; R if value > resistantGreaterThanMgL
//   Disk: S if value ≥ susceptibleMinMm  ; R if value < resistantLessThanMm
// When S and R thresholds coincide, no I (intermediate) category exists.
//
// Composite key per row (resolveBreakpoint enforces uniqueness):
//   organismGroup + antibioticCode + method + indication
//
// All rows are `active`; the resolver picks the row matching syndrome /
// organism context, with a documented fallback chain. Indication-specific
// rows are NOT collapsed into a single "general" row.
//
// Flags carried per row drive validation + UI badges:
//   - bracketed         : EUCAST bracketed breakpoint (warn if used routinely)
//   - screeningOnly     : screening / surrogate breakpoint, not for routine reporting
//   - restrictedSpecies : list of organism codes the row may be applied to
//   - meningitisOnly / urinaryOnly / oralOnly : context guards

import type { EucastBreakpointRecord } from "../types";
import { EUCAST_2026_METADATA } from "./notes";

const SRC = "EUCAST v16.0 2026, Enterobacterales";
const ECOLI_ONLY = ["ECOL"];
// EUCAST cefuroxime "limited species" list (E. coli, Klebsiella, P. mirabilis,
// Raoultella). Encoded as the codes present in our organism dictionary.
const CXM_LIMITED_SPECIES = ["ECOL", "KPNE", "PMIR"];

export const EUCAST_2026_ENTEROBACTERALES_BREAKPOINTS: EucastBreakpointRecord[] = [
  // ─────────────────────────────────────────── AMP — Ampicillin (IV / oral UTI)
  {
    ...EUCAST_2026_METADATA, organismGroup: "enterobacterales", antibioticCode: "AMP",
    method: "mic", indication: "general",
    susceptibleMaxMgL: 8, resistantGreaterThanMgL: 8,
    interpretationCategories: ["S", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, Ampicillin IV/oral UTI`,
    notes: "MIC S≤8, R>8.",
  },
  {
    ...EUCAST_2026_METADATA, organismGroup: "enterobacterales", antibioticCode: "AMP",
    method: "disk", indication: "general",
    susceptibleMinMm: 14, resistantLessThanMm: 14,
    interpretationCategories: ["S", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, Ampicillin IV/oral UTI`,
    notes: "Disk 10 µg. S≥14, R<14.",
  },

  // ─────────────────────────────────────────── AMC — Amoxicillin-clavulanate
  // IV systemic
  {
    ...EUCAST_2026_METADATA, organismGroup: "enterobacterales", antibioticCode: "AMC",
    method: "mic", indication: "iv",
    susceptibleMaxMgL: 8, resistantGreaterThanMgL: 8,
    interpretationCategories: ["S", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, AMC IV`,
    notes: "MIC S≤8, R>8 (clavulanate fixed at 2 mg/L).",
  },
  {
    ...EUCAST_2026_METADATA, organismGroup: "enterobacterales", antibioticCode: "AMC",
    method: "disk", indication: "iv",
    susceptibleMinMm: 19, resistantLessThanMm: 19,
    interpretationCategories: ["S", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, AMC IV`,
    notes: "Disk 20-10 µg. S≥19, R<19.",
  },
  // Oral, urinary-origin infection (S≤0.001 / R>8 — bracketed area)
  {
    ...EUCAST_2026_METADATA, organismGroup: "enterobacterales", antibioticCode: "AMC",
    method: "mic", indication: "uti",
    susceptibleMaxMgL: 0.001, resistantGreaterThanMgL: 8,
    interpretationCategories: ["S", "I", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, AMC oral, urinary-origin infection`,
    flags: { urinaryOnly: true, oralOnly: true },
    notes: "Oral, urinary-origin infection. Disk 20-10 µg, S≥50, R<19.",
  },
  {
    ...EUCAST_2026_METADATA, organismGroup: "enterobacterales", antibioticCode: "AMC",
    method: "disk", indication: "uti",
    susceptibleMinMm: 50, resistantLessThanMm: 19,
    interpretationCategories: ["S", "I", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, AMC oral, urinary-origin infection`,
    flags: { urinaryOnly: true, oralOnly: true },
  },
  // Oral uncomplicated UTI (S≤32 / R>32)
  {
    ...EUCAST_2026_METADATA, organismGroup: "enterobacterales", antibioticCode: "AMC",
    method: "mic", indication: "uti_uncomplicated",
    susceptibleMaxMgL: 32, resistantGreaterThanMgL: 32,
    interpretationCategories: ["S", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, AMC oral uncomplicated UTI`,
    flags: { urinaryOnly: true, oralOnly: true },
    notes: "Oral uncomplicated UTI. MIC S≤32, R>32.",
  },

  // ─────────────────────────────────────────── CXM — Cefuroxime (limited species)
  // IV
  {
    ...EUCAST_2026_METADATA, organismGroup: "enterobacterales", antibioticCode: "CXM",
    method: "mic", indication: "iv",
    susceptibleMaxMgL: 0.001, resistantGreaterThanMgL: 8,
    interpretationCategories: ["S", "I", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, Cefuroxime IV, limited species`,
    flags: { restrictedSpecies: CXM_LIMITED_SPECIES },
    notes: "Limited species (E. coli, Klebsiella, P. mirabilis).",
  },
  // IV disk (off-scale S — same as MIC S≤0.001)
  {
    ...EUCAST_2026_METADATA, organismGroup: "enterobacterales", antibioticCode: "CXM",
    method: "disk", indication: "iv",
    susceptibleMinMm: 50, resistantLessThanMm: 19,
    interpretationCategories: ["I", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, Cefuroxime IV, limited species`,
    flags: { restrictedSpecies: CXM_LIMITED_SPECIES },
    notes: "Disk 30 µg. EUCAST v16.0 off-scale S≥(50), R<19. Limited species (E. coli, Klebsiella, P. mirabilis).",
  },
  // Oral UTI
  {
    ...EUCAST_2026_METADATA, organismGroup: "enterobacterales", antibioticCode: "CXM",
    method: "mic", indication: "uti",
    susceptibleMaxMgL: 8, resistantGreaterThanMgL: 8,
    interpretationCategories: ["S", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, Cefuroxime oral UTI, limited species`,
    flags: { restrictedSpecies: CXM_LIMITED_SPECIES, urinaryOnly: true, oralOnly: true },
    notes: "Oral UTI. MIC S≤8, R>8. Limited species only.",
  },
  {
    ...EUCAST_2026_METADATA, organismGroup: "enterobacterales", antibioticCode: "CXM",
    method: "disk", indication: "uti",
    susceptibleMinMm: 19, resistantLessThanMm: 19,
    interpretationCategories: ["S", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, Cefuroxime oral UTI, limited species`,
    flags: { restrictedSpecies: CXM_LIMITED_SPECIES, urinaryOnly: true, oralOnly: true },
    notes: "Disk 30 µg. S≥19, R<19.",
  },

  // ─────────────────────────────────────────── CRO — Ceftriaxone
  // Non-meningitis (general default)
  {
    ...EUCAST_2026_METADATA, organismGroup: "enterobacterales", antibioticCode: "CRO",
    method: "mic", indication: "non_meningitis",
    susceptibleMaxMgL: 1, resistantGreaterThanMgL: 2,
    interpretationCategories: ["S", "I", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, Ceftriaxone non-meningitis`,
    notes: "MIC S≤1, R>2. I (1<MIC≤2) = susceptible, increased exposure.",
  },
  {
    ...EUCAST_2026_METADATA, organismGroup: "enterobacterales", antibioticCode: "CRO",
    method: "disk", indication: "non_meningitis",
    susceptibleMinMm: 27, resistantLessThanMm: 24,
    interpretationCategories: ["S", "I", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, Ceftriaxone non-meningitis`,
    notes: "Disk 30 µg. S≥27, R<24.",
  },
  // Meningitis
  {
    ...EUCAST_2026_METADATA, organismGroup: "enterobacterales", antibioticCode: "CRO",
    method: "mic", indication: "meningitis",
    susceptibleMaxMgL: 1, resistantGreaterThanMgL: 1,
    interpretationCategories: ["S", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, Ceftriaxone meningitis`,
    flags: { meningitisOnly: true },
    notes: "Meningitis. MIC S≤1, R>1. No I.",
  },
  {
    ...EUCAST_2026_METADATA, organismGroup: "enterobacterales", antibioticCode: "CRO",
    method: "disk", indication: "meningitis",
    susceptibleMinMm: 27, resistantLessThanMm: 27,
    interpretationCategories: ["S", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, Ceftriaxone meningitis`,
    flags: { meningitisOnly: true },
    notes: "Meningitis. Disk 30 µg. S≥27, R<27.",
  },

  // ─────────────────────────────────────────── CAZ — Ceftazidime
  {
    ...EUCAST_2026_METADATA, organismGroup: "enterobacterales", antibioticCode: "CAZ",
    method: "mic", indication: "general",
    susceptibleMaxMgL: 1, resistantGreaterThanMgL: 4,
    interpretationCategories: ["S", "I", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, Ceftazidime`,
    notes: "MIC S≤1, R>4.",
  },
  {
    ...EUCAST_2026_METADATA, organismGroup: "enterobacterales", antibioticCode: "CAZ",
    method: "disk", indication: "general",
    susceptibleMinMm: 22, resistantLessThanMm: 19,
    interpretationCategories: ["S", "I", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, Ceftazidime`,
    notes: "Disk 10 µg. S≥22, R<19.",
  },

  // ─────────────────────────────────────────── FEP — Cefepime
  {
    ...EUCAST_2026_METADATA, organismGroup: "enterobacterales", antibioticCode: "FEP",
    method: "mic", indication: "general",
    susceptibleMaxMgL: 1, resistantGreaterThanMgL: 4,
    interpretationCategories: ["S", "I", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, Cefepime`,
    notes: "MIC S≤1, R>4.",
  },
  {
    ...EUCAST_2026_METADATA, organismGroup: "enterobacterales", antibioticCode: "FEP",
    method: "disk", indication: "general",
    susceptibleMinMm: 27, resistantLessThanMm: 24,
    interpretationCategories: ["S", "I", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, Cefepime`,
    notes: "Disk 30 µg. S≥27, R<24.",
  },

  // ─────────────────────────────────────────── TZP — Piperacillin-tazobactam
  {
    ...EUCAST_2026_METADATA, organismGroup: "enterobacterales", antibioticCode: "TZP",
    method: "mic", indication: "general",
    susceptibleMaxMgL: 8, resistantGreaterThanMgL: 8,
    interpretationCategories: ["S", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, Piperacillin-tazobactam`,
    notes: "MIC S≤8, R>8. Tazobactam fixed at 4 mg/L.",
  },
  {
    ...EUCAST_2026_METADATA, organismGroup: "enterobacterales", antibioticCode: "TZP",
    method: "disk", indication: "general",
    susceptibleMinMm: 20, resistantLessThanMm: 20,
    interpretationCategories: ["S", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, Piperacillin-tazobactam`,
    notes: "Disk 30-6 µg. S≥20, R<20.",
  },

  // ─────────────────────────────────────────── ETP — Ertapenem
  {
    ...EUCAST_2026_METADATA, organismGroup: "enterobacterales", antibioticCode: "ETP",
    method: "mic", indication: "general",
    susceptibleMaxMgL: 0.5, resistantGreaterThanMgL: 0.5,
    interpretationCategories: ["S", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, Ertapenem`,
    notes: "MIC S≤0.5, R>0.5.",
  },
  {
    ...EUCAST_2026_METADATA, organismGroup: "enterobacterales", antibioticCode: "ETP",
    method: "disk", indication: "general",
    susceptibleMinMm: 23, resistantLessThanMm: 23,
    interpretationCategories: ["S", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, Ertapenem`,
    notes: "Disk 10 µg. S≥23, R<23.",
  },

  // ─────────────────────────────────────────── MEM — Meropenem
  // Non-meningitis (default)
  {
    ...EUCAST_2026_METADATA, organismGroup: "enterobacterales", antibioticCode: "MEM",
    method: "mic", indication: "non_meningitis",
    susceptibleMaxMgL: 2, resistantGreaterThanMgL: 8,
    interpretationCategories: ["S", "I", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, Meropenem non-meningitis`,
    notes: "MIC S≤2, R>8.",
  },
  {
    ...EUCAST_2026_METADATA, organismGroup: "enterobacterales", antibioticCode: "MEM",
    method: "disk", indication: "non_meningitis",
    susceptibleMinMm: 22, resistantLessThanMm: 16,
    interpretationCategories: ["S", "I", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, Meropenem non-meningitis`,
    notes: "Disk 10 µg. S≥22, R<16.",
  },
  // Meningitis
  {
    ...EUCAST_2026_METADATA, organismGroup: "enterobacterales", antibioticCode: "MEM",
    method: "mic", indication: "meningitis",
    susceptibleMaxMgL: 2, resistantGreaterThanMgL: 2,
    interpretationCategories: ["S", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, Meropenem meningitis`,
    flags: { meningitisOnly: true },
    notes: "Meningitis. MIC S≤2, R>2.",
  },
  {
    ...EUCAST_2026_METADATA, organismGroup: "enterobacterales", antibioticCode: "MEM",
    method: "disk", indication: "meningitis",
    susceptibleMinMm: 22, resistantLessThanMm: 22,
    interpretationCategories: ["S", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, Meropenem meningitis`,
    flags: { meningitisOnly: true },
    notes: "Meningitis. Disk 10 µg. S≥22, R<22.",
  },

  // ─────────────────────────────────────────── GEN — Gentamicin
  // Systemic — bracketed breakpoints
  {
    ...EUCAST_2026_METADATA, organismGroup: "enterobacterales", antibioticCode: "GEN",
    method: "mic", indication: "systemic",
    susceptibleMaxMgL: 2, resistantGreaterThanMgL: 2,
    interpretationCategories: ["S", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, Gentamicin systemic (bracketed)`,
    flags: { bracketed: true },
    notes: "Systemic — EUCAST bracketed breakpoint. MIC S≤2, R>2.",
  },
  {
    ...EUCAST_2026_METADATA, organismGroup: "enterobacterales", antibioticCode: "GEN",
    method: "disk", indication: "systemic",
    susceptibleMinMm: 17, resistantLessThanMm: 17,
    interpretationCategories: ["S", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, Gentamicin systemic (bracketed)`,
    flags: { bracketed: true },
    notes: "Systemic — bracketed. Disk 10 µg. S≥17, R<17.",
  },
  // Urinary
  {
    ...EUCAST_2026_METADATA, organismGroup: "enterobacterales", antibioticCode: "GEN",
    method: "mic", indication: "uti",
    susceptibleMaxMgL: 2, resistantGreaterThanMgL: 2,
    interpretationCategories: ["S", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, Gentamicin urinary-origin`,
    flags: { urinaryOnly: true },
    notes: "Urinary-origin. MIC S≤2, R>2.",
  },
  {
    ...EUCAST_2026_METADATA, organismGroup: "enterobacterales", antibioticCode: "GEN",
    method: "disk", indication: "uti",
    susceptibleMinMm: 17, resistantLessThanMm: 17,
    interpretationCategories: ["S", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, Gentamicin urinary-origin`,
    flags: { urinaryOnly: true },
    notes: "Urinary-origin. Disk 10 µg. S≥17, R<17.",
  },

  // ─────────────────────────────────────────── AMK — Amikacin
  // Systemic — bracketed
  {
    ...EUCAST_2026_METADATA, organismGroup: "enterobacterales", antibioticCode: "AMK",
    method: "mic", indication: "systemic",
    susceptibleMaxMgL: 8, resistantGreaterThanMgL: 8,
    interpretationCategories: ["S", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, Amikacin systemic (bracketed)`,
    flags: { bracketed: true },
    notes: "Systemic — bracketed. MIC S≤8, R>8.",
  },
  {
    ...EUCAST_2026_METADATA, organismGroup: "enterobacterales", antibioticCode: "AMK",
    method: "disk", indication: "systemic",
    susceptibleMinMm: 18, resistantLessThanMm: 18,
    interpretationCategories: ["S", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, Amikacin systemic (bracketed)`,
    flags: { bracketed: true },
    notes: "Systemic — bracketed. Disk 30 µg. S≥18, R<18.",
  },
  // Urinary
  {
    ...EUCAST_2026_METADATA, organismGroup: "enterobacterales", antibioticCode: "AMK",
    method: "mic", indication: "uti",
    susceptibleMaxMgL: 8, resistantGreaterThanMgL: 8,
    interpretationCategories: ["S", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, Amikacin urinary-origin`,
    flags: { urinaryOnly: true },
    notes: "Urinary-origin. MIC S≤8, R>8.",
  },
  {
    ...EUCAST_2026_METADATA, organismGroup: "enterobacterales", antibioticCode: "AMK",
    method: "disk", indication: "uti",
    susceptibleMinMm: 18, resistantLessThanMm: 18,
    interpretationCategories: ["S", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, Amikacin urinary-origin`,
    flags: { urinaryOnly: true },
    notes: "Urinary-origin. Disk 30 µg. S≥18, R<18.",
  },

  // ─────────────────────────────────────────── CIP — Ciprofloxacin
  // Non-meningitis (default)
  {
    ...EUCAST_2026_METADATA, organismGroup: "enterobacterales", antibioticCode: "CIP",
    method: "mic", indication: "non_meningitis",
    susceptibleMaxMgL: 0.25, resistantGreaterThanMgL: 0.5,
    interpretationCategories: ["S", "I", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, Ciprofloxacin non-meningitis`,
    notes: "MIC S≤0.25, R>0.5.",
  },
  {
    ...EUCAST_2026_METADATA, organismGroup: "enterobacterales", antibioticCode: "CIP",
    method: "disk", indication: "non_meningitis",
    susceptibleMinMm: 25, resistantLessThanMm: 22,
    interpretationCategories: ["S", "I", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, Ciprofloxacin non-meningitis`,
    notes: "Disk 5 µg. S≥25, R<22.",
  },
  // Meningitis — MIC-only / pefloxacin screen for disk
  {
    ...EUCAST_2026_METADATA, organismGroup: "enterobacterales", antibioticCode: "CIP",
    method: "mic", indication: "meningitis",
    susceptibleMaxMgL: 0.125, resistantGreaterThanMgL: 0.125,
    interpretationCategories: ["S", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, Ciprofloxacin meningitis`,
    flags: { meningitisOnly: true, screeningOnly: true },
    notes: "Meningitis. MIC S≤0.125, R>0.125. Disk diffusion uses pefloxacin screen — no native disk breakpoint.",
  },

  // ─────────────────────────────────────────── LVX — Levofloxacin
  {
    ...EUCAST_2026_METADATA, organismGroup: "enterobacterales", antibioticCode: "LVX",
    method: "mic", indication: "general",
    susceptibleMaxMgL: 0.5, resistantGreaterThanMgL: 1,
    interpretationCategories: ["S", "I", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, Levofloxacin`,
    notes: "MIC S≤0.5, R>1.",
  },
  {
    ...EUCAST_2026_METADATA, organismGroup: "enterobacterales", antibioticCode: "LVX",
    method: "disk", indication: "general",
    susceptibleMinMm: 23, resistantLessThanMm: 19,
    interpretationCategories: ["S", "I", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, Levofloxacin`,
    notes: "Disk 5 µg. S≥23, R<19.",
  },

  // ─────────────────────────────────────────── NIT — Nitrofurantoin (E. coli only, UTI)
  {
    ...EUCAST_2026_METADATA, organismGroup: "enterobacterales", antibioticCode: "NIT",
    method: "mic", indication: "uti_uncomplicated",
    susceptibleMaxMgL: 64, resistantGreaterThanMgL: 64,
    interpretationCategories: ["S", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, Nitrofurantoin uncomplicated UTI, E. coli only`,
    flags: { restrictedSpecies: ECOLI_ONLY, urinaryOnly: true },
    notes: "Uncomplicated UTI, E. coli only. MIC S≤64, R>64.",
  },
  {
    ...EUCAST_2026_METADATA, organismGroup: "enterobacterales", antibioticCode: "NIT",
    method: "disk", indication: "uti_uncomplicated",
    susceptibleMinMm: 11, resistantLessThanMm: 11,
    interpretationCategories: ["S", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, Nitrofurantoin uncomplicated UTI, E. coli only`,
    flags: { restrictedSpecies: ECOLI_ONLY, urinaryOnly: true },
    notes: "Disk 100 µg. S≥11, R<11.",
  },

  // ─────────────────────────────────────────── FOS — Fosfomycin (E. coli only)
  // Oral uncomplicated UTI
  {
    ...EUCAST_2026_METADATA, organismGroup: "enterobacterales", antibioticCode: "FOS",
    method: "mic", indication: "uti_uncomplicated",
    susceptibleMaxMgL: 8, resistantGreaterThanMgL: 8,
    interpretationCategories: ["S", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, Fosfomycin oral uncomplicated UTI, E. coli only`,
    flags: { restrictedSpecies: ECOLI_ONLY, urinaryOnly: true, oralOnly: true },
    notes: "Oral uncomplicated UTI, E. coli only. MIC S≤8, R>8 (agar dilution + G6P).",
  },
  {
    ...EUCAST_2026_METADATA, organismGroup: "enterobacterales", antibioticCode: "FOS",
    method: "disk", indication: "uti_uncomplicated",
    susceptibleMinMm: 24, resistantLessThanMm: 24,
    interpretationCategories: ["S", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, Fosfomycin oral uncomplicated UTI, E. coli only`,
    flags: { restrictedSpecies: ECOLI_ONLY, urinaryOnly: true, oralOnly: true },
    notes: "Disk 200 µg + G6P. S≥24, R<24. Read outer zone edge; ignore isolated colonies.",
  },
  // IV urinary-origin
  {
    ...EUCAST_2026_METADATA, organismGroup: "enterobacterales", antibioticCode: "FOS",
    method: "mic", indication: "uti",
    susceptibleMaxMgL: 8, resistantGreaterThanMgL: 8,
    interpretationCategories: ["S", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, Fosfomycin IV urinary-origin, E. coli only`,
    flags: { restrictedSpecies: ECOLI_ONLY, urinaryOnly: true },
    notes: "IV urinary-origin, E. coli only. MIC S≤8, R>8.",
  },
  {
    ...EUCAST_2026_METADATA, organismGroup: "enterobacterales", antibioticCode: "FOS",
    method: "disk", indication: "uti",
    susceptibleMinMm: 24, resistantLessThanMm: 24,
    interpretationCategories: ["S", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, Fosfomycin IV urinary-origin, E. coli only`,
    flags: { restrictedSpecies: ECOLI_ONLY, urinaryOnly: true },
    notes: "IV urinary-origin, E. coli only. Disk 200 µg + G6P. S≥24, R<24.",
  },

  // ─────────────────────────────────────────── SXT — Trimethoprim-sulfamethoxazole
  // General Enterobacterales (NOT Serratia)
  {
    ...EUCAST_2026_METADATA, organismGroup: "enterobacterales", antibioticCode: "SXT",
    method: "mic", indication: "general",
    susceptibleMaxMgL: 0.5, resistantGreaterThanMgL: 0.5,
    interpretationCategories: ["S", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, SXT, except Serratia spp.`,
    notes: "MIC S≤0.5, R>0.5. Expressed as trimethoprim concentration.",
  },
  {
    ...EUCAST_2026_METADATA, organismGroup: "enterobacterales", antibioticCode: "SXT",
    method: "disk", indication: "general",
    susceptibleMinMm: 15, resistantLessThanMm: 15,
    interpretationCategories: ["S", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, SXT, except Serratia spp.`,
    notes: "Disk 1.25/23.75 µg. S≥15, R<15.",
  },

  // ─────────────────────────────────────────── CTX — Cefotaxime
  // Non-meningitis (default) — MIC S≤1, R>2 / disk 5 µg S≥20, R<17
  {
    ...EUCAST_2026_METADATA, organismGroup: "enterobacterales", antibioticCode: "CTX",
    method: "mic", indication: "non_meningitis",
    susceptibleMaxMgL: 1, resistantGreaterThanMgL: 2,
    interpretationCategories: ["S", "I", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, Cefotaxime non-meningitis`,
    notes: "MIC S≤1, R>2.",
  },
  {
    ...EUCAST_2026_METADATA, organismGroup: "enterobacterales", antibioticCode: "CTX",
    method: "disk", indication: "non_meningitis",
    susceptibleMinMm: 20, resistantLessThanMm: 17,
    interpretationCategories: ["S", "I", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, Cefotaxime non-meningitis`,
    notes: "Disk 5 µg. S≥20, R<17.",
  },
  // Meningitis — MIC S≤1, R>1 / disk S≥20, R<20
  {
    ...EUCAST_2026_METADATA, organismGroup: "enterobacterales", antibioticCode: "CTX",
    method: "mic", indication: "meningitis",
    susceptibleMaxMgL: 1, resistantGreaterThanMgL: 1,
    interpretationCategories: ["S", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, Cefotaxime meningitis`,
    flags: { meningitisOnly: true },
    notes: "Meningitis. MIC S≤1, R>1.",
  },
  {
    ...EUCAST_2026_METADATA, organismGroup: "enterobacterales", antibioticCode: "CTX",
    method: "disk", indication: "meningitis",
    susceptibleMinMm: 20, resistantLessThanMm: 20,
    interpretationCategories: ["S", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, Cefotaxime meningitis`,
    flags: { meningitisOnly: true },
    notes: "Meningitis. Disk 5 µg. S≥20, R<20.",
  },

  // ─────────────────────────────────────────── CFM — Cefixime (uncomplicated UTI only)
  {
    ...EUCAST_2026_METADATA, organismGroup: "enterobacterales", antibioticCode: "CFM",
    method: "mic", indication: "uti_uncomplicated",
    susceptibleMaxMgL: 1, resistantGreaterThanMgL: 1,
    interpretationCategories: ["S", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, Cefixime uncomplicated UTI`,
    flags: { urinaryOnly: true, oralOnly: true },
    notes: "Uncomplicated UTI only. MIC S≤1, R>1.",
  },
  {
    ...EUCAST_2026_METADATA, organismGroup: "enterobacterales", antibioticCode: "CFM",
    method: "disk", indication: "uti_uncomplicated",
    susceptibleMinMm: 17, resistantLessThanMm: 17,
    interpretationCategories: ["S", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, Cefixime uncomplicated UTI`,
    flags: { urinaryOnly: true, oralOnly: true },
    notes: "Disk 5 µg. S≥17, R<17.",
  },

  // ─────────────────────────────────────────── IPM — Imipenem (Enterobacterales except Morganellaceae)
  {
    ...EUCAST_2026_METADATA, organismGroup: "enterobacterales", antibioticCode: "IPM",
    method: "mic", indication: "general",
    susceptibleMaxMgL: 2, resistantGreaterThanMgL: 4,
    interpretationCategories: ["S", "I", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, Imipenem (except Morganellaceae)`,
    notes: "MIC S≤2, R>4. Not for Morganellaceae (intrinsic reduced susceptibility).",
  },
  {
    ...EUCAST_2026_METADATA, organismGroup: "enterobacterales", antibioticCode: "IPM",
    method: "disk", indication: "general",
    susceptibleMinMm: 22, resistantLessThanMm: 19,
    interpretationCategories: ["S", "I", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, Imipenem (except Morganellaceae)`,
    notes: "Disk 10 µg. S≥22, R<19.",
  },

  // ─────────────────────────────────────────── DOR — Doripenem
  {
    ...EUCAST_2026_METADATA, organismGroup: "enterobacterales", antibioticCode: "DOR",
    method: "mic", indication: "general",
    susceptibleMaxMgL: 1, resistantGreaterThanMgL: 2,
    interpretationCategories: ["S", "I", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, Doripenem`,
    notes: "MIC S≤1, R>2.",
  },
  {
    ...EUCAST_2026_METADATA, organismGroup: "enterobacterales", antibioticCode: "DOR",
    method: "disk", indication: "general",
    susceptibleMinMm: 24, resistantLessThanMm: 21,
    interpretationCategories: ["S", "I", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, Doripenem`,
    notes: "Disk 10 µg. S≥24, R<21.",
  },

  // ─────────────────────────────────────────── ATM — Aztreonam
  {
    ...EUCAST_2026_METADATA, organismGroup: "enterobacterales", antibioticCode: "ATM",
    method: "mic", indication: "general",
    susceptibleMaxMgL: 1, resistantGreaterThanMgL: 4,
    interpretationCategories: ["S", "I", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, Aztreonam`,
    notes: "MIC S≤1, R>4. Detects ESBL/AmpC at clinical thresholds.",
  },
  {
    ...EUCAST_2026_METADATA, organismGroup: "enterobacterales", antibioticCode: "ATM",
    method: "disk", indication: "general",
    susceptibleMinMm: 26, resistantLessThanMm: 21,
    interpretationCategories: ["S", "I", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, Aztreonam`,
    notes: "Disk 30 µg. S≥26, R<21.",
  },

  // ─────────────────────────────────────────── TOB — Tobramycin
  // Systemic (bracketed)
  {
    ...EUCAST_2026_METADATA, organismGroup: "enterobacterales", antibioticCode: "TOB",
    method: "mic", indication: "systemic",
    susceptibleMaxMgL: 2, resistantGreaterThanMgL: 2,
    interpretationCategories: ["S", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, Tobramycin systemic (bracketed)`,
    flags: { bracketed: true },
    notes: "Systemic — bracketed. MIC S≤2, R>2.",
  },
  {
    ...EUCAST_2026_METADATA, organismGroup: "enterobacterales", antibioticCode: "TOB",
    method: "disk", indication: "systemic",
    susceptibleMinMm: 16, resistantLessThanMm: 16,
    interpretationCategories: ["S", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, Tobramycin systemic (bracketed)`,
    flags: { bracketed: true },
    notes: "Systemic — bracketed. Disk 10 µg. S≥16, R<16.",
  },
  // Urinary
  {
    ...EUCAST_2026_METADATA, organismGroup: "enterobacterales", antibioticCode: "TOB",
    method: "mic", indication: "uti",
    susceptibleMaxMgL: 2, resistantGreaterThanMgL: 2,
    interpretationCategories: ["S", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, Tobramycin urinary-origin`,
    flags: { urinaryOnly: true },
    notes: "Urinary-origin. MIC S≤2, R>2.",
  },
  {
    ...EUCAST_2026_METADATA, organismGroup: "enterobacterales", antibioticCode: "TOB",
    method: "disk", indication: "uti",
    susceptibleMinMm: 16, resistantLessThanMm: 16,
    interpretationCategories: ["S", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, Tobramycin urinary-origin`,
    flags: { urinaryOnly: true },
    notes: "Urinary-origin. Disk 10 µg. S≥16, R<16.",
  },

  // ─────────────────────────────────────────── MXF — Moxifloxacin (except Morganella, Proteus, Serratia)
  {
    ...EUCAST_2026_METADATA, organismGroup: "enterobacterales", antibioticCode: "MXF",
    method: "mic", indication: "general",
    susceptibleMaxMgL: 0.25, resistantGreaterThanMgL: 0.25,
    interpretationCategories: ["S", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, Moxifloxacin (except Morganella, Proteus, Serratia)`,
    notes: "MIC S≤0.25, R>0.25. Not for Morganella morganii, Proteus spp., Serratia spp.",
  },
  {
    ...EUCAST_2026_METADATA, organismGroup: "enterobacterales", antibioticCode: "MXF",
    method: "disk", indication: "general",
    susceptibleMinMm: 22, resistantLessThanMm: 22,
    interpretationCategories: ["S", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, Moxifloxacin (except Morganella, Proteus, Serratia)`,
    notes: "Disk 5 µg. S≥22, R<22.",
  },

  // ─────────────────────────────────────────── TGC — Tigecycline (E. coli and C. koseri only)
  {
    ...EUCAST_2026_METADATA, organismGroup: "enterobacterales", antibioticCode: "TGC",
    method: "mic", indication: "general",
    susceptibleMaxMgL: 0.5, resistantGreaterThanMgL: 0.5,
    interpretationCategories: ["S", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, Tigecycline E. coli and C. koseri`,
    flags: { restrictedSpecies: ["ECOL", "CKOS"] },
    notes: "Restricted to E. coli and C. koseri. MIC S≤0.5, R>0.5.",
  },
  {
    ...EUCAST_2026_METADATA, organismGroup: "enterobacterales", antibioticCode: "TGC",
    method: "disk", indication: "general",
    susceptibleMinMm: 18, resistantLessThanMm: 18,
    interpretationCategories: ["S", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, Tigecycline E. coli and C. koseri`,
    flags: { restrictedSpecies: ["ECOL", "CKOS"] },
    notes: "Disk 15 µg. S≥18, R<18. Restricted to E. coli and C. koseri.",
  },

  // ─────────────────────────────────────────── CFD — Cefiderocol
  {
    ...EUCAST_2026_METADATA, organismGroup: "enterobacterales", antibioticCode: "CFD",
    method: "mic", indication: "general",
    susceptibleMaxMgL: 2, resistantGreaterThanMgL: 2,
    interpretationCategories: ["S", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, Cefiderocol`,
    notes: "MIC S≤2, R>2. Iron-depleted CAMHB required.",
  },
  {
    ...EUCAST_2026_METADATA, organismGroup: "enterobacterales", antibioticCode: "CFD",
    method: "disk", indication: "general",
    susceptibleMinMm: 23, resistantLessThanMm: 23,
    interpretationCategories: ["S", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, Cefiderocol`,
    notes: "Disk 30 µg. S≥23, R<23. ATU 21–23 mm.",
  },

  // ─────────────────────────────────────────── CZA — Ceftazidime-avibactam
  {
    ...EUCAST_2026_METADATA, organismGroup: "enterobacterales", antibioticCode: "CZA",
    method: "mic", indication: "general",
    susceptibleMaxMgL: 8, resistantGreaterThanMgL: 8,
    interpretationCategories: ["S", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, Ceftazidime-avibactam`,
    notes: "MIC S≤8, R>8 (avibactam fixed at 4 mg/L).",
  },
  {
    ...EUCAST_2026_METADATA, organismGroup: "enterobacterales", antibioticCode: "CZA",
    method: "disk", indication: "general",
    susceptibleMinMm: 13, resistantLessThanMm: 13,
    interpretationCategories: ["S", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, Ceftazidime-avibactam`,
    notes: "Disk 10-4 µg. S≥13, R<13.",
  },

  // ─────────────────────────────────────────── TOL — Ceftolozane-tazobactam
  {
    ...EUCAST_2026_METADATA, organismGroup: "enterobacterales", antibioticCode: "TOL",
    method: "mic", indication: "general",
    susceptibleMaxMgL: 2, resistantGreaterThanMgL: 2,
    interpretationCategories: ["S", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, Ceftolozane-tazobactam`,
    notes: "MIC S≤2, R>2 (tazobactam fixed at 4 mg/L).",
  },
  {
    ...EUCAST_2026_METADATA, organismGroup: "enterobacterales", antibioticCode: "TOL",
    method: "disk", indication: "general",
    susceptibleMinMm: 22, resistantLessThanMm: 22,
    interpretationCategories: ["S", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, Ceftolozane-tazobactam`,
    notes: "Disk 30-10 µg. S≥22, R<22. ATU 19–21 mm.",
  },
];
