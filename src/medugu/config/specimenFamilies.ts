// Coded specimen family + subtype dictionary.
// Framework-agnostic. Free-text labels are display-only; codes drive logic.

export type FamilyCode = "BLOOD" | "URINE" | "LRT" | "STERILE_FLUID" | "COLONISATION";

export interface SubtypeDef {
  code: string;
  display: string;
  /** Hints for the resolver — never read directly by UI. */
  tags?: string[];
}

export interface FamilyDef {
  code: FamilyCode;
  display: string;
  subtypes: SubtypeDef[];
}

export const SPECIMEN_FAMILIES: FamilyDef[] = [
  {
    code: "BLOOD",
    display: "Blood culture",
    subtypes: [
      { code: "BC_PERIPHERAL", display: "Peripheral venepuncture", tags: ["diagnostic"] },
      { code: "BC_CENTRAL_LINE", display: "Central line", tags: ["line", "contamination_risk"] },
      { code: "BC_ARTERIAL", display: "Arterial line", tags: ["line"] },
      { code: "BC_PERIPHERAL_CANNULA", display: "Peripheral cannula", tags: ["line"] },
      { code: "BC_PORTACATH", display: "Portacath", tags: ["line"] },
      { code: "BC_NEONATAL", display: "Neonatal", tags: ["neonatal", "low_volume"] },
    ],
  },
  {
    code: "URINE",
    display: "Urine",
    subtypes: [
      { code: "URINE_MIDSTREAM", display: "Midstream urine (MSU)", tags: ["quantitative"] },
      { code: "URINE_CATHETER", display: "Catheter urine (CSU)", tags: ["quantitative", "device"] },
      { code: "URINE_SPA", display: "Suprapubic aspirate", tags: ["sterile_site"] },
      { code: "URINE_NEPHROSTOMY", display: "Nephrostomy", tags: ["device"] },
      { code: "URINE_ILEAL_CONDUIT", display: "Ileal conduit", tags: ["device", "mixed_flora"] },
      { code: "URINE_IN_OUT", display: "In-out catheter", tags: ["quantitative"] },
      { code: "URINE_FUNGAL", display: "Fungal urine", tags: ["fungal"] },
      { code: "URINE_AFB", display: "Mycobacterial urine", tags: ["mycobacterial", "extended_tat"] },
      { code: "URINE_OTHER", display: "Other urine (configured)", tags: [] },
    ],
  },
  {
    code: "LRT",
    display: "Lower respiratory",
    subtypes: [
      { code: "LRT_SPUTUM", display: "Sputum", tags: ["bartlett"] },
      { code: "LRT_INDUCED_SPUTUM", display: "Induced sputum", tags: ["bartlett"] },
      { code: "LRT_ETA", display: "Endotracheal aspirate", tags: ["device"] },
      { code: "LRT_BAL", display: "Bronchoalveolar lavage", tags: ["quantitative"] },
      { code: "LRT_BRONCH_WASH", display: "Bronchial wash", tags: ["quantitative"] },
      { code: "LRT_QUANT", display: "Quantitative respiratory", tags: ["quantitative"] },
    ],
  },
  {
    code: "STERILE_FLUID",
    display: "Sterile fluid",
    subtypes: [
      { code: "SF_CSF", display: "CSF", tags: ["sterile_site", "critical", "consultant_release"] },
      { code: "SF_PLEURAL", display: "Pleural fluid", tags: ["sterile_site"] },
      { code: "SF_ASCITIC", display: "Ascitic fluid", tags: ["sterile_site"] },
      { code: "SF_SYNOVIAL", display: "Synovial fluid", tags: ["sterile_site"] },
      { code: "SF_PERICARDIAL", display: "Pericardial fluid", tags: ["sterile_site", "critical"] },
      { code: "SF_PD", display: "Peritoneal dialysis fluid", tags: ["device"] },
      { code: "SF_IMAGE_GUIDED", display: "Image-guided aspirate", tags: ["sterile_site"] },
      { code: "SF_DRAIN", display: "Drain fluid", tags: ["device", "contamination_risk"] },
    ],
  },
  {
    code: "COLONISATION",
    display: "Colonisation screen",
    subtypes: [
      { code: "COL_MRSA_NOSE", display: "MRSA nasal screen", tags: ["screen", "mrsa"] },
      { code: "COL_MRSA_GROIN", display: "MRSA groin screen", tags: ["screen", "mrsa"] },
      { code: "COL_VRE_RECTAL", display: "VRE rectal screen", tags: ["screen", "vre"] },
      { code: "COL_CPE_RECTAL", display: "CPE rectal screen", tags: ["screen", "cpe"] },
      { code: "COL_CRAB_SCREEN", display: "CRAB screen", tags: ["screen", "crab"] },
      { code: "COL_CRPA_SCREEN", display: "CRPA screen", tags: ["screen", "crpa"] },
      { code: "COL_CANDIDA_AURIS", display: "C. auris screen", tags: ["screen", "candida_auris"] },
    ],
  },
];

export function getFamily(code: string): FamilyDef | undefined {
  return SPECIMEN_FAMILIES.find((f) => f.code === code);
}

export function getSubtype(familyCode: string, subtypeCode: string): SubtypeDef | undefined {
  return getFamily(familyCode)?.subtypes.find((s) => s.code === subtypeCode);
}
