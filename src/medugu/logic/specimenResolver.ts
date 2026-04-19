// specimenResolver — framework-agnostic.
//
// Maps a coded specimen (family + subtype) to a ResolvedSpecimenProfile that
// drives downstream UI visibility, microscopy configuration, gating, IPC,
// stewardship hooks, and syndrome mapping. NO React. NO free-text input.
//
// The resolver is pure: same input → same output. Persisted accession state
// remains the source of truth; this module only projects behaviour.

import { getSubtype, type FamilyCode } from "../config/specimenFamilies";

// ---------- Contract ----------

export type FieldKey =
  // blood
  | "setCount"
  | "bottleType"
  | "drawSite"
  | "drawTime"
  | "contaminationContext"
  | "neonatalWeight"
  // urine
  | "collectionMethodNote"
  | "catheterInSituDays"
  | "contaminationNotes"
  // LRT
  | "ventilatorStatus"
  | "specimenVolumeMl"
  // sterile fluids
  | "anatomicSite"
  | "imageGuidance"
  | "drainSiteDays"
  // colonisation
  | "screenRound"
  | "priorPositive";

export type MicroscopyKey =
  | "gram"
  | "cellCountWBC"
  | "cellCountRBC"
  | "differential"
  | "afbStain"
  | "indiaInk"
  | "wetMount"
  | "qualityScore_Bartlett"
  | "epithelialCells"
  | "leukocytes";

export type ReportSectionKey =
  | "microscopy"
  | "culture"
  | "ast"
  | "quantitative"
  | "criticalCommunication"
  | "consultantNote"
  | "screenResult";

export type WorkbenchPanelKey =
  | "blood_culture_panel"
  | "urine_panel"
  | "fungal_urine_panel"
  | "afb_urine_panel"
  | "respiratory_panel"
  | "quantitative_respiratory_panel"
  | "sterile_fluid_panel"
  | "csf_panel"
  | "screen_panel";

export type IPCFlagHint =
  | "alert_organism_watch"
  | "device_associated_watch"
  | "mrsa_screen"
  | "vre_screen"
  | "cpe_screen"
  | "candida_auris_screen";

export type SyndromeCode =
  | "bsi"
  | "uti"
  | "cauti"
  | "cap"
  | "hap"
  | "vap"
  | "meningitis"
  | "spontaneous_bacterial_peritonitis"
  | "septic_arthritis"
  | "pleural_empyema"
  | "pericarditis"
  | "pd_peritonitis"
  | "abscess"
  | "colonisation_screen";

export type AcceptanceMode = "accept" | "qualified" | "rejectable";

export interface AcceptanceRule {
  mode: AcceptanceMode;
  /** Coded reasons that may trigger rejection or qualified processing. */
  rejectionReasonCodes: string[];
  /** True when contamination context must be captured before processing. */
  contaminationContextRequired: boolean;
  notes?: string;
}

export interface MicroscopyConfig {
  required: MicroscopyKey[];
  optional: MicroscopyKey[];
  /** Whether structured cell-count fields are mandatory (e.g. CSF). */
  structured: boolean;
  /** When true, microscopy quality (e.g. Bartlett) gates downstream culture. */
  gatesCulture: boolean;
}

export interface QuantitativeHook {
  /** Code recognised by AST/culture engines. */
  code: string;
  /** Threshold suggestions only — engines own final interpretation. */
  thresholds?: { significantCfuPerMl?: number; contaminationCfuPerMl?: number };
}

export interface ReleaseGating {
  /** CSF and similar require consultant sign-off before release. */
  consultantReleaseRequired: boolean;
  /** Phone-out hooks for critical results. */
  criticalCommunicationRequired: boolean;
  /** Workflow path: diagnostic vs colonisation screen. */
  pathway: "diagnostic" | "screen";
  /** True when clearance tracking applies (screens). */
  clearanceTracked: boolean;
}

export interface ResolvedSpecimenProfile {
  familyCode: FamilyCode;
  subtypeCode: string;
  displayName: string;
  acceptance: AcceptanceRule;
  microscopy: MicroscopyConfig;
  requiredFields: FieldKey[];
  optionalFields: FieldKey[];
  reportSections: ReportSectionKey[];
  workbenchPanels: WorkbenchPanelKey[];
  gating: ReleaseGating;
  quantitative: QuantitativeHook | null;
  ipcFlagHints: IPCFlagHint[];
  syndrome: SyndromeCode | null;
}

