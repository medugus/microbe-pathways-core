// Blood culture workup presets — Epic Beaker–style "order panels".
// Pure config / display only. No clinical rule logic.
//
// Each preset describes a *recommended set composition* for a given clinical
// indication. The user can apply a preset to seed the per-set rows, then edit
// freely. Engines never read presets directly; they read the resolved
// per-set rows from accession.specimen.details.sets.

export interface BloodSetTemplate {
  /** Coded draw site (matches DRAW_SITES in the form). */
  drawSite: string;
  /** For central / multi-lumen lines: which lumen this draw is from. */
  lumenLabel?: string;
  /** Default bottle types for this set. */
  bottleTypes: string[];
}

export interface BloodWorkupPreset {
  code: string;
  display: string;
  /** Short clinical rationale shown under the preset chip. */
  rationale: string;
  /** Subtype this preset is most relevant for. Empty = applies to any blood subtype. */
  appliesToSubtypes?: string[];
  sets: BloodSetTemplate[];
}

export const BLOOD_WORKUP_PRESETS: BloodWorkupPreset[] = [
  {
    code: "STANDARD_ADULT",
    display: "Standard adult workup (2 sets, 2 sites)",
    rationale:
      "Two sets drawn from two separate peripheral venepuncture sites. Each set = aerobic + anaerobic.",
    sets: [
      { drawSite: "PERIPHERAL_LEFT", bottleTypes: ["AEROBIC", "ANAEROBIC"] },
      { drawSite: "PERIPHERAL_RIGHT", bottleTypes: ["AEROBIC", "ANAEROBIC"] },
    ],
  },
  {
    code: "CLABSI_WORKUP",
    display: "CLABSI workup (1 peripheral + 1 central line)",
    rationale:
      "Paired draw: one peripheral venepuncture and one from the central line, drawn within ~5 min for differential time-to-positivity.",
    appliesToSubtypes: ["BC_PERIPHERAL", "BC_CENTRAL_LINE"],
    sets: [
      { drawSite: "PERIPHERAL_LEFT", bottleTypes: ["AEROBIC", "ANAEROBIC"] },
      {
        drawSite: "CENTRAL_LINE",
        lumenLabel: "Single lumen",
        bottleTypes: ["AEROBIC", "ANAEROBIC"],
      },
    ],
  },
  {
    code: "HSCT_TRIPLE_LUMEN",
    display: "HSCT / oncology — 3 lumens + 1 peripheral",
    rationale:
      "Stem cell transplant / tunnelled triple-lumen workup: one set from each lumen plus one peripheral, all labelled by source for differential interpretation.",
    appliesToSubtypes: ["BC_CENTRAL_LINE", "BC_PORTACATH"],
    sets: [
      { drawSite: "PERIPHERAL_LEFT", bottleTypes: ["AEROBIC", "ANAEROBIC"] },
      {
        drawSite: "CENTRAL_LINE",
        lumenLabel: "Lumen 1 (proximal)",
        bottleTypes: ["AEROBIC", "ANAEROBIC"],
      },
      {
        drawSite: "CENTRAL_LINE",
        lumenLabel: "Lumen 2 (medial)",
        bottleTypes: ["AEROBIC", "ANAEROBIC"],
      },
      {
        drawSite: "CENTRAL_LINE",
        lumenLabel: "Lumen 3 (distal)",
        bottleTypes: ["AEROBIC", "ANAEROBIC"],
      },
    ],
  },
  {
    code: "ENDOCARDITIS_WORKUP",
    display: "Endocarditis workup (3 sets, 3 sites)",
    rationale:
      "Three sets from three separate peripheral venepunctures, ideally over ≥1 hour. Add mycology bottles for culture-negative endocarditis workup.",
    sets: [
      { drawSite: "PERIPHERAL_LEFT", bottleTypes: ["AEROBIC", "ANAEROBIC"] },
      { drawSite: "PERIPHERAL_RIGHT", bottleTypes: ["AEROBIC", "ANAEROBIC"] },
      { drawSite: "PERIPHERAL_OTHER", bottleTypes: ["AEROBIC", "ANAEROBIC"] },
    ],
  },
  {
    code: "FUNGAEMIA_WORKUP",
    display: "Suspected fungaemia (2 sets + mycology)",
    rationale:
      "Two standard peripheral sets plus a dedicated mycology / fungal bottle. Consider isolator for filamentous fungi.",
    sets: [
      { drawSite: "PERIPHERAL_LEFT", bottleTypes: ["AEROBIC", "ANAEROBIC", "MYCOLOGY"] },
      { drawSite: "PERIPHERAL_RIGHT", bottleTypes: ["AEROBIC", "ANAEROBIC"] },
    ],
  },
  {
    code: "PAEDIATRIC_WORKUP",
    display: "Paediatric (1–2 sets, weight-based volume)",
    rationale:
      "One or two paediatric bottles drawn from peripheral venepuncture. Volume titrated to patient weight; document weight for adequacy assessment.",
    sets: [
      { drawSite: "PERIPHERAL_LEFT", bottleTypes: ["PAEDIATRIC"] },
      { drawSite: "PERIPHERAL_RIGHT", bottleTypes: ["PAEDIATRIC"] },
    ],
  },
  {
    code: "NEONATAL_LOW_VOLUME",
    display: "Neonatal (1 set, paediatric bottle)",
    rationale:
      "Single low-volume paediatric bottle from a peripheral draw. Volume capped by infant weight; document weight for adequacy assessment.",
    appliesToSubtypes: ["BC_NEONATAL"],
    sets: [{ drawSite: "PERIPHERAL_OTHER", bottleTypes: ["PAEDIATRIC"] }],
  },
];

export function getPresetsForSubtype(subtypeCode: string): BloodWorkupPreset[] {
  return BLOOD_WORKUP_PRESETS.filter(
    (p) =>
      !p.appliesToSubtypes ||
      p.appliesToSubtypes.length === 0 ||
      p.appliesToSubtypes.includes(subtypeCode),
  );
}
