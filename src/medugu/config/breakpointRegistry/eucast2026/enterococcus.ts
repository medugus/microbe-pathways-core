// EUCAST Clinical Breakpoint Tables v16.0, valid 1 Jan – 31 Dec 2026.
// Enterococcus spp. — indication-aware breakpoints for the supported AST panel.
//
// Strict EUCAST interpretation:
//   MIC : S if value ≤ susceptibleMaxMgL ; R if value > resistantGreaterThanMgL
//   Disk: S if value ≥ susceptibleMinMm  ; R if value < resistantLessThanMm
// When S and R thresholds coincide, no I (intermediate) category exists.
//
// Notes on EUCAST scope:
//   - PEN: only E. faecalis (E. faecium is intrinsically resistant — IR; not tabulated).
//   - AMP: E. faecalis tabulated; E. faecium routinely R unless tested.
//   - VAN/TEC: MIC method only.
//   - DAP: MIC only; reported as I ("susceptible, increased exposure") at S≤4.
//   - NIT/FOS: E. faecalis only, urinary indication.
//   - CIP/LVX: urinary indication only (uncomplicated UTI).
//   - TET/DOX/RIF: no EUCAST clinical breakpoints — flagged needs_validation.

import type { EucastBreakpointRecord } from "../types";
import { EUCAST_2026_METADATA } from "./notes";

const SRC = "EUCAST v16.0 2026, Enterococcus spp.";