export type ResolverResult =
  | { ok: true; profile: ResolvedSpecimenProfile }
  | { ok: false; reason: "unknown_family" | "unknown_subtype" };

// ---------- Resolver ----------

export function resolveSpecimen(
  familyCode: string,
  subtypeCode: string,
): ResolverResult {
  const subtype = getSubtype(familyCode, subtypeCode);
  if (!subtype) {
    return { ok: false, reason: "unknown_subtype" };
  }
  const family = familyCode as FamilyCode;
  switch (family) {
    case "BLOOD":
      return { ok: true, profile: resolveBlood(subtypeCode, subtype.display) };
    case "URINE":
      return { ok: true, profile: resolveUrine(subtypeCode, subtype.display) };
    case "LRT":
      return { ok: true, profile: resolveLRT(subtypeCode, subtype.display) };
    case "STERILE_FLUID":
      return { ok: true, profile: resolveSterileFluid(subtypeCode, subtype.display) };
    case "COLONISATION":
      return { ok: true, profile: resolveColonisation(subtypeCode, subtype.display) };
    default:
      return { ok: false, reason: "unknown_family" };
  }
}

// ---------- Blood ----------

function resolveBlood(subtypeCode: string, display: string): ResolvedSpecimenProfile {
  const isLine =
    subtypeCode === "BC_CENTRAL_LINE" ||
    subtypeCode === "BC_ARTERIAL" ||
    subtypeCode === "BC_PERIPHERAL_CANNULA" ||
    subtypeCode === "BC_PORTACATH";
  const isNeonatal = subtypeCode === "BC_NEONATAL";

  const requiredFields: FieldKey[] = ["setCount", "bottleType", "drawSite", "drawTime"];
  if (isNeonatal) requiredFields.push("neonatalWeight");
  const optionalFields: FieldKey[] = isLine ? ["contaminationContext"] : [];

  return {
    familyCode: "BLOOD",
    subtypeCode,
    displayName: display,
    acceptance: {
      mode: "accept",
      rejectionReasonCodes: ["BC_LEAK", "BC_INSUFFICIENT_VOLUME", "BC_BROKEN_BOTTLE"],
      contaminationContextRequired: isLine,
      notes: isLine
        ? "Line draws need paired peripheral context for contamination assessment."
        : undefined,
    },
    microscopy: {
      required: [],
      optional: ["gram"],
      structured: false,
      gatesCulture: false,
    },
    requiredFields,
    optionalFields,
    reportSections: ["culture", "ast", "criticalCommunication"],
    workbenchPanels: ["blood_culture_panel"],
    gating: {
      consultantReleaseRequired: false,
      criticalCommunicationRequired: true,
      pathway: "diagnostic",
      clearanceTracked: false,
    },
    quantitative: null,
    ipcFlagHints: ["alert_organism_watch"].concat(isLine ? ["device_associated_watch"] : []) as IPCFlagHint[],
    syndrome: "bsi",
  };
}

// ---------- Urine ----------

