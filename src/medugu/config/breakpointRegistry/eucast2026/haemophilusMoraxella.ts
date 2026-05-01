// EUCAST Clinical Breakpoint Tables v16.0, valid 1 Jan – 31 Dec 2026.
// Haemophilus influenzae / parainfluenzae and Moraxella catarrhalis.
// All rows live under organismGroup "fastidious" and are disambiguated
// per-species via flags.restrictedSpecies.
//
// Strict EUCAST interpretation:
//   MIC : S if value ≤ susceptibleMaxMgL ; R if value > resistantGreaterThanMgL
//   Disk: S if value ≥ susceptibleMinMm  ; R if value < resistantLessThanMm
//
// Notes on EUCAST v16.0 specifics:
//   • Haemophilus PEN/AMP screen: benzylpenicillin 1 unit disk used to detect
//     β-lactamase / PBP3 alterations; β-lactamase test remains the reference.
//   • H. influenzae meropenem and 3rd-gen cephalosporins are universally S
//     when no β-lactamase / altered PBP3 detected (encoded as S-only rows).
//   • Moraxella catarrhalis is uniformly β-lactamase positive in practice;
//     EUCAST encodes AMC, CRO/CTX, MEM, FQs, macrolides, TET, SXT.

import type { EucastBreakpointRecord } from "../types";
import { EUCAST_2026_METADATA } from "./notes";

const SRC = "EUCAST v16.0 2026, Haemophilus / Moraxella";
const HINF_ONLY = { restrictedSpecies: ["HINF"] };
const HPAR_ONLY = { restrictedSpecies: ["HPAR"] };
const HAEM_ALL  = { restrictedSpecies: ["HINF", "HPAR"] };
const MCAT_ONLY = { restrictedSpecies: ["MCAT"] };

