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
  | "screenSites"
  | "priorPositive"
  // stool
  | "stoolConsistency"
  | "travelHistory"
  | "antibioticExposure";

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
  | "screen_panel"
  | "stool_enteric_panel"
  | "stool_cdiff_panel"
  | "stool_parasitology_panel"
  | "genital_panel"
  | "sti_panel";

export type IPCFlagHint =
  | "alert_organism_watch"
  | "device_associated_watch"
  | "mrsa_screen"
  | "vre_screen"
  | "cpe_screen"
  | "crab_screen"
  | "crpa_screen"
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
  | "colonisation_screen"
  | "infectious_diarrhoea"
  | "cdiff_infection"
  | "intestinal_parasitosis"
  | "genital_infection"
  | "sti_syndrome";

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

export type ColonisationScreenKind = "mrsa" | "vre" | "cpe" | "crab" | "crpa" | "candida_auris";

export interface ColonisationScreenPathway {
  kind: ColonisationScreenKind;
  label: string;
  organismCodes: string[];
  positiveOrganismCodes: string[];
  negativeOrganismCode: "NOGRO";
  defaultOrganismCode: string;
  allowedAstPanelIds: string[];
  defaultAstPanelId?: string;
  requiredAstAntibioticCodes: string[];
  organismHelp: string;
  astHelp: string;
}

const MRSA_SCREEN_PATHWAY: ColonisationScreenPathway = {
  kind: "mrsa",
  label: "MRSA screen",
  organismCodes: ["SAUR", "NOGRO"],
  positiveOrganismCodes: ["SAUR"],
  negativeOrganismCode: "NOGRO",
  defaultOrganismCode: "SAUR",
  allowedAstPanelIds: ["mrsa_screen"],
  defaultAstPanelId: "mrsa_screen",
  requiredAstAntibioticCodes: ["FOX", "OXA"],
  organismHelp:
    "MRSA screens accept Staphylococcus aureus detected or an explicit no-growth/negative result only.",
  astHelp:
    "If S. aureus is detected, confirm with cefoxitin or oxacillin. Resistant = MRSA; susceptible = S. aureus detected but MRSA not confirmed.",
};

const COLONISATION_SCREEN_PATHWAYS: Record<string, ColonisationScreenPathway> = {
  COL_MRSA_ADMISSION: MRSA_SCREEN_PATHWAY,
  COL_MRSA_NOSE: MRSA_SCREEN_PATHWAY,
  COL_MRSA_GROIN: MRSA_SCREEN_PATHWAY,
  COL_MRSA_AXILLA: MRSA_SCREEN_PATHWAY,
  COL_VRE_RECTAL: {
    kind: "vre",
    label: "VRE screen",
    organismCodes: ["EFAE", "EFAM", "NOGRO"],
    positiveOrganismCodes: ["EFAE", "EFAM"],
    negativeOrganismCode: "NOGRO",
    defaultOrganismCode: "EFAM",
    allowedAstPanelIds: ["vre_screen"],
    defaultAstPanelId: "vre_screen",
    requiredAstAntibioticCodes: ["VAN"],
    organismHelp:
      "VRE screens accept Enterococcus faecalis/faecium or an explicit no-growth/negative result only.",
    astHelp:
      "If Enterococcus is detected, enter vancomycin to classify VRE versus vancomycin-susceptible Enterococcus.",
  },
  COL_CPE_RECTAL: {
    kind: "cpe",
    label: "CPE/CPO screen",
    organismCodes: ["ECOL", "KPNE", "PMIR", "ENTC", "NOGRO"],
    positiveOrganismCodes: ["ECOL", "KPNE", "PMIR", "ENTC"],
    negativeOrganismCode: "NOGRO",
    defaultOrganismCode: "ECOL",
    allowedAstPanelIds: ["cpe_screen"],
    defaultAstPanelId: "cpe_screen",
    requiredAstAntibioticCodes: ["ETP", "MEM", "IPM"],
    organismHelp:
      "CPE/CPO screens are restricted to Enterobacterales targets or an explicit no-growth/negative result.",
    astHelp:
      "If Enterobacterales are detected, enter ertapenem, meropenem or imipenem to classify carbapenem resistance/carbapenemase suspicion.",
  },
  COL_CRAB_SCREEN: {
    kind: "crab",
    label: "CRAB screen",
    organismCodes: ["ABAU", "NOGRO"],
    positiveOrganismCodes: ["ABAU"],
    negativeOrganismCode: "NOGRO",
    defaultOrganismCode: "ABAU",
    allowedAstPanelIds: ["crab_screen"],
    defaultAstPanelId: "crab_screen",
    requiredAstAntibioticCodes: ["MEM", "IPM"],
    organismHelp:
      "CRAB screens are restricted to Acinetobacter baumannii complex or an explicit no-growth/negative result.",
    astHelp:
      "If Acinetobacter baumannii complex is detected, enter meropenem or imipenem to classify carbapenem resistance.",
  },
  COL_CRPA_SCREEN: {
    kind: "crpa",
    label: "CRPA screen",
    organismCodes: ["PAER", "NOGRO"],
    positiveOrganismCodes: ["PAER"],
    negativeOrganismCode: "NOGRO",
    defaultOrganismCode: "PAER",
    allowedAstPanelIds: ["crpa_screen"],
    defaultAstPanelId: "crpa_screen",
    requiredAstAntibioticCodes: ["MEM", "IPM"],
    organismHelp:
      "CRPA screens are restricted to Pseudomonas aeruginosa or an explicit no-growth/negative result.",
    astHelp:
      "If Pseudomonas aeruginosa is detected, enter meropenem or imipenem to classify carbapenem resistance.",
  },
  COL_CANDIDA_AURIS: {
    kind: "candida_auris",
    label: "Candida auris screen",
    organismCodes: ["CAUR", "NOGRO"],
    positiveOrganismCodes: ["CAUR"],
    negativeOrganismCode: "NOGRO",
    defaultOrganismCode: "CAUR",
    allowedAstPanelIds: [],
    requiredAstAntibioticCodes: [],
    organismHelp:
      "C. auris screens accept Candida auris detected or an explicit no-growth/negative result only.",
    astHelp: "No antibacterial AST panel is configured for this screen pathway.",
  },
};