function resolveUrine(subtypeCode: string, display: string): ResolvedSpecimenProfile {
  const isFungal = subtypeCode === "URINE_FUNGAL";
  const isAFB = subtypeCode === "URINE_AFB";
  const isSPA = subtypeCode === "URINE_SPA";
  const isCatheter = subtypeCode === "URINE_CATHETER";
  const isConduit = subtypeCode === "URINE_ILEAL_CONDUIT";

  const requiredFields: FieldKey[] = ["collectionMethodNote"];
  if (isCatheter) requiredFields.push("catheterInSituDays");

  // Quantitative hooks per subtype.
  let quantitative: QuantitativeHook | null = {
    code: "URINE_QUANT_MSU",
    thresholds: { significantCfuPerMl: 1e5, contaminationCfuPerMl: 1e4 },
  };
  if (isSPA) quantitative = { code: "URINE_QUANT_SPA", thresholds: { significantCfuPerMl: 1 } };
  else if (isCatheter || subtypeCode === "URINE_IN_OUT")
    quantitative = {
      code: "URINE_QUANT_CSU",
      thresholds: { significantCfuPerMl: 1e4 },
    };
  else if (isConduit)
    quantitative = { code: "URINE_QUANT_CONDUIT", thresholds: { significantCfuPerMl: 1e5 } };
  else if (isAFB || isFungal) quantitative = null;

  const panels: WorkbenchPanelKey[] = ["urine_panel"];
  if (isFungal) panels.push("fungal_urine_panel");
  if (isAFB) panels.push("afb_urine_panel");

  return {
    familyCode: "URINE",
    subtypeCode,
    displayName: display,
    acceptance: {
      mode: isSPA ? "accept" : "qualified",
      rejectionReasonCodes: ["URINE_DELAYED", "URINE_LEAKED", "URINE_INSUFFICIENT"],
      contaminationContextRequired: isCatheter || isConduit,
    },
    microscopy: {
      required: ["leukocytes", "epithelialCells"],
      optional: ["gram", "wetMount"],
      structured: true,
      gatesCulture: false,
    },
    requiredFields,
    optionalFields: ["contaminationNotes"],
    reportSections: ["microscopy", "culture", "ast", "quantitative"],
    workbenchPanels: panels,
    gating: {
      consultantReleaseRequired: false,
      criticalCommunicationRequired: false,
      pathway: "diagnostic",
      clearanceTracked: false,
    },
    quantitative,
    ipcFlagHints: isCatheter ? ["device_associated_watch"] : [],
    syndrome: isCatheter ? "cauti" : "uti",
  };
}

// ---------- Lower respiratory ----------

function resolveLRT(subtypeCode: string, display: string): ResolvedSpecimenProfile {
  const isSputum = subtypeCode === "LRT_SPUTUM" || subtypeCode === "LRT_INDUCED_SPUTUM";
  const isQuant =
    subtypeCode === "LRT_BAL" ||
    subtypeCode === "LRT_BRONCH_WASH" ||
    subtypeCode === "LRT_QUANT";
  const isETA = subtypeCode === "LRT_ETA";

  const requiredFields: FieldKey[] = ["collectionMethodNote"];
  if (isETA) requiredFields.push("ventilatorStatus");
  if (isQuant) requiredFields.push("specimenVolumeMl");

  // Bartlett gates only true sputum; non-sputum follows qualified-processing path.
  const microscopy: MicroscopyConfig = {
    required: isSputum ? ["qualityScore_Bartlett", "gram"] : ["gram"],
    optional: ["epithelialCells", "leukocytes"],
    structured: true,
    gatesCulture: isSputum,
  };

  const acceptance: AcceptanceRule = {
    mode: isSputum ? "rejectable" : "qualified",
    rejectionReasonCodes: isSputum
      ? ["LRT_SALIVA", "LRT_BARTLETT_FAIL"]
      : ["LRT_INSUFFICIENT", "LRT_DELAYED"],
    contaminationContextRequired: false,
    notes: isSputum
      ? "Bartlett quality screen gates culture; saliva is rejected."
      : "Non-sputum LRT follows qualified processing pathway.",
  };

  const panels: WorkbenchPanelKey[] = ["respiratory_panel"];
  if (isQuant) panels.push("quantitative_respiratory_panel");

  let syndrome: SyndromeCode = "cap";
  if (isETA) syndrome = "vap";
  else if (isQuant) syndrome = "hap";

  return {
    familyCode: "LRT",
    subtypeCode,
    displayName: display,
    acceptance,
    microscopy,
    requiredFields,
    optionalFields: ["contaminationNotes"],
    reportSections: ["microscopy", "culture", "ast", isQuant ? "quantitative" : "culture"].filter(
      (v, i, a) => a.indexOf(v) === i,
    ) as ReportSectionKey[],
    workbenchPanels: panels,
    gating: {
      consultantReleaseRequired: false,
      criticalCommunicationRequired: false,
      pathway: "diagnostic",
      clearanceTracked: false,
    },
    quantitative: isQuant
      ? { code: "LRT_QUANT", thresholds: { significantCfuPerMl: 1e4 } }
      : null,
    ipcFlagHints: isETA ? ["device_associated_watch"] : [],
    syndrome,
  };
}

// ---------- Sterile fluids ----------