export const EUCAST_2026_ENTEROCOCCUS_BREAKPOINTS: EucastBreakpointRecord[] = [
  // ─────────────────────────────────────────── AMP — Ampicillin (E. faecalis)
  {
    ...EUCAST_2026_METADATA, organismGroup: "enterococcus", antibioticCode: "AMP",
    method: "mic", indication: "general",
    susceptibleMaxMgL: 4, resistantGreaterThanMgL: 8,
    interpretationCategories: ["S", "I", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, Ampicillin`,
    flags: { restrictedSpecies: ["enterococcus_faecalis"] },
    notes: "MIC S≤4, R>8 (I 8). E. faecalis only; E. faecium routinely R.",
  },
  {
    ...EUCAST_2026_METADATA, organismGroup: "enterococcus", antibioticCode: "AMP",
    method: "disk", indication: "general",
    susceptibleMinMm: 10, resistantLessThanMm: 8,
    interpretationCategories: ["S", "I", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, Ampicillin`,
    flags: { restrictedSpecies: ["enterococcus_faecalis"] },
    notes: "Disk 2 µg. S≥10, R<8. E. faecalis only.",
  },

  // ─────────────────────────────────────────── PEN — Penicillin G (E. faecalis)
  {
    ...EUCAST_2026_METADATA, organismGroup: "enterococcus", antibioticCode: "PEN",
    method: "mic", indication: "general",
    susceptibleMaxMgL: 8, resistantGreaterThanMgL: 8,
    interpretationCategories: ["S", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, Benzylpenicillin`,
    flags: { restrictedSpecies: ["enterococcus_faecalis"] },
    notes: "MIC S≤8, R>8. E. faecalis only; E. faecium intrinsically resistant.",
  },

  // ─────────────────────────────────────────── VAN — Vancomycin (MIC only)
  {
    ...EUCAST_2026_METADATA, organismGroup: "enterococcus", antibioticCode: "VAN",
    method: "mic", indication: "general",
    susceptibleMaxMgL: 4, resistantGreaterThanMgL: 4,
    interpretationCategories: ["S", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, Vancomycin`,
    notes: "MIC S≤4, R>4. Confirm vanA/vanB if non-susceptible.",
  },

  // ─────────────────────────────────────────── TEC — Teicoplanin (MIC only)
  {
    ...EUCAST_2026_METADATA, organismGroup: "enterococcus", antibioticCode: "TEC",
    method: "mic", indication: "general",
    susceptibleMaxMgL: 2, resistantGreaterThanMgL: 2,
    interpretationCategories: ["S", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, Teicoplanin`,
    notes: "MIC S≤2, R>2. vanA strains typically TEC-R; vanB typically TEC-S.",
  },

  // ─────────────────────────────────────────── LZD — Linezolid
  {
    ...EUCAST_2026_METADATA, organismGroup: "enterococcus", antibioticCode: "LZD",
    method: "mic", indication: "general",
    susceptibleMaxMgL: 4, resistantGreaterThanMgL: 4,
    interpretationCategories: ["S", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, Linezolid`,
    notes: "MIC S≤4, R>4.",
  },
  {
    ...EUCAST_2026_METADATA, organismGroup: "enterococcus", antibioticCode: "LZD",
    method: "disk", indication: "general",
    susceptibleMinMm: 19, resistantLessThanMm: 19,
    interpretationCategories: ["S", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, Linezolid`,
    notes: "Disk 10 µg. S≥19, R<19.",
  },

  // ─────────────────────────────────────────── DAP — Daptomycin (MIC only, I-only)
  {
    ...EUCAST_2026_METADATA, organismGroup: "enterococcus", antibioticCode: "DAP",
    method: "mic", indication: "general",
    susceptibleMaxMgL: 4, resistantGreaterThanMgL: 4,
    interpretationCategories: ["I", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, Daptomycin`,
    notes: "MIC I≤4 (susceptible, increased exposure), R>4. No 'S' category per EUCAST.",
  },

  // ─────────────────────────────────────────── NIT — Nitrofurantoin (UTI, E. faecalis)
  {
    ...EUCAST_2026_METADATA, organismGroup: "enterococcus", antibioticCode: "NIT",
    method: "mic", indication: "uti_uncomplicated",
    susceptibleMaxMgL: 64, resistantGreaterThanMgL: 64,
    interpretationCategories: ["S", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, Nitrofurantoin`,
    flags: { urinaryOnly: true, restrictedSpecies: ["enterococcus_faecalis"] },
    notes: "MIC S≤64, R>64. Uncomplicated UTI only; E. faecalis.",
  },
  {
    ...EUCAST_2026_METADATA, organismGroup: "enterococcus", antibioticCode: "NIT",
    method: "disk", indication: "uti_uncomplicated",
    susceptibleMinMm: 15, resistantLessThanMm: 15,
    interpretationCategories: ["S", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, Nitrofurantoin`,
    flags: { urinaryOnly: true, restrictedSpecies: ["enterococcus_faecalis"] },
    notes: "Disk 100 µg. S≥15, R<15. Uncomplicated UTI; E. faecalis.",
  },

  // ─────────────────────────────────────────── FOS — Fosfomycin (UTI, E. faecalis, oral)
  {
    ...EUCAST_2026_METADATA, organismGroup: "enterococcus", antibioticCode: "FOS",
    method: "mic", indication: "uti_uncomplicated",
    susceptibleMaxMgL: 32, resistantGreaterThanMgL: 32,
    interpretationCategories: ["S", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, Fosfomycin (oral)`,
    flags: { urinaryOnly: true, oralOnly: true, restrictedSpecies: ["enterococcus_faecalis"] },
    notes: "MIC S≤32, R>32 (agar dilution + G6P). Oral fosfomycin trometamol; uncomplicated UTI; E. faecalis.",
  },

  // ─────────────────────────────────────────── CIP — Ciprofloxacin (UTI only)
  {
    ...EUCAST_2026_METADATA, organismGroup: "enterococcus", antibioticCode: "CIP",
    method: "mic", indication: "uti_uncomplicated",
    susceptibleMaxMgL: 4, resistantGreaterThanMgL: 4,
    interpretationCategories: ["S", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, Ciprofloxacin`,
    flags: { urinaryOnly: true },
    notes: "MIC S≤4, R>4. Uncomplicated UTI only.",
  },
  {
    ...EUCAST_2026_METADATA, organismGroup: "enterococcus", antibioticCode: "CIP",
    method: "disk", indication: "uti_uncomplicated",
    susceptibleMinMm: 15, resistantLessThanMm: 15,
    interpretationCategories: ["S", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, Ciprofloxacin`,
    flags: { urinaryOnly: true },
    notes: "Disk 5 µg. S≥15, R<15. Uncomplicated UTI only.",
  },

  // ─────────────────────────────────────────── LVX — Levofloxacin (UTI only)
  {
    ...EUCAST_2026_METADATA, organismGroup: "enterococcus", antibioticCode: "LVX",
    method: "mic", indication: "uti_uncomplicated",
    susceptibleMaxMgL: 4, resistantGreaterThanMgL: 4,
    interpretationCategories: ["S", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, Levofloxacin`,
    flags: { urinaryOnly: true },
    notes: "MIC S≤4, R>4. Uncomplicated UTI only.",
  },
  {
    ...EUCAST_2026_METADATA, organismGroup: "enterococcus", antibioticCode: "LVX",
    method: "disk", indication: "uti_uncomplicated",
    susceptibleMinMm: 15, resistantLessThanMm: 15,
    interpretationCategories: ["S", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, Levofloxacin`,
    flags: { urinaryOnly: true },
    notes: "Disk 5 µg. S≥15, R<15. Uncomplicated UTI only.",
  },

  // ─────────────────────────────────────────── TET — Tetracycline (no EUCAST clinical BP)
  {
    ...EUCAST_2026_METADATA, organismGroup: "enterococcus", antibioticCode: "TET",
    method: "mic", indication: "general",
    interpretationCategories: ["ND"], breakpointStatus: "needs_validation",
    sourceTableRef: `${SRC}, Tetracycline`,
    notes: "EUCAST does not provide clinical breakpoints for TET in Enterococcus. Use locally validated criteria or refer to CLSI.",
  },

  // ─────────────────────────────────────────── DOX — Doxycycline (no EUCAST clinical BP)
  {
    ...EUCAST_2026_METADATA, organismGroup: "enterococcus", antibioticCode: "DOX",
    method: "mic", indication: "general",
    interpretationCategories: ["ND"], breakpointStatus: "needs_validation",
    sourceTableRef: `${SRC}, Doxycycline`,
    notes: "EUCAST does not provide clinical breakpoints for DOX in Enterococcus. Use locally validated criteria or refer to CLSI.",
  },

  // ─────────────────────────────────────────── RIF — Rifampicin (no EUCAST clinical BP)
  {
    ...EUCAST_2026_METADATA, organismGroup: "enterococcus", antibioticCode: "RIF",
    method: "mic", indication: "general",
    interpretationCategories: ["ND"], breakpointStatus: "needs_validation",
    sourceTableRef: `${SRC}, Rifampicin`,
    notes: "EUCAST does not list a clinical breakpoint for RIF in Enterococcus. Combination therapy only; interpret with caution.",
  },

  // ─────────────────────────────────────────── TGC — Tigecycline (E. faecalis only per EUCAST)
  {
    ...EUCAST_2026_METADATA, organismGroup: "enterococcus", antibioticCode: "TGC",
    method: "mic", indication: "general",
    susceptibleMaxMgL: 0.25, resistantGreaterThanMgL: 0.5,
    interpretationCategories: ["S", "I", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, Tigecycline`,
    flags: { restrictedSpecies: ["enterococcus_faecalis"] },
    notes: "MIC S≤0.25, R>0.5 (I 0.5). E. faecalis only; E. faecium not tabulated by EUCAST.",
  },
  {
    ...EUCAST_2026_METADATA, organismGroup: "enterococcus", antibioticCode: "TGC",
    method: "disk", indication: "general",
    susceptibleMinMm: 18, resistantLessThanMm: 15,
    interpretationCategories: ["S", "I", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, Tigecycline`,
    flags: { restrictedSpecies: ["enterococcus_faecalis"] },
    notes: "Disk 15 µg. S≥18, R<15. E. faecalis only.",
  },

  // ─────────────────────────────────────────── CHL — Chloramphenicol (no EUCAST clinical BP)
  {
    ...EUCAST_2026_METADATA, organismGroup: "enterococcus", antibioticCode: "CHL",
    method: "mic", indication: "general",
    interpretationCategories: ["ND"], breakpointStatus: "needs_validation",
    sourceTableRef: `${SRC}, Chloramphenicol`,
    notes: "EUCAST does not provide clinical breakpoints for CHL in Enterococcus. Use locally validated criteria or refer to CLSI.",
  },

  // ─────────────────────────────────────────── HLG — High-level Gentamicin synergy screen
  {
    ...EUCAST_2026_METADATA, organismGroup: "enterococcus", antibioticCode: "HLG",
    method: "mic", indication: "general",
    susceptibleMaxMgL: 128, resistantGreaterThanMgL: 128,
    interpretationCategories: ["S", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, Gentamicin (high-level synergy)`,
    flags: { screeningOnly: true },
    notes: "Synergy screen. MIC ≤128 mg/L = synergy possible (reported S); >128 = HLAR (no synergy with cell-wall agent).",
  },
  {
    ...EUCAST_2026_METADATA, organismGroup: "enterococcus", antibioticCode: "HLG",
    method: "disk", indication: "general",
    susceptibleMinMm: 8, resistantLessThanMm: 8,
    interpretationCategories: ["S", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, Gentamicin (high-level synergy)`,
    flags: { screeningOnly: true },
    notes: "Disk 30 µg gentamicin (high-content). S≥8 mm = synergy possible; <8 mm = HLAR.",
  },

  // ─────────────────────────────────────────── HLS — High-level Streptomycin synergy screen
  {
    ...EUCAST_2026_METADATA, organismGroup: "enterococcus", antibioticCode: "HLS",
    method: "mic", indication: "general",
    susceptibleMaxMgL: 512, resistantGreaterThanMgL: 512,
    interpretationCategories: ["S", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, Streptomycin (high-level synergy)`,
    flags: { screeningOnly: true },
    notes: "Synergy screen. MIC ≤512 mg/L = synergy possible; >512 = HLSR (no synergy with cell-wall agent).",
  },
  {
    ...EUCAST_2026_METADATA, organismGroup: "enterococcus", antibioticCode: "HLS",
    method: "disk", indication: "general",
    susceptibleMinMm: 14, resistantLessThanMm: 14,
    interpretationCategories: ["S", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, Streptomycin (high-level synergy)`,
    flags: { screeningOnly: true },
    notes: "Disk 300 µg streptomycin (high-content). S≥14 mm = synergy possible; <14 mm = HLSR.",
  },

  // ─────────────────────────────────────────── QDA — Quinupristin/dalfopristin (E. faecium only)
  {
    ...EUCAST_2026_METADATA, organismGroup: "enterococcus", antibioticCode: "QDA",
    method: "mic", indication: "general",
    susceptibleMaxMgL: 1, resistantGreaterThanMgL: 4,
    interpretationCategories: ["S", "I", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, Quinupristin-dalfopristin`,
    flags: { restrictedSpecies: ["enterococcus_faecium"] },
    notes: "MIC S≤1, R>4 (I 2–4). E. faecium only; E. faecalis intrinsically resistant.",
  },
  {
    ...EUCAST_2026_METADATA, organismGroup: "enterococcus", antibioticCode: "QDA",
    method: "disk", indication: "general",
    susceptibleMinMm: 22, resistantLessThanMm: 19,
    interpretationCategories: ["S", "I", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, Quinupristin-dalfopristin`,
    flags: { restrictedSpecies: ["enterococcus_faecium"] },
    notes: "Disk 15 µg. S≥22, R<19. E. faecium only.",
  },
];