export function getColonisationScreenPathway(
  familyCode?: string,
  subtypeCode?: string,
): ColonisationScreenPathway | null {
  if (familyCode !== "COLONISATION" || !subtypeCode) return null;
  return COLONISATION_SCREEN_PATHWAYS[subtypeCode] ?? null;
}

export function isAllowedColonisationScreenOrganism(
  familyCode: string,
  subtypeCode: string,
  organismCode: string,
): boolean {
  const pathway = getColonisationScreenPathway(familyCode, subtypeCode);
  return !pathway || pathway.organismCodes.includes(organismCode);
}

// ---------- Resolver ----------

export function resolveSpecimen(familyCode: string, subtypeCode: string): ResolverResult {
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
    case "STOOL":
      return { ok: true, profile: resolveStool(subtypeCode, subtype.display) };
    case "GENITAL":
      return { ok: true, profile: resolveGenital(subtypeCode, subtype.display) };
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
    ipcFlagHints: ["alert_organism_watch"].concat(
      isLine ? ["device_associated_watch"] : [],
    ) as IPCFlagHint[],
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
    subtypeCode === "LRT_BAL" || subtypeCode === "LRT_BRONCH_WASH" || subtypeCode === "LRT_QUANT";
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
    quantitative: isQuant ? { code: "LRT_QUANT", thresholds: { significantCfuPerMl: 1e4 } } : null,
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
  const pathway = getColonisationScreenPathway("COLONISATION", subtypeCode);
  const hintMap: Record<ColonisationScreenKind, IPCFlagHint> = {
    mrsa: "mrsa_screen",
    vre: "vre_screen",
    cpe: "cpe_screen",
    crab: "crab_screen",
    crpa: "crpa_screen",
    candida_auris: "candida_auris_screen",
  };
  const ipcHint = pathway ? hintMap[pathway.kind] : undefined;

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

// ---------- Genital / reproductive tract ----------

function resolveGenital(subtypeCode: string, display: string): ResolvedSpecimenProfile {
  const isVaginal = subtypeCode === "GEN_HVS" || subtypeCode === "GEN_VULVOVAGINAL";
  const isStiTargeted =
    subtypeCode === "GEN_ENDOCERVICAL" ||
    subtypeCode === "GEN_URETHRAL" ||
    subtypeCode === "GEN_GENITAL_ULCER";
  const isSemen = subtypeCode === "GEN_SEMEN";
  const isDevice = subtypeCode === "GEN_IUCD";

  const requiredFields: FieldKey[] = ["collectionMethodNote"];
  if (isStiTargeted || isDevice) requiredFields.push("anatomicSite");

  const microscopy: MicroscopyConfig = isVaginal
    ? {
        required: ["wetMount"],
        optional: ["gram", "leukocytes", "epithelialCells"],
        structured: true,
        gatesCulture: false,
      }
    : isStiTargeted
      ? {
          required: ["gram"],
          optional: ["wetMount", "leukocytes"],
          structured: true,
          gatesCulture: false,
        }
      : {
          required: ["gram"],
          optional: ["wetMount"],
          structured: false,
          gatesCulture: false,
        };

  const panels: WorkbenchPanelKey[] = ["genital_panel"];
  if (isStiTargeted) panels.push("sti_panel");

  return {
    familyCode: "GENITAL",
    subtypeCode,
    displayName: display,
    acceptance: {
      mode: "qualified",
      rejectionReasonCodes: [
        "GENITAL_DRY_SWAB",
        "GENITAL_DELAYED_TRANSPORT",
        "GENITAL_WRONG_SITE",
        "GENITAL_LEAKED",
      ],
      contaminationContextRequired: false,
      notes: isStiTargeted
        ? "STI-targeted genital swabs should be processed as targeted pathogen workups; correlate with NAAT where available."
        : "Routine genital culture should report recognised pathogens or targeted findings and avoid over-reporting commensal flora.",
    },
    microscopy,
    requiredFields,
    optionalFields: ["contaminationNotes"],
    reportSections: [
      "microscopy",
      "culture",
      ...(isSemen || isStiTargeted ? (["ast"] as ReportSectionKey[]) : []),
    ],
    workbenchPanels: panels,
    gating: {
      consultantReleaseRequired: false,
      criticalCommunicationRequired: false,
      pathway: "diagnostic",
      clearanceTracked: false,
    },
    quantitative: null,
    ipcFlagHints: [],
    syndrome: isStiTargeted ? "sti_syndrome" : "genital_infection",
  };
}

// ---------- Stool / enteric ----------

function resolveStool(subtypeCode: string, display: string): ResolvedSpecimenProfile {
  const isCdiff = subtypeCode === "STOOL_CDIFF";
  const isOvaParasites = subtypeCode === "STOOL_OVA_PARASITES";
  const isOutbreak = subtypeCode === "STOOL_OUTBREAK";
  const isRectalSwab = subtypeCode === "RECTAL_SWAB_ENTERIC";

  const requiredFields: FieldKey[] = ["stoolConsistency"];
  const optionalFields: FieldKey[] = ["travelHistory", "antibioticExposure", "contaminationNotes"];

  // C. diff testing requires unformed stool documentation; rectal swabs not accepted.
  const acceptance: AcceptanceRule = isCdiff
    ? {
        mode: "rejectable",
        rejectionReasonCodes: [
          "STOOL_FORMED_CDIFF",
          "STOOL_RECTAL_SWAB_CDIFF",
          "STOOL_INSUFFICIENT",
        ],
        contaminationContextRequired: false,
        notes:
          "C. difficile testing requires unformed stool; rectal swabs and formed stools are rejected.",
      }
    : isOvaParasites
      ? {
          mode: "qualified",
          rejectionReasonCodes: [
            "STOOL_PRESERVATIVE_MISSING",
            "STOOL_INSUFFICIENT",
            "STOOL_DELAYED",
          ],
          contaminationContextRequired: false,
          notes: "O&P examination ideally needs three serial specimens in fixative.",
        }
      : isRectalSwab
        ? {
            mode: "qualified",
            rejectionReasonCodes: ["SWAB_DRY", "SWAB_NO_FAECAL_MATERIAL"],
            contaminationContextRequired: false,
            notes:
              "Rectal swab is suboptimal for routine enteric culture; use only when stool unobtainable.",
          }
        : {
            mode: "qualified",
            rejectionReasonCodes: ["STOOL_DELAYED", "STOOL_INSUFFICIENT", "STOOL_LEAKED"],
            contaminationContextRequired: false,
            notes: isOutbreak
              ? "Outbreak / cluster screen — link to outbreak ID and notify IPC."
              : undefined,
          };

  const microscopy: MicroscopyConfig = isOvaParasites
    ? {
        required: ["wetMount"],
        optional: [],
        structured: false,
        gatesCulture: false,
      }
    : {
        required: [],
        optional: ["wetMount"],
        structured: false,
        gatesCulture: false,
      };

  const panels: WorkbenchPanelKey[] = [];
  if (isCdiff) panels.push("stool_cdiff_panel");
  else if (isOvaParasites) panels.push("stool_parasitology_panel");
  else panels.push("stool_enteric_panel");

  const reportSections: ReportSectionKey[] = isOvaParasites
    ? ["microscopy", "culture"]
    : isCdiff
      ? ["culture"]
      : ["culture", "ast"];

  let syndrome: SyndromeCode = "infectious_diarrhoea";
  if (isCdiff) syndrome = "cdiff_infection";
  else if (isOvaParasites) syndrome = "intestinal_parasitosis";

  return {
    familyCode: "STOOL",
    subtypeCode,
    displayName: display,
    acceptance,
    microscopy,
    requiredFields,
    optionalFields,
    reportSections,
    workbenchPanels: panels,
    gating: {
      consultantReleaseRequired: false,
      criticalCommunicationRequired: false,
      pathway: "diagnostic",
      clearanceTracked: false,
    },
    quantitative: null,
    // Outbreak specimens get IPC alert-organism watch; otherwise none by default.
    ipcFlagHints: isOutbreak ? ["alert_organism_watch"] : [],
    syndrome,
  };
}