export const EUCAST_2026_HAEMOPHILUS_MORAXELLA_BREAKPOINTS: EucastBreakpointRecord[] = [
  // ═══════════════════════════════════════════════════════════════════════
  // Haemophilus influenzae (HINF) + H. parainfluenzae (HPAR)
  // ═══════════════════════════════════════════════════════════════════════

  // ─── PEN screen (benzylpenicillin 1 U disk) — H. influenzae
  {
    ...EUCAST_2026_METADATA, organismGroup: "fastidious", antibioticCode: "PEN",
    method: "disk", indication: "general",
    susceptibleMinMm: 12, resistantLessThanMm: 12,
    interpretationCategories: ["S", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, H. influenzae, Benzylpenicillin 1U screen`,
    flags: HAEM_ALL,
    notes: "Benzylpenicillin 1 unit disk: zone ≥12 mm → β-lactam susceptible (no β-lactamase, no PBP3 alterations). Zone <12 → confirm β-lactamase / report β-lactam categories per EUCAST guidance.",
  },

  // ─── AMP — H. influenzae / parainfluenzae
  {
    ...EUCAST_2026_METADATA, organismGroup: "fastidious", antibioticCode: "AMP",
    method: "mic", indication: "general",
    susceptibleMaxMgL: 1, resistantGreaterThanMgL: 1,
    interpretationCategories: ["S", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, H. influenzae, Ampicillin`,
    flags: HAEM_ALL,
    notes: "MIC S≤1, R>1 mg/L. β-lactamase positive isolates are AMP-R irrespective of MIC.",
  },
  {
    ...EUCAST_2026_METADATA, organismGroup: "fastidious", antibioticCode: "AMP",
    method: "disk", indication: "general",
    susceptibleMinMm: 16, resistantLessThanMm: 16,
    interpretationCategories: ["S", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, H. influenzae, Ampicillin 2µg disk`,
    flags: HAEM_ALL,
    notes: "Disk 2 µg on MH-F. S≥16, R<16. β-lactamase test is the reference.",
  },
  // ─── AMX — same as AMP
  {
    ...EUCAST_2026_METADATA, organismGroup: "fastidious", antibioticCode: "AMX",
    method: "mic", indication: "general",
    susceptibleMaxMgL: 2, resistantGreaterThanMgL: 2,
    interpretationCategories: ["S", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, H. influenzae, Amoxicillin`,
    flags: HAEM_ALL,
    notes: "MIC S≤2, R>2 mg/L. β-lactamase positive → R.",
  },

  // ─── AMC — H. influenzae
  {
    ...EUCAST_2026_METADATA, organismGroup: "fastidious", antibioticCode: "AMC",
    method: "mic", indication: "general",
    susceptibleMaxMgL: 2, resistantGreaterThanMgL: 2,
    interpretationCategories: ["S", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, H. influenzae, Amoxicillin-clavulanate`,
    flags: HAEM_ALL,
    notes: "Breakpoints expressed for amoxicillin component. MIC S≤2, R>2.",
  },
  {
    ...EUCAST_2026_METADATA, organismGroup: "fastidious", antibioticCode: "AMC",
    method: "disk", indication: "general",
    susceptibleMinMm: 15, resistantLessThanMm: 15,
    interpretationCategories: ["S", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, H. influenzae, Amoxicillin-clavulanate 2-1µg`,
    flags: HAEM_ALL,
    notes: "Disk 2-1 µg. S≥15, R<15.",
  },

  // ─── CXM — oral and IV
  {
    ...EUCAST_2026_METADATA, organismGroup: "fastidious", antibioticCode: "CXM",
    method: "mic", indication: "iv",
    susceptibleMaxMgL: 1, resistantGreaterThanMgL: 2,
    interpretationCategories: ["S", "I", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, H. influenzae, Cefuroxime IV`,
    flags: HAEM_ALL,
    notes: "Cefuroxime IV: MIC S≤1, I=2, R>2.",
  },
  {
    ...EUCAST_2026_METADATA, organismGroup: "fastidious", antibioticCode: "CXM",
    method: "mic", indication: "oral",
    susceptibleMaxMgL: 0.125, resistantGreaterThanMgL: 0.25,
    interpretationCategories: ["S", "I", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, H. influenzae, Cefuroxime oral`,
    flags: HAEM_ALL,
    notes: "Cefuroxime axetil oral: MIC S≤0.125, I=0.25, R>0.25.",
  },

  // ─── CFM — oral
  {
    ...EUCAST_2026_METADATA, organismGroup: "fastidious", antibioticCode: "CFM",
    method: "mic", indication: "general",
    susceptibleMaxMgL: 0.125, resistantGreaterThanMgL: 0.125,
    interpretationCategories: ["S", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, H. influenzae, Cefixime`,
    flags: HAEM_ALL,
    notes: "Cefixime oral: MIC S≤0.125, R>0.125.",
  },

  // ─── CRO / CTX — H. influenzae (universally S)
  {
    ...EUCAST_2026_METADATA, organismGroup: "fastidious", antibioticCode: "CRO",
    method: "mic", indication: "general",
    susceptibleMaxMgL: 0.125, resistantGreaterThanMgL: 0.125,
    interpretationCategories: ["S", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, H. influenzae, Ceftriaxone`,
    flags: HAEM_ALL,
    notes: "MIC S≤0.125, R>0.125. Acquired resistance is rare.",
  },
  {
    ...EUCAST_2026_METADATA, organismGroup: "fastidious", antibioticCode: "CTX",
    method: "mic", indication: "general",
    susceptibleMaxMgL: 0.125, resistantGreaterThanMgL: 0.125,
    interpretationCategories: ["S", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, H. influenzae, Cefotaxime`,
    flags: HAEM_ALL,
    notes: "MIC S≤0.125, R>0.125.",
  },

  // ─── MEM / IPM — H. influenzae
  {
    ...EUCAST_2026_METADATA, organismGroup: "fastidious", antibioticCode: "MEM",
    method: "mic", indication: "general",
    susceptibleMaxMgL: 0.25, resistantGreaterThanMgL: 0.25,
    interpretationCategories: ["S", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, H. influenzae, Meropenem`,
    flags: HAEM_ALL,
    notes: "MIC S≤0.25, R>0.25.",
  },
  {
    ...EUCAST_2026_METADATA, organismGroup: "fastidious", antibioticCode: "IPM",
    method: "mic", indication: "general",
    susceptibleMaxMgL: 2, resistantGreaterThanMgL: 2,
    interpretationCategories: ["S", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, H. influenzae, Imipenem`,
    flags: HAEM_ALL,
    notes: "MIC S≤2, R>2.",
  },

  // ─── CIP / LVX / MXF — H. influenzae
  {
    ...EUCAST_2026_METADATA, organismGroup: "fastidious", antibioticCode: "CIP",
    method: "mic", indication: "general",
    susceptibleMaxMgL: 0.06, resistantGreaterThanMgL: 0.06,
    interpretationCategories: ["S", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, H. influenzae, Ciprofloxacin`,
    flags: HAEM_ALL,
    notes: "MIC S≤0.06, R>0.06.",
  },
  {
    ...EUCAST_2026_METADATA, organismGroup: "fastidious", antibioticCode: "CIP",
    method: "disk", indication: "general",
    susceptibleMinMm: 30, resistantLessThanMm: 30,
    interpretationCategories: ["S", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, H. influenzae, Ciprofloxacin 5µg`,
    flags: HAEM_ALL,
    notes: "Disk 5 µg. S≥30, R<30.",
  },
  {
    ...EUCAST_2026_METADATA, organismGroup: "fastidious", antibioticCode: "LVX",
    method: "mic", indication: "general",
    susceptibleMaxMgL: 0.06, resistantGreaterThanMgL: 0.06,
    interpretationCategories: ["S", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, H. influenzae, Levofloxacin`,
    flags: HAEM_ALL,
    notes: "MIC S≤0.06, R>0.06.",
  },
  {
    ...EUCAST_2026_METADATA, organismGroup: "fastidious", antibioticCode: "MXF",
    method: "mic", indication: "general",
    susceptibleMaxMgL: 0.125, resistantGreaterThanMgL: 0.125,
    interpretationCategories: ["S", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, H. influenzae, Moxifloxacin`,
    flags: HAEM_ALL,
    notes: "MIC S≤0.125, R>0.125.",
  },

  // ─── TET / DOX — H. influenzae
  {
    ...EUCAST_2026_METADATA, organismGroup: "fastidious", antibioticCode: "TET",
    method: "mic", indication: "general",
    susceptibleMaxMgL: 1, resistantGreaterThanMgL: 2,
    interpretationCategories: ["S", "I", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, H. influenzae, Tetracycline`,
    flags: HAEM_ALL,
    notes: "MIC S≤1, I=2, R>2.",
  },
  {
    ...EUCAST_2026_METADATA, organismGroup: "fastidious", antibioticCode: "DOX",
    method: "mic", indication: "general",
    susceptibleMaxMgL: 1, resistantGreaterThanMgL: 2,
    interpretationCategories: ["S", "I", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, H. influenzae, Doxycycline`,
    flags: HAEM_ALL,
    notes: "MIC S≤1, I=2, R>2.",
  },

  // ─── SXT — H. influenzae
  {
    ...EUCAST_2026_METADATA, organismGroup: "fastidious", antibioticCode: "SXT",
    method: "mic", indication: "general",
    susceptibleMaxMgL: 0.5, resistantGreaterThanMgL: 1,
    interpretationCategories: ["S", "I", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, H. influenzae, Trimethoprim-sulfamethoxazole`,
    flags: HAEM_ALL,
    notes: "TMP component: MIC S≤0.5, I=1, R>1.",
  },

  // ─── CHL / RIF — H. influenzae
  {
    ...EUCAST_2026_METADATA, organismGroup: "fastidious", antibioticCode: "CHL",
    method: "mic", indication: "general",
    susceptibleMaxMgL: 2, resistantGreaterThanMgL: 2,
    interpretationCategories: ["S", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, H. influenzae, Chloramphenicol`,
    flags: HAEM_ALL,
    notes: "MIC S≤2, R>2.",
  },
  {
    ...EUCAST_2026_METADATA, organismGroup: "fastidious", antibioticCode: "RIF",
    method: "mic", indication: "general",
    susceptibleMaxMgL: 1, resistantGreaterThanMgL: 1,
    interpretationCategories: ["S", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, H. influenzae, Rifampicin (prophylaxis)`,
    flags: HINF_ONLY,
    notes: "Rifampicin used only for chemoprophylaxis of invasive H. influenzae disease.",
  },

  // ─── Macrolides (HINF/HPAR) — Insufficient evidence per EUCAST: encoded
  // as not_applicable so resolver returns no_breakpoint.
  {
    ...EUCAST_2026_METADATA, organismGroup: "fastidious", antibioticCode: "AZM",
    method: "mic", indication: "general",
    interpretationCategories: ["ND"], breakpointStatus: "not_applicable",
    sourceTableRef: `${SRC}, H. influenzae, Azithromycin (IE)`,
    flags: HAEM_ALL,
    notes: "EUCAST: insufficient evidence — no S/I/R breakpoints. Wild-type ECOFF only.",
  },
  {
    ...EUCAST_2026_METADATA, organismGroup: "fastidious", antibioticCode: "CLR",
    method: "mic", indication: "general",
    interpretationCategories: ["ND"], breakpointStatus: "not_applicable",
    sourceTableRef: `${SRC}, H. influenzae, Clarithromycin (IE)`,
    flags: HAEM_ALL,
    notes: "EUCAST: insufficient evidence — no S/I/R breakpoints.",
  },
  {
    ...EUCAST_2026_METADATA, organismGroup: "fastidious", antibioticCode: "ERY",
    method: "mic", indication: "general",
    interpretationCategories: ["ND"], breakpointStatus: "not_applicable",
    sourceTableRef: `${SRC}, H. influenzae, Erythromycin (IE)`,
    flags: HAEM_ALL,
    notes: "EUCAST: insufficient evidence — no S/I/R breakpoints.",
  },

  // H. parainfluenzae specific note: same numeric breakpoints as HINF where
  // applicable (covered by HAEM_ALL). No separate HPAR-only rows required
  // beyond the shared set above.
  // Reference for HPAR scope:
  void HPAR_ONLY,

  // ═══════════════════════════════════════════════════════════════════════
  // Moraxella catarrhalis (MCAT)
  // ═══════════════════════════════════════════════════════════════════════

  // AMP / AMX — Moraxella is intrinsically β-lactamase producing in practice;
  // EUCAST encodes AMC and other agents. AMP/AMX alone are reported R when
  // β-lactamase positive — encoded as a single R-category not_applicable row.
  {
    ...EUCAST_2026_METADATA, organismGroup: "fastidious", antibioticCode: "AMP",
    method: "mic", indication: "general",
    interpretationCategories: ["R", "ND"], breakpointStatus: "not_applicable",
    sourceTableRef: `${SRC}, M. catarrhalis, Ampicillin`,
    flags: MCAT_ONLY,
    notes: "M. catarrhalis: ≥90% β-lactamase positive. Report AMP/AMX as R unless β-lactamase negative confirmed.",
  },

  // ─── AMC — Moraxella
  {
    ...EUCAST_2026_METADATA, organismGroup: "fastidious", antibioticCode: "AMC",
    method: "mic", indication: "general",
    susceptibleMaxMgL: 1, resistantGreaterThanMgL: 1,
    interpretationCategories: ["S", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, M. catarrhalis, Amoxicillin-clavulanate`,
    flags: MCAT_ONLY,
    notes: "Breakpoints expressed for amoxicillin component. MIC S≤1, R>1.",
  },

  // ─── CRO / CTX — Moraxella
  {
    ...EUCAST_2026_METADATA, organismGroup: "fastidious", antibioticCode: "CRO",
    method: "mic", indication: "general",
    susceptibleMaxMgL: 1, resistantGreaterThanMgL: 2,
    interpretationCategories: ["S", "I", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, M. catarrhalis, Ceftriaxone`,
    flags: MCAT_ONLY,
    notes: "MIC S≤1, I=2, R>2.",
  },
  {
    ...EUCAST_2026_METADATA, organismGroup: "fastidious", antibioticCode: "CTX",
    method: "mic", indication: "general",
    susceptibleMaxMgL: 1, resistantGreaterThanMgL: 2,
    interpretationCategories: ["S", "I", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, M. catarrhalis, Cefotaxime`,
    flags: MCAT_ONLY,
    notes: "MIC S≤1, I=2, R>2.",
  },
  {
    ...EUCAST_2026_METADATA, organismGroup: "fastidious", antibioticCode: "CXM",
    method: "mic", indication: "general",
    susceptibleMaxMgL: 0.125, resistantGreaterThanMgL: 4,
    interpretationCategories: ["S", "I", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, M. catarrhalis, Cefuroxime`,
    flags: MCAT_ONLY,
    notes: "MIC S≤0.125, I=0.25-4, R>4.",
  },

  // ─── MEM — Moraxella
  {
    ...EUCAST_2026_METADATA, organismGroup: "fastidious", antibioticCode: "MEM",
    method: "mic", indication: "general",
    susceptibleMaxMgL: 2, resistantGreaterThanMgL: 2,
    interpretationCategories: ["S", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, M. catarrhalis, Meropenem`,
    flags: MCAT_ONLY,
    notes: "MIC S≤2, R>2.",
  },

  // ─── CIP / LVX / MXF — Moraxella
  {
    ...EUCAST_2026_METADATA, organismGroup: "fastidious", antibioticCode: "CIP",
    method: "mic", indication: "general",
    susceptibleMaxMgL: 0.125, resistantGreaterThanMgL: 0.125,
    interpretationCategories: ["S", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, M. catarrhalis, Ciprofloxacin`,
    flags: MCAT_ONLY,
    notes: "MIC S≤0.125, R>0.125.",
  },
  {
    ...EUCAST_2026_METADATA, organismGroup: "fastidious", antibioticCode: "LVX",
    method: "mic", indication: "general",
    susceptibleMaxMgL: 0.125, resistantGreaterThanMgL: 0.125,
    interpretationCategories: ["S", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, M. catarrhalis, Levofloxacin`,
    flags: MCAT_ONLY,
    notes: "MIC S≤0.125, R>0.125.",
  },
  {
    ...EUCAST_2026_METADATA, organismGroup: "fastidious", antibioticCode: "MXF",
    method: "mic", indication: "general",
    susceptibleMaxMgL: 0.25, resistantGreaterThanMgL: 0.25,
    interpretationCategories: ["S", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, M. catarrhalis, Moxifloxacin`,
    flags: MCAT_ONLY,
    notes: "MIC S≤0.25, R>0.25.",
  },

  // ─── Macrolides — Moraxella (active)
  {
    ...EUCAST_2026_METADATA, organismGroup: "fastidious", antibioticCode: "ERY",
    method: "mic", indication: "general",
    susceptibleMaxMgL: 0.25, resistantGreaterThanMgL: 0.5,
    interpretationCategories: ["S", "I", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, M. catarrhalis, Erythromycin`,
    flags: MCAT_ONLY,
    notes: "MIC S≤0.25, I=0.5, R>0.5.",
  },
  {
    ...EUCAST_2026_METADATA, organismGroup: "fastidious", antibioticCode: "AZM",
    method: "mic", indication: "general",
    susceptibleMaxMgL: 0.25, resistantGreaterThanMgL: 0.5,
    interpretationCategories: ["S", "I", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, M. catarrhalis, Azithromycin`,
    flags: MCAT_ONLY,
    notes: "MIC S≤0.25, I=0.5, R>0.5.",
  },
  {
    ...EUCAST_2026_METADATA, organismGroup: "fastidious", antibioticCode: "CLR",
    method: "mic", indication: "general",
    susceptibleMaxMgL: 0.25, resistantGreaterThanMgL: 0.5,
    interpretationCategories: ["S", "I", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, M. catarrhalis, Clarithromycin`,
    flags: MCAT_ONLY,
    notes: "MIC S≤0.25, I=0.5, R>0.5.",
  },

  // ─── TET / DOX — Moraxella
  {
    ...EUCAST_2026_METADATA, organismGroup: "fastidious", antibioticCode: "TET",
    method: "mic", indication: "general",
    susceptibleMaxMgL: 1, resistantGreaterThanMgL: 2,
    interpretationCategories: ["S", "I", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, M. catarrhalis, Tetracycline`,
    flags: MCAT_ONLY,
    notes: "MIC S≤1, I=2, R>2.",
  },
  {
    ...EUCAST_2026_METADATA, organismGroup: "fastidious", antibioticCode: "DOX",
    method: "mic", indication: "general",
    susceptibleMaxMgL: 1, resistantGreaterThanMgL: 2,
    interpretationCategories: ["S", "I", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, M. catarrhalis, Doxycycline`,
    flags: MCAT_ONLY,
    notes: "MIC S≤1, I=2, R>2.",
  },

  // ─── SXT — Moraxella
  {
    ...EUCAST_2026_METADATA, organismGroup: "fastidious", antibioticCode: "SXT",
    method: "mic", indication: "general",
    susceptibleMaxMgL: 0.5, resistantGreaterThanMgL: 1,
    interpretationCategories: ["S", "I", "R", "ND"], breakpointStatus: "active",
    sourceTableRef: `${SRC}, M. catarrhalis, Trimethoprim-sulfamethoxazole`,
    flags: MCAT_ONLY,
    notes: "TMP component: MIC S≤0.5, I=1, R>1.",
  },
];
