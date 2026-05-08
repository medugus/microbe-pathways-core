// EUCAST Clinical Breakpoint Tables v16.0, valid 1 Jan – 31 Dec 2026.
// Staphylococcus aureus — indication-aware breakpoint table for the 10
// drugs supported in the current Staphylococcus AST panel.
//
// Strict EUCAST interpretation:
//   MIC : S if value ≤ susceptibleMaxMgL ; R if value > resistantGreaterThanMgL
//   Disk: S if value ≥ susceptibleMinMm  ; R if value < resistantLessThanMm
// When S and R thresholds coincide, no I (intermediate) category exists.
//
// VAN and TEC: MIC method only (no routine disk diffusion breakpoint).

import type { EucastBreakpointRecord } from "../types";
import { EUCAST_2026_METADATA } from "./notes";

const SRC = "EUCAST v16.0 2026, Staphylococcus aureus";

export const EUCAST_2026_STAPHYLOCOCCUS_BREAKPOINTS: EucastBreakpointRecord[] = [
  // ─────────────────────────────────────────── ERY — Erythromycin
  {
    ...EUCAST_2026_METADATA, organismGroup: "staphylococcus", antibioticCode: "ERY",
    method: "mic", indication: "general",
    susceptibleMaxMgL: 1, resistantGreaterThanMgL: 1,
    interpretationCategories: ["S", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, Erythromycin`,
    notes: "MIC S≤1, R>1. Inducible CLI resistance (D-test) required if CLI considered.",
  },
  {
    ...EUCAST_2026_METADATA, organismGroup: "staphylococcus", antibioticCode: "ERY",
    method: "disk", indication: "general",
    susceptibleMinMm: 21, resistantLessThanMm: 21,
    interpretationCategories: ["S", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, Erythromycin`,
    notes: "Disk 15 µg. S≥21, R<21. D-test required if CLI considered.",
  },

  // ─────────────────────────────────────────── CLI — Clindamycin
  {
    ...EUCAST_2026_METADATA, organismGroup: "staphylococcus", antibioticCode: "CLI",
    method: "mic", indication: "general",
    susceptibleMaxMgL: 0.25, resistantGreaterThanMgL: 0.25,
    interpretationCategories: ["S", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, Clindamycin`,
    notes: "MIC S≤0.25, R>0.25. Interpret with erythromycin (D-test).",
  },
  {
    ...EUCAST_2026_METADATA, organismGroup: "staphylococcus", antibioticCode: "CLI",
    method: "disk", indication: "general",
    susceptibleMinMm: 22, resistantLessThanMm: 22,
    interpretationCategories: ["S", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, Clindamycin`,
    notes: "Disk 2 µg. S≥22, R<22. Interpret with erythromycin (D-test).",
  },

  // ─────────────────────────────────────────── GEN — Gentamicin
  {
    ...EUCAST_2026_METADATA, organismGroup: "staphylococcus", antibioticCode: "GEN",
    method: "mic", indication: "general",
    susceptibleMaxMgL: 2, resistantGreaterThanMgL: 2,
    interpretationCategories: ["S", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, Gentamicin`,
    notes: "MIC S≤2, R>2. High-level resistance is clinically relevant.",
  },
  {
    ...EUCAST_2026_METADATA, organismGroup: "staphylococcus", antibioticCode: "GEN",
    method: "disk", indication: "general",
    susceptibleMinMm: 18, resistantLessThanMm: 18,
    interpretationCategories: ["S", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, Gentamicin`,
    notes: "Disk 10 µg. S≥18, R<18.",
  },

  // ─────────────────────────────────────────── CIP — Ciprofloxacin
  {
    ...EUCAST_2026_METADATA, organismGroup: "staphylococcus", antibioticCode: "CIP",
    method: "mic", indication: "general",
    susceptibleMaxMgL: 0.001, resistantGreaterThanMgL: 1,
    interpretationCategories: ["I", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, Ciprofloxacin`,
    notes: "EUCAST v16.0: off-scale S≤0.001, R>1 — no 'S' category, report I or R. Resistance common.",
  },
  {
    ...EUCAST_2026_METADATA, organismGroup: "staphylococcus", antibioticCode: "CIP",
    method: "disk", indication: "general",
    susceptibleMinMm: 50, resistantLessThanMm: 17,
    interpretationCategories: ["I", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, Ciprofloxacin (S. aureus)`,
    notes: "Disk 5 µg. EUCAST v16.0 S. aureus off-scale S≥(50), R<(17); CoNS R<(22). All bracketed — screen via norfloxacin recommended.",
  },

  // ─────────────────────────────────────────── LVX — Levofloxacin
  {
    ...EUCAST_2026_METADATA, organismGroup: "staphylococcus", antibioticCode: "LVX",
    method: "mic", indication: "general",
    susceptibleMaxMgL: 0.001, resistantGreaterThanMgL: 1,
    interpretationCategories: ["I", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, Levofloxacin`,
    notes: "EUCAST v16.0: off-scale S≤0.001, R>1 — no 'S' category. Same mechanism as CIP (gyrA/parC).",
  },
  {
    ...EUCAST_2026_METADATA, organismGroup: "staphylococcus", antibioticCode: "LVX",
    method: "disk", indication: "general",
    susceptibleMinMm: 50, resistantLessThanMm: 22,
    interpretationCategories: ["I", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, Levofloxacin (S. aureus)`,
    notes: "Disk 5 µg. EUCAST v16.0 S. aureus S≥50, R<22 (CoNS R<24); report I for zones ≥22. No 'S' category.",
  },

  // ─────────────────────────────────────────── SXT — Trimethoprim/sulfamethoxazole
  {
    ...EUCAST_2026_METADATA, organismGroup: "staphylococcus", antibioticCode: "SXT",
    method: "mic", indication: "general",
    susceptibleMaxMgL: 0.5, resistantGreaterThanMgL: 0.5,
    interpretationCategories: ["S", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, Trimethoprim-sulfamethoxazole`,
    notes: "MIC S≤0.5, R>0.5. Reliable oral option if susceptible.",
  },
  {
    ...EUCAST_2026_METADATA, organismGroup: "staphylococcus", antibioticCode: "SXT",
    method: "disk", indication: "general",
    susceptibleMinMm: 24, resistantLessThanMm: 24,
    interpretationCategories: ["S", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, Trimethoprim-sulfamethoxazole`,
    notes: "Disk 1.25/23.75 µg. S≥24, R<24.",
  },

  // ─────────────────────────────────────────── TET — Tetracycline
  {
    ...EUCAST_2026_METADATA, organismGroup: "staphylococcus", antibioticCode: "TET",
    method: "mic", indication: "general",
    susceptibleMaxMgL: 1, resistantGreaterThanMgL: 1,
    interpretationCategories: ["S", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, Tetracycline`,
    notes: "MIC S≤1, R>1. Check for tet(K)/tet(M) mechanisms.",
  },
  {
    ...EUCAST_2026_METADATA, organismGroup: "staphylococcus", antibioticCode: "TET",
    method: "disk", indication: "general",
    susceptibleMinMm: 22, resistantLessThanMm: 22,
    interpretationCategories: ["S", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, Tetracycline`,
    notes: "Disk 30 µg. S≥22, R<22.",
  },

  // ─────────────────────────────────────────── VAN — Vancomycin (MIC only)
  {
    ...EUCAST_2026_METADATA, organismGroup: "staphylococcus", antibioticCode: "VAN",
    method: "mic", indication: "general",
    susceptibleMaxMgL: 2, resistantGreaterThanMgL: 2,
    interpretationCategories: ["S", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, Vancomycin`,
    notes: "MIC S≤2, R>2. MIC method required (no disk diffusion breakpoint).",
  },

  // ─────────────────────────────────────────── TEC — Teicoplanin (MIC only)
  {
    ...EUCAST_2026_METADATA, organismGroup: "staphylococcus", antibioticCode: "TEC",
    method: "mic", indication: "general",
    susceptibleMaxMgL: 2, resistantGreaterThanMgL: 2,
    interpretationCategories: ["S", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, Teicoplanin`,
    notes: "MIC S≤2, R>2. Similar to VAN; MIC preferred (no routine disk).",
  },

  // ─────────────────────────────────────────── LZD — Linezolid
  {
    ...EUCAST_2026_METADATA, organismGroup: "staphylococcus", antibioticCode: "LZD",
    method: "mic", indication: "general",
    susceptibleMaxMgL: 4, resistantGreaterThanMgL: 4,
    interpretationCategories: ["S", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, Linezolid`,
    notes: "MIC S≤4, R>4. Resistance rare but emerging (cfr/optrA).",
  },
  {
    ...EUCAST_2026_METADATA, organismGroup: "staphylococcus", antibioticCode: "LZD",
    method: "disk", indication: "general",
    susceptibleMinMm: 21, resistantLessThanMm: 21,
    interpretationCategories: ["S", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, Linezolid`,
    notes: "Disk 10 µg. S≥21, R<21.",
  },

  // ─────────────────────────────────────────── PEN — Penicillin G
  {
    ...EUCAST_2026_METADATA, organismGroup: "staphylococcus", antibioticCode: "PEN",
    method: "mic", indication: "general",
    susceptibleMaxMgL: 0.125, resistantGreaterThanMgL: 0.125,
    interpretationCategories: ["S", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, Benzylpenicillin`,
    notes: "MIC S≤0.125, R>0.125. Confirm β-lactamase negativity (zone-edge / nitrocefin) before reporting S.",
  },
  {
    ...EUCAST_2026_METADATA, organismGroup: "staphylococcus", antibioticCode: "PEN",
    method: "disk", indication: "general",
    susceptibleMinMm: 26, resistantLessThanMm: 26,
    interpretationCategories: ["S", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, Benzylpenicillin`,
    notes: "Disk 1 unit. S≥26 AND sharp zone edge negative for β-lactamase; R<26 or fuzzy edge.",
  },

  // ─────────────────────────────────────────── FOX — Cefoxitin (mecA / mecC surrogate)
  {
    ...EUCAST_2026_METADATA, organismGroup: "staphylococcus", antibioticCode: "FOX",
    method: "mic", indication: "general",
    susceptibleMaxMgL: 4, resistantGreaterThanMgL: 4,
    interpretationCategories: ["S", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, Cefoxitin screen (S. aureus)`,
    notes: "MIC S≤4, R>4. Surrogate for mecA/mecC. R = MRSA — report all β-lactams (except anti-MRSA cephalosporins) as R.",
    flags: { restrictedSpecies: ["SAUR"] },
  },
  {
    ...EUCAST_2026_METADATA, organismGroup: "staphylococcus", antibioticCode: "FOX",
    method: "disk", indication: "general",
    susceptibleMinMm: 22, resistantLessThanMm: 22,
    interpretationCategories: ["S", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, Cefoxitin screen (S. aureus)`,
    notes: "Disk 30 µg. S≥22, R<22. Surrogate for mecA/mecC. R = MRSA.",
    flags: { restrictedSpecies: ["SAUR"] },
  },

  // ─────────────────────────────────────────── OXA — Oxacillin (MIC only for S. aureus; cefoxitin preferred)
  {
    ...EUCAST_2026_METADATA, organismGroup: "staphylococcus", antibioticCode: "OXA",
    method: "mic", indication: "general",
    susceptibleMaxMgL: 2, resistantGreaterThanMgL: 2,
    interpretationCategories: ["S", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, Oxacillin (S. aureus)`,
    notes: "MIC S≤2, R>2. Cefoxitin (FOX) is preferred surrogate. Disk diffusion not recommended for S. aureus.",
    flags: { restrictedSpecies: ["SAUR"] },
  },

  // ─────────────────────────────────────────── DOX — Doxycycline (MIC only; v16.0 disk = Note)
  {
    ...EUCAST_2026_METADATA, organismGroup: "staphylococcus", antibioticCode: "DOX",
    method: "mic", indication: "general",
    susceptibleMaxMgL: 1, resistantGreaterThanMgL: 1,
    interpretationCategories: ["S", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, Doxycycline`,
    notes: "MIC S≤1, R>1 (EUCAST v16.0). No defined disk breakpoint — infer from tetracycline disk.",
  },

  // ─────────────────────────────────────────── RIF — Rifampicin
  {
    ...EUCAST_2026_METADATA, organismGroup: "staphylococcus", antibioticCode: "RIF",
    method: "mic", indication: "general",
    susceptibleMaxMgL: 0.06, resistantGreaterThanMgL: 0.06,
    interpretationCategories: ["S", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, Rifampicin (S. aureus)`,
    notes: "MIC S≤0.06, R>0.06 (EUCAST v16.0 — no I band). Combination therapy only.",
  },
  {
    ...EUCAST_2026_METADATA, organismGroup: "staphylococcus", antibioticCode: "RIF",
    method: "disk", indication: "general",
    susceptibleMinMm: 26, resistantLessThanMm: 26,
    interpretationCategories: ["S", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, Rifampicin (S. aureus)`,
    notes: "Disk 5 µg. S. aureus S≥26, R<26 (CoNS S≥30, R<30). Combination therapy only.",
  },

  // ─────────────────────────────────────────── FUS — Fusidic acid
  {
    ...EUCAST_2026_METADATA, organismGroup: "staphylococcus", antibioticCode: "FUS",
    method: "mic", indication: "general",
    susceptibleMaxMgL: 1, resistantGreaterThanMgL: 1,
    interpretationCategories: ["S", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, Fusidic acid`,
    notes: "MIC S≤1, R>1. Combination therapy advised to prevent on-treatment resistance.",
  },
  {
    ...EUCAST_2026_METADATA, organismGroup: "staphylococcus", antibioticCode: "FUS",
    method: "disk", indication: "general",
    susceptibleMinMm: 24, resistantLessThanMm: 24,
    interpretationCategories: ["S", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, Fusidic acid`,
    notes: "Disk 10 µg. S≥24, R<24.",
  },

  // ─────────────────────────────────────────── MUP — Mupirocin (topical, decolonisation)
  {
    ...EUCAST_2026_METADATA, organismGroup: "staphylococcus", antibioticCode: "MUP",
    method: "mic", indication: "general",
    susceptibleMaxMgL: 1, resistantGreaterThanMgL: 256,
    interpretationCategories: ["S", "I", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, Mupirocin`,
    notes: "MIC S≤1, R>256 (low-level R 1<x≤256). Topical use; decolonisation context only.",
  },
  {
    ...EUCAST_2026_METADATA, organismGroup: "staphylococcus", antibioticCode: "MUP",
    method: "disk", indication: "general",
    susceptibleMinMm: 30, resistantLessThanMm: 18,
    interpretationCategories: ["S", "I", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, Mupirocin`,
    notes: "Disk 200 µg. S≥30, R<18 (I 18–29 = low-level resistance).",
  },

  // ─────────────────────────────────────────── DAP — Daptomycin (MIC only)
  {
    ...EUCAST_2026_METADATA, organismGroup: "staphylococcus", antibioticCode: "DAP",
    method: "mic", indication: "general",
    susceptibleMaxMgL: 1, resistantGreaterThanMgL: 1,
    interpretationCategories: ["S", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, Daptomycin`,
    notes: "MIC S≤1, R>1. MIC method required (no disk diffusion). Do NOT use for pneumonia (inactivated by surfactant). Breakpoints valid for S. aureus only (v16.0).",
    flags: { restrictedSpecies: ["SAUR"] },
  },

  // ─────────────────────────────────────────── AZM — Azithromycin (MIC only)
  {
    ...EUCAST_2026_METADATA, organismGroup: "staphylococcus", antibioticCode: "AZM",
    method: "mic", indication: "general",
    susceptibleMaxMgL: 2, resistantGreaterThanMgL: 2,
    interpretationCategories: ["S", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, Azithromycin`,
    notes: "MIC S≤2, R>2. Erythromycin disk used to screen macrolide resistance.",
  },

  // ─────────────────────────────────────────── CLR — Clarithromycin (MIC only)
  {
    ...EUCAST_2026_METADATA, organismGroup: "staphylococcus", antibioticCode: "CLR",
    method: "mic", indication: "general",
    susceptibleMaxMgL: 1, resistantGreaterThanMgL: 1,
    interpretationCategories: ["S", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, Clarithromycin`,
    notes: "MIC S≤1, R>1. Erythromycin disk used to screen macrolide resistance.",
  },

  // ─────────────────────────────────────────── MIN — Minocycline
  {
    ...EUCAST_2026_METADATA, organismGroup: "staphylococcus", antibioticCode: "MIN",
    method: "mic", indication: "general",
    susceptibleMaxMgL: 0.5, resistantGreaterThanMgL: 0.5,
    interpretationCategories: ["S", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, Minocycline`,
    notes: "MIC S≤0.5, R>0.5.",
  },
  {
    ...EUCAST_2026_METADATA, organismGroup: "staphylococcus", antibioticCode: "MIN",
    method: "disk", indication: "general",
    susceptibleMinMm: 23, resistantLessThanMm: 23,
    interpretationCategories: ["S", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, Minocycline`,
    notes: "Disk 30 µg. S≥23, R<23.",
  },

  // ─────────────────────────────────────────── TGC — Tigecycline (MIC + disk)
  {
    ...EUCAST_2026_METADATA, organismGroup: "staphylococcus", antibioticCode: "TGC",
    method: "mic", indication: "general",
    susceptibleMaxMgL: 0.5, resistantGreaterThanMgL: 0.5,
    interpretationCategories: ["S", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, Tigecycline`,
    notes: "MIC S≤0.5, R>0.5.",
  },
  {
    ...EUCAST_2026_METADATA, organismGroup: "staphylococcus", antibioticCode: "TGC",
    method: "disk", indication: "general",
    susceptibleMinMm: 19, resistantLessThanMm: 19,
    interpretationCategories: ["S", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, Tigecycline`,
    notes: "Disk 15 µg. S≥19, R<19.",
  },

  // ─────────────────────────────────────────── NIT — Nitrofurantoin (S. saprophyticus uncomplicated UTI)
  {
    ...EUCAST_2026_METADATA, organismGroup: "staphylococcus", antibioticCode: "NIT",
    method: "mic", indication: "uti_uncomplicated",
    susceptibleMaxMgL: 64, resistantGreaterThanMgL: 64,
    interpretationCategories: ["S", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, Nitrofurantoin uncomplicated UTI, S. saprophyticus`,
    flags: { restrictedSpecies: ["SSAP"], urinaryOnly: true },
    notes: "Uncomplicated UTI, S. saprophyticus only. MIC S≤64, R>64.",
  },
  {
    ...EUCAST_2026_METADATA, organismGroup: "staphylococcus", antibioticCode: "NIT",
    method: "disk", indication: "uti_uncomplicated",
    susceptibleMinMm: 13, resistantLessThanMm: 13,
    interpretationCategories: ["S", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, Nitrofurantoin uncomplicated UTI, S. saprophyticus`,
    flags: { restrictedSpecies: ["SSAP"], urinaryOnly: true },
    notes: "Disk 100 µg. S≥13, R<13.",
  },
];
