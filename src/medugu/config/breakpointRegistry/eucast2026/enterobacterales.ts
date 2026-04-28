// EUCAST Clinical Breakpoint Tables v16.0, 2026 — Enterobacterales.
// Strict EUCAST interpretation rules:
//   MIC:  S if value ≤ susceptibleMaxMgL, R if value > resistantGreaterThanMgL
//   Disk: S if value ≥ susceptibleMinMm,  R if value < resistantLessThanMm
// When S and R thresholds coincide, no I (intermediate) category exists.
//
// Each drug + method has exactly ONE record marked `active` — the row used
// by the interpretation engine for that (group, drug, standard, method) key.
// Indication-specific variants (UTI-only, meningitis, species-restricted)
// are kept as `needs_validation` records so the source table is preserved
// for audit, without overriding the canonical row.

import type { EucastBreakpointRecord } from "../types";
import { EUCAST_2026_METADATA } from "./notes";

const SRC = "EUCAST v16.0 2026, Enterobacterales";

export const EUCAST_2026_ENTEROBACTERALES_BREAKPOINTS: EucastBreakpointRecord[] = [
  // ── Ampicillin (AMP) — IV / oral UTI
  {
    ...EUCAST_2026_METADATA, organismGroup: "enterobacterales", antibioticCode: "AMP",
    method: "mic", susceptibleMaxMgL: 8, resistantGreaterThanMgL: 8,
    interpretationCategories: ["S", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, Ampicillin IV/oral UTI`,
    notes: "MIC S≤8, R>8. No I — S and R breakpoints coincide.",
  },
  {
    ...EUCAST_2026_METADATA, organismGroup: "enterobacterales", antibioticCode: "AMP",
    method: "disk", susceptibleMinMm: 14, resistantLessThanMm: 14,
    interpretationCategories: ["S", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, Ampicillin IV/oral UTI`,
    notes: "Disk 10 µg. S≥14, R<14.",
  },

  // ── Amoxicillin-clavulanate (AMC) — IV systemic (canonical)
  {
    ...EUCAST_2026_METADATA, organismGroup: "enterobacterales", antibioticCode: "AMC",
    method: "mic", susceptibleMaxMgL: 8, resistantGreaterThanMgL: 8,
    interpretationCategories: ["S", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, Amoxicillin-clavulanate IV`,
    notes: "MIC S≤8, R>8 (clavulanate fixed at 2 mg/L).",
  },
  {
    ...EUCAST_2026_METADATA, organismGroup: "enterobacterales", antibioticCode: "AMC",
    method: "disk", susceptibleMinMm: 19, resistantLessThanMm: 19,
    interpretationCategories: ["S", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, Amoxicillin-clavulanate IV`,
    notes: "Disk 20-10 µg. S≥19, R<19.",
  },
  // AMC indication-specific variants (preserved for audit; not used by engine)
  {
    ...EUCAST_2026_METADATA, organismGroup: "enterobacterales", antibioticCode: "AMC",
    method: "mic", susceptibleMaxMgL: 0.001, resistantGreaterThanMgL: 8,
    interpretationCategories: ["S", "I", "R", "ND"], breakpointStatus: "needs_validation",
    sourceTableRef: `${SRC}, Amoxicillin-clavulanate oral, urinary-origin infection`,
    notes: "Indication variant — not the active interpreter row.",
  },
  {
    ...EUCAST_2026_METADATA, organismGroup: "enterobacterales", antibioticCode: "AMC",
    method: "mic", susceptibleMaxMgL: 32, resistantGreaterThanMgL: 32,
    interpretationCategories: ["S", "R", "ND"], breakpointStatus: "needs_validation",
    sourceTableRef: `${SRC}, Amoxicillin-clavulanate oral uncomplicated UTI`,
    notes: "Indication variant — not the active interpreter row.",
  },

  // ── Cefuroxime (CXM) — oral uncomplicated UTI used as canonical (limited species)
  {
    ...EUCAST_2026_METADATA, organismGroup: "enterobacterales", antibioticCode: "CXM",
    method: "mic", susceptibleMaxMgL: 8, resistantGreaterThanMgL: 8,
    interpretationCategories: ["S", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, Cefuroxime oral uncomplicated UTI, limited species`,
    notes: "MIC S≤8, R>8. Limited species only per EUCAST.",
  },
  {
    ...EUCAST_2026_METADATA, organismGroup: "enterobacterales", antibioticCode: "CXM",
    method: "disk", susceptibleMinMm: 19, resistantLessThanMm: 19,
    interpretationCategories: ["S", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, Cefuroxime oral uncomplicated UTI, limited species`,
    notes: "Disk 30 µg. S≥19, R<19.",
  },
  // CXM IV limited-species variant
  {
    ...EUCAST_2026_METADATA, organismGroup: "enterobacterales", antibioticCode: "CXM",
    method: "mic", susceptibleMaxMgL: 0.001, resistantGreaterThanMgL: 8,
    interpretationCategories: ["S", "I", "R", "ND"], breakpointStatus: "needs_validation",
    sourceTableRef: `${SRC}, Cefuroxime IV, limited species`,
    notes: "Indication variant — not the active interpreter row.",
  },

  // ── Ceftriaxone (CRO) — non-meningitis canonical
  {
    ...EUCAST_2026_METADATA, organismGroup: "enterobacterales", antibioticCode: "CRO",
    method: "mic", susceptibleMaxMgL: 1, resistantGreaterThanMgL: 2,
    interpretationCategories: ["S", "I", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, Ceftriaxone non-meningitis`,
    notes: "MIC S≤1, R>2. I (1< MIC ≤2) = susceptible, increased exposure.",
  },
  {
    ...EUCAST_2026_METADATA, organismGroup: "enterobacterales", antibioticCode: "CRO",
    method: "disk", susceptibleMinMm: 27, resistantLessThanMm: 24,
    interpretationCategories: ["S", "I", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, Ceftriaxone non-meningitis`,
    notes: "Disk 30 µg. S≥27, R<24.",
  },
  // CRO meningitis (S≤1/R>1; disk S≥27/R<27)
  {
    ...EUCAST_2026_METADATA, organismGroup: "enterobacterales", antibioticCode: "CRO",
    method: "mic", susceptibleMaxMgL: 1, resistantGreaterThanMgL: 1,
    interpretationCategories: ["S", "R", "ND"], breakpointStatus: "needs_validation",
    sourceTableRef: `${SRC}, Ceftriaxone meningitis`,
    notes: "Meningitis-specific variant — not the active interpreter row.",
  },

  // ── Ceftazidime (CAZ)
  {
    ...EUCAST_2026_METADATA, organismGroup: "enterobacterales", antibioticCode: "CAZ",
    method: "mic", susceptibleMaxMgL: 1, resistantGreaterThanMgL: 4,
    interpretationCategories: ["S", "I", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, Ceftazidime`,
    notes: "MIC S≤1, R>4.",
  },
  {
    ...EUCAST_2026_METADATA, organismGroup: "enterobacterales", antibioticCode: "CAZ",
    method: "disk", susceptibleMinMm: 22, resistantLessThanMm: 19,
    interpretationCategories: ["S", "I", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, Ceftazidime`,
    notes: "Disk 10 µg. S≥22, R<19.",
  },

  // ── Cefepime (FEP)
  {
    ...EUCAST_2026_METADATA, organismGroup: "enterobacterales", antibioticCode: "FEP",
    method: "mic", susceptibleMaxMgL: 1, resistantGreaterThanMgL: 4,
    interpretationCategories: ["S", "I", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, Cefepime`,
    notes: "MIC S≤1, R>4.",
  },
  {
    ...EUCAST_2026_METADATA, organismGroup: "enterobacterales", antibioticCode: "FEP",
    method: "disk", susceptibleMinMm: 27, resistantLessThanMm: 24,
    interpretationCategories: ["S", "I", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, Cefepime`,
    notes: "Disk 30 µg. S≥27, R<24.",
  },

  // ── Piperacillin-tazobactam (TZP)
  {
    ...EUCAST_2026_METADATA, organismGroup: "enterobacterales", antibioticCode: "TZP",
    method: "mic", susceptibleMaxMgL: 8, resistantGreaterThanMgL: 8,
    interpretationCategories: ["S", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, Piperacillin-tazobactam`,
    notes: "MIC S≤8, R>8. Tazobactam fixed at 4 mg/L.",
  },
  {
    ...EUCAST_2026_METADATA, organismGroup: "enterobacterales", antibioticCode: "TZP",
    method: "disk", susceptibleMinMm: 20, resistantLessThanMm: 20,
    interpretationCategories: ["S", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, Piperacillin-tazobactam`,
    notes: "Disk 30-6 µg. S≥20, R<20.",
  },

  // ── Ertapenem (ETP)
  {
    ...EUCAST_2026_METADATA, organismGroup: "enterobacterales", antibioticCode: "ETP",
    method: "mic", susceptibleMaxMgL: 0.5, resistantGreaterThanMgL: 0.5,
    interpretationCategories: ["S", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, Ertapenem`,
    notes: "MIC S≤0.5, R>0.5. No I.",
  },
  {
    ...EUCAST_2026_METADATA, organismGroup: "enterobacterales", antibioticCode: "ETP",
    method: "disk", susceptibleMinMm: 23, resistantLessThanMm: 23,
    interpretationCategories: ["S", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, Ertapenem`,
    notes: "Disk 10 µg. S≥23, R<23.",
  },

  // ── Meropenem (MEM) — non-meningitis canonical
  {
    ...EUCAST_2026_METADATA, organismGroup: "enterobacterales", antibioticCode: "MEM",
    method: "mic", susceptibleMaxMgL: 2, resistantGreaterThanMgL: 8,
    interpretationCategories: ["S", "I", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, Meropenem non-meningitis`,
    notes: "MIC S≤2, R>8.",
  },
  {
    ...EUCAST_2026_METADATA, organismGroup: "enterobacterales", antibioticCode: "MEM",
    method: "disk", susceptibleMinMm: 22, resistantLessThanMm: 16,
    interpretationCategories: ["S", "I", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, Meropenem non-meningitis`,
    notes: "Disk 10 µg. S≥22, R<16.",
  },
  // MEM meningitis variant (S≤2/R>2; S≥22/R<22)
  {
    ...EUCAST_2026_METADATA, organismGroup: "enterobacterales", antibioticCode: "MEM",
    method: "mic", susceptibleMaxMgL: 2, resistantGreaterThanMgL: 2,
    interpretationCategories: ["S", "R", "ND"], breakpointStatus: "needs_validation",
    sourceTableRef: `${SRC}, Meropenem meningitis`,
    notes: "Meningitis variant — not the active interpreter row.",
  },

  // ── Gentamicin (GEN) — urinary-origin canonical (systemic is bracketed)
  {
    ...EUCAST_2026_METADATA, organismGroup: "enterobacterales", antibioticCode: "GEN",
    method: "mic", susceptibleMaxMgL: 2, resistantGreaterThanMgL: 2,
    interpretationCategories: ["S", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, Gentamicin urinary-origin`,
    notes: "MIC S≤2, R>2. Systemic breakpoints are bracketed and not used as the active interpreter.",
  },
  {
    ...EUCAST_2026_METADATA, organismGroup: "enterobacterales", antibioticCode: "GEN",
    method: "disk", susceptibleMinMm: 17, resistantLessThanMm: 17,
    interpretationCategories: ["S", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, Gentamicin urinary-origin`,
    notes: "Disk 10 µg. S≥17, R<17.",
  },

  // ── Amikacin (AMK) — urinary-origin canonical (systemic bracketed)
  {
    ...EUCAST_2026_METADATA, organismGroup: "enterobacterales", antibioticCode: "AMK",
    method: "mic", susceptibleMaxMgL: 8, resistantGreaterThanMgL: 8,
    interpretationCategories: ["S", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, Amikacin urinary-origin`,
    notes: "MIC S≤8, R>8. Systemic breakpoints are bracketed.",
  },
  {
    ...EUCAST_2026_METADATA, organismGroup: "enterobacterales", antibioticCode: "AMK",
    method: "disk", susceptibleMinMm: 18, resistantLessThanMm: 18,
    interpretationCategories: ["S", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, Amikacin urinary-origin`,
    notes: "Disk 30 µg. S≥18, R<18.",
  },

  // ── Ciprofloxacin (CIP) — non-meningitis
  {
    ...EUCAST_2026_METADATA, organismGroup: "enterobacterales", antibioticCode: "CIP",
    method: "mic", susceptibleMaxMgL: 0.25, resistantGreaterThanMgL: 0.5,
    interpretationCategories: ["S", "I", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, Ciprofloxacin non-meningitis`,
    notes: "MIC S≤0.25, R>0.5.",
  },
  {
    ...EUCAST_2026_METADATA, organismGroup: "enterobacterales", antibioticCode: "CIP",
    method: "disk", susceptibleMinMm: 25, resistantLessThanMm: 22,
    interpretationCategories: ["S", "I", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, Ciprofloxacin non-meningitis`,
    notes: "Disk 5 µg. S≥25, R<22.",
  },
  // CIP meningitis (MIC S≤0.125, R>0.125; uses pefloxacin screen for disk)
  {
    ...EUCAST_2026_METADATA, organismGroup: "enterobacterales", antibioticCode: "CIP",
    method: "mic", susceptibleMaxMgL: 0.125, resistantGreaterThanMgL: 0.125,
    interpretationCategories: ["S", "R", "ND"], breakpointStatus: "needs_validation",
    sourceTableRef: `${SRC}, Ciprofloxacin meningitis`,
    notes: "Meningitis variant — disk uses pefloxacin screen; not the active interpreter row.",
  },

  // ── Levofloxacin (LVX)
  {
    ...EUCAST_2026_METADATA, organismGroup: "enterobacterales", antibioticCode: "LVX",
    method: "mic", susceptibleMaxMgL: 0.5, resistantGreaterThanMgL: 1,
    interpretationCategories: ["S", "I", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, Levofloxacin`,
    notes: "MIC S≤0.5, R>1.",
  },
  {
    ...EUCAST_2026_METADATA, organismGroup: "enterobacterales", antibioticCode: "LVX",
    method: "disk", susceptibleMinMm: 23, resistantLessThanMm: 19,
    interpretationCategories: ["S", "I", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, Levofloxacin`,
    notes: "Disk 5 µg. S≥23, R<19.",
  },

  // ── Nitrofurantoin (NIT) — uncomplicated UTI, E. coli only
  {
    ...EUCAST_2026_METADATA, organismGroup: "enterobacterales", antibioticCode: "NIT",
    method: "mic", susceptibleMaxMgL: 64, resistantGreaterThanMgL: 64,
    interpretationCategories: ["S", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, Nitrofurantoin uncomplicated UTI, E. coli only`,
    notes: "MIC S≤64, R>64. Uncomplicated UTI and E. coli only.",
  },
  {
    ...EUCAST_2026_METADATA, organismGroup: "enterobacterales", antibioticCode: "NIT",
    method: "disk", susceptibleMinMm: 11, resistantLessThanMm: 11,
    interpretationCategories: ["S", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, Nitrofurantoin uncomplicated UTI, E. coli only`,
    notes: "Disk 100 µg. S≥11, R<11.",
  },

  // ── Fosfomycin (FOS) — oral uncomplicated UTI, E. coli only
  {
    ...EUCAST_2026_METADATA, organismGroup: "enterobacterales", antibioticCode: "FOS",
    method: "mic", susceptibleMaxMgL: 8, resistantGreaterThanMgL: 8,
    interpretationCategories: ["S", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, Fosfomycin oral uncomplicated UTI, E. coli only`,
    notes: "MIC S≤8, R>8. Agar dilution with G6P required.",
  },
  {
    ...EUCAST_2026_METADATA, organismGroup: "enterobacterales", antibioticCode: "FOS",
    method: "disk", susceptibleMinMm: 24, resistantLessThanMm: 24,
    interpretationCategories: ["S", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, Fosfomycin oral uncomplicated UTI, E. coli only`,
    notes: "Disk 200 µg + G6P. S≥24, R<24. Read outer zone edge; ignore isolated colonies.",
  },

  // ── Trimethoprim-sulfamethoxazole (SXT) — Enterobacterales except Serratia
  {
    ...EUCAST_2026_METADATA, organismGroup: "enterobacterales", antibioticCode: "SXT",
    method: "mic", susceptibleMaxMgL: 0.5, resistantGreaterThanMgL: 0.5,
    interpretationCategories: ["S", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, Trimethoprim-sulfamethoxazole, except Serratia spp.`,
    notes: "MIC S≤0.5, R>0.5. Expressed as trimethoprim concentration.",
  },
  {
    ...EUCAST_2026_METADATA, organismGroup: "enterobacterales", antibioticCode: "SXT",
    method: "disk", susceptibleMinMm: 15, resistantLessThanMm: 15,
    interpretationCategories: ["S", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, Trimethoprim-sulfamethoxazole, except Serratia spp.`,
    notes: "Disk 1.25/23.75 µg. S≥15, R<15.",
  },
  // SXT Serratia variant (MIC S≤0.001/R>2; disk S≥50/R<15)
  {
    ...EUCAST_2026_METADATA, organismGroup: "enterobacterales", antibioticCode: "SXT",
    method: "mic", susceptibleMaxMgL: 0.001, resistantGreaterThanMgL: 2,
    interpretationCategories: ["S", "I", "R", "ND"], breakpointStatus: "needs_validation",
    sourceTableRef: `${SRC}, Trimethoprim-sulfamethoxazole, Serratia spp.`,
    notes: "Serratia spp. variant — not the active interpreter row.",
  },
];
