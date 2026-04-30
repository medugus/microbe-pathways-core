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
    susceptibleMaxMgL: 0.001, resistantGreaterThanMgL: 2,
    interpretationCategories: ["S", "I", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, Ciprofloxacin`,
    notes: "MIC S≤0.001, R>2. Wide WT distribution; resistance common.",
  },
  {
    ...EUCAST_2026_METADATA, organismGroup: "staphylococcus", antibioticCode: "CIP",
    method: "disk", indication: "general",
    susceptibleMinMm: 50, resistantLessThanMm: 17,
    interpretationCategories: ["S", "I", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, Ciprofloxacin`,
    notes: "Disk 5 µg. S≥50, R<17.",
  },

  // ─────────────────────────────────────────── LVX — Levofloxacin
  {
    ...EUCAST_2026_METADATA, organismGroup: "staphylococcus", antibioticCode: "LVX",
    method: "mic", indication: "general",
    susceptibleMaxMgL: 0.001, resistantGreaterThanMgL: 1,
    interpretationCategories: ["S", "I", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, Levofloxacin`,
    notes: "MIC S≤0.001, R>1. Same mechanism as CIP (gyrA/parC).",
  },
  {
    ...EUCAST_2026_METADATA, organismGroup: "staphylococcus", antibioticCode: "LVX",
    method: "disk", indication: "general",
    susceptibleMinMm: 50, resistantLessThanMm: 22,
    interpretationCategories: ["S", "I", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, Levofloxacin`,
    notes: "Disk 5 µg. S≥50, R<22.",
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
];