function resolveSterileFluid(subtypeCode: string, display: string): ResolvedSpecimenProfile {
  const isCSF = subtypeCode === "SF_CSF";
  const isPericardial = subtypeCode === "SF_PERICARDIAL";
  const isPD = subtypeCode === "SF_PD";
  const isDrain = subtypeCode === "SF_DRAIN";
  const isImageGuided = subtypeCode === "SF_IMAGE_GUIDED";

  const requiredFields: FieldKey[] = ["anatomicSite"];
  if (isImageGuided) requiredFields.push("imageGuidance");
  if (isDrain) requiredFields.push("drainSiteDays");

  const microscopy: MicroscopyConfig = isCSF
    ? {
        required: ["gram", "cellCountWBC", "cellCountRBC", "differential"],
        optional: ["indiaInk"],
        structured: true,
        gatesCulture: false,
      }
    : {
        required: ["gram"],
        optional: ["cellCountWBC", "differential"],
        structured: true,
        gatesCulture: false,
      };

  const panels: WorkbenchPanelKey[] = ["sterile_fluid_panel"];
  if (isCSF) panels.push("csf_panel");

  let syndrome: SyndromeCode | null = null;
  switch (subtypeCode) {
    case "SF_CSF":
      syndrome = "meningitis";
      break;
    case "SF_ASCITIC":
      syndrome = "spontaneous_bacterial_peritonitis";
      break;
    case "SF_SYNOVIAL":
      syndrome = "septic_arthritis";
      break;
    case "SF_PLEURAL":
      syndrome = "pleural_empyema";
      break;
    case "SF_PERICARDIAL":
      syndrome = "pericarditis";
      break;
    case "SF_PD":
      syndrome = "pd_peritonitis";
      break;
    default:
      syndrome = "abscess";
  }

  return {
    familyCode: "STERILE_FLUID",
    subtypeCode,
    displayName: display,
    acceptance: {
      mode: isDrain ? "qualified" : "accept",
      rejectionReasonCodes: ["SF_INSUFFICIENT", "SF_LEAKED", "SF_DELAYED"],
      contaminationContextRequired: isDrain,
      notes: isCSF ? "Volume-critical; CSF is irreplaceable." : undefined,
    },
    microscopy,
    requiredFields,
    optionalFields: [],
    reportSections: [
      "microscopy",
      "culture",
      "ast",
      "criticalCommunication",
      ...(isCSF ? (["consultantNote"] as ReportSectionKey[]) : []),
    ],
    workbenchPanels: panels,
    gating: {
      consultantReleaseRequired: isCSF,
      criticalCommunicationRequired: isCSF || isPericardial,
      pathway: "diagnostic",
      clearanceTracked: false,
    },
    quantitative: null,
    ipcFlagHints: isPD || isDrain ? ["device_associated_watch"] : ["alert_organism_watch"],
    syndrome,
  };
}

// ---------- Colonisation screens ----------

function resolveColonisation(subtypeCode: string, display: string): ResolvedSpecimenProfile {
  const map: Record<string, IPCFlagHint> = {
    COL_MRSA_NOSE: "mrsa_screen",
    COL_MRSA_GROIN: "mrsa_screen",
    COL_VRE_RECTAL: "vre_screen",
    COL_CPE_RECTAL: "cpe_screen",
    COL_CANDIDA_AURIS: "candida_auris_screen",
  };
  const ipcHint = map[subtypeCode];

  return {
    familyCode: "COLONISATION",
    subtypeCode,
    displayName: display,
    acceptance: {
      mode: "accept",
      rejectionReasonCodes: ["SCREEN_INSUFFICIENT", "SCREEN_WRONG_SWAB"],
      contaminationContextRequired: false,
      notes: "Screen pathway — separated from diagnostic culture workflows.",
    },
    microscopy: {
      required: [],
      optional: [],
      structured: false,
      gatesCulture: false,
    },
    requiredFields: ["screenRound"],
    optionalFields: ["priorPositive"],
    reportSections: ["screenResult"],
    workbenchPanels: ["screen_panel"],
    gating: {
      consultantReleaseRequired: false,
      criticalCommunicationRequired: false,
      pathway: "screen",
      clearanceTracked: true,
    },
    quantitative: null,
    ipcFlagHints: ipcHint ? [ipcHint] : [],
    syndrome: "colonisation_screen",
  };
}
