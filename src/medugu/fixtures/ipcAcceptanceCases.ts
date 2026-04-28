import type { Accession, ASTResult, Isolate, MeduguState } from "../domain/types";
import { ASTMethod, Priority, ReleaseState, Sex, WorkflowStage } from "../domain/enums";
import { DEMO_ACCESSIONS } from "../seed/demoAccessions";

function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function astRow(
  isolateId: string,
  antibioticCode: string,
  interpretation: "S" | "I" | "R",
  rawValue?: number,
  method: ASTMethod = ASTMethod.DiskDiffusion,
): ASTResult {
  return {
    id: `ast_${isolateId}_${antibioticCode}`,
    isolateId,
    antibioticCode,
    method,
    standard: "CLSI",
    rawValue,
    rawUnit: method === ASTMethod.MIC_Broth ? "mg/L" : "mm",
    rawInterpretation: interpretation,
    interpretedSIR: interpretation,
    finalInterpretation: interpretation,
    governance: "interpreted",
    cascade: "primary",
  };
}

function isolateRow(id: string, organismCode: string, organismDisplay: string, significance: Isolate["significance"] = "significant"): Isolate {
  return {
    id,
    isolateNo: 1,
    organismCode,
    organismDisplay,
    significance,
    identifiedAt: "2026-04-25T10:00:00.000Z",
  };
}

function baseAccession(id: string, mrn: string): Accession {
  return {
    id,
    accessionNumber: id,
    createdAt: "2026-04-25T10:00:00.000Z",
    updatedAt: "2026-04-25T10:00:00.000Z",
    workflowStatus: WorkflowStage.IPC,
    stage: WorkflowStage.IPC,
    priority: Priority.Routine,
    patient: {
      mrn,
      givenName: "IPC",
      familyName: "Scenario",
      sex: Sex.Female,
      ward: "Medical Ward",
      attendingClinician: "Dr. Review",
    },
    specimen: {
      familyCode: "BLOOD",
      subtypeCode: "BC_PERIPHERAL",
      collectedAt: "2026-04-25T08:00:00.000Z",
      receivedAt: "2026-04-25T09:00:00.000Z",
      freeTextLabel: "Blood culture",
    },
    specimenAssessments: [],
    microscopy: [],
    isolates: [],
    ast: [],
    interpretiveComments: [],
    phoneOuts: [],
    stewardship: [],
    ipc: [],
    validation: [],
    audit: [],
    release: { state: ReleaseState.Draft, reportVersion: 0 },
    ruleVersion: "1.0.0",
    breakpointVersion: "EUCAST-2026.1",
    exportVersion: "1.0.0",
    buildVersion: "dev",
  };
}

const demoById = Object.fromEntries(DEMO_ACCESSIONS.map((accession) => [accession.id, accession]));

export const creSterileSiteCase: Accession = deepClone(demoById["MB25-CRE001"]);
export const mrsaBloodstreamCase: Accession = deepClone(demoById["MB25-EF34GH"]);

export const vreCase: Accession = (() => {
  const accession = baseAccession("IPC-VRE-001", "IPC-MRN-VRE");
  const iso = isolateRow("iso_vre_1", "EFAM", "Enterococcus faecium");
  accession.patient.ward = "Surgical Ward";
  accession.specimen.freeTextLabel = "Blood culture";
  accession.isolates = [iso];
  accession.ast = [
    astRow(iso.id, "VAN", "R", 32, ASTMethod.MIC_Broth),
    astRow(iso.id, "LZD", "S", 1, ASTMethod.MIC_Broth),
  ];
  return accession;
})();

export const candidaAurisScreenPositiveCase: Accession = (() => {
  const accession = baseAccession("IPC-CAURIS-SCREEN-001", "IPC-MRN-CAURIS");
  accession.priority = Priority.Urgent;
  accession.patient.ward = "ICU";
  accession.specimen = {
    familyCode: "COLONISATION",
    subtypeCode: "COL_CANDIDA_AURIS",
    collectedAt: "2026-04-24T08:00:00.000Z",
    receivedAt: "2026-04-24T10:00:00.000Z",
    freeTextLabel: "Candida auris admission screen",
  };
  accession.isolates = [isolateRow("iso_cauris_1", "CAUR", "Candida auris")];
  return accession;
})();

export const mrsaAdmissionScreenPositiveCase: Accession = (() => {
  const accession = baseAccession("IPC-MRSA-SCREEN-001", "IPC-MRN-MRSA-SCREEN");
  accession.patient.ward = "Admission Unit";
  accession.specimen = {
    familyCode: "COLONISATION",
    subtypeCode: "COL_MRSA_NOSE",
    collectedAt: "2026-04-24T09:00:00.000Z",
    receivedAt: "2026-04-24T10:00:00.000Z",
    freeTextLabel: "MRSA admission screen",
  };
  accession.isolates = [isolateRow("iso_mrsa_screen_1", "SAUR", "Staphylococcus aureus")];
  accession.ast = [
    astRow("iso_mrsa_screen_1", "FOX", "R", 6),
    astRow("iso_mrsa_screen_1", "OXA", "R", 6),
  ];
  return accession;
})();

export const creClearanceSeries: Accession[] = [
  (() => {
    const positive = baseAccession("IPC-CRE-CLEAR-POS", "IPC-MRN-CRE-CLEAR");
    positive.patient.ward = "ICU";
    positive.specimen = {
      familyCode: "COLONISATION",
      subtypeCode: "COL_CPE_RECTAL",
      collectedAt: "2026-04-15T08:00:00.000Z",
      receivedAt: "2026-04-15T09:00:00.000Z",
      freeTextLabel: "CRE admission screen",
    };
    const iso = isolateRow("iso_cre_pos_1", "KPNE", "Klebsiella pneumoniae");
    positive.isolates = [iso];
    positive.ast = [
      astRow(iso.id, "MEM", "R", 8, ASTMethod.MIC_Broth),
      astRow(iso.id, "ETP", "R", 4, ASTMethod.MIC_Broth),
    ];
    return positive;
  })(),
  (() => {
    const negative1 = baseAccession("IPC-CRE-CLEAR-NEG-1", "IPC-MRN-CRE-CLEAR");
    negative1.patient.ward = "ICU";
    negative1.specimen = {
      familyCode: "COLONISATION",
      subtypeCode: "COL_CPE_RECTAL",
      collectedAt: "2026-04-20T08:00:00.000Z",
      receivedAt: "2026-04-20T09:00:00.000Z",
      freeTextLabel: "CRE clearance screen 1",
    };
    negative1.isolates = [isolateRow("iso_cre_neg_1", "NOGRO", "No growth", "normal_flora")];
    return negative1;
  })(),
];

export const creClusterIcuCases: Accession[] = [
  { ...deepClone(creSterileSiteCase), id: "IPC-CRE-ICU-1", accessionNumber: "IPC-CRE-ICU-1", patient: { ...deepClone(creSterileSiteCase.patient), mrn: "IPC-MRN-ICU-1", ward: "ICU" }, specimen: { ...deepClone(creSterileSiteCase.specimen), collectedAt: "2026-04-21T08:00:00.000Z" } },
  { ...deepClone(creSterileSiteCase), id: "IPC-CRE-ICU-2", accessionNumber: "IPC-CRE-ICU-2", patient: { ...deepClone(creSterileSiteCase.patient), mrn: "IPC-MRN-ICU-2", ward: "ICU" }, specimen: { ...deepClone(creSterileSiteCase.specimen), collectedAt: "2026-04-22T08:00:00.000Z" } },
  { ...deepClone(creSterileSiteCase), id: "IPC-CRE-ICU-3", accessionNumber: "IPC-CRE-ICU-3", patient: { ...deepClone(creSterileSiteCase.patient), mrn: "IPC-MRN-ICU-3", ward: "ICU" }, specimen: { ...deepClone(creSterileSiteCase.specimen), collectedAt: "2026-04-23T08:00:00.000Z" } },
];

export const repeatedSamePatientCreCases: Accession[] = [
  { ...deepClone(creSterileSiteCase), id: "IPC-CRE-REP-1", accessionNumber: "IPC-CRE-REP-1", patient: { ...deepClone(creSterileSiteCase.patient), mrn: "IPC-MRN-REP", ward: "ICU" }, specimen: { ...deepClone(creSterileSiteCase.specimen), collectedAt: "2026-04-21T08:00:00.000Z" } },
  { ...deepClone(creSterileSiteCase), id: "IPC-CRE-REP-2", accessionNumber: "IPC-CRE-REP-2", patient: { ...deepClone(creSterileSiteCase.patient), mrn: "IPC-MRN-REP", ward: "ICU" }, specimen: { ...deepClone(creSterileSiteCase.specimen), collectedAt: "2026-04-22T08:00:00.000Z" } },
  { ...deepClone(creSterileSiteCase), id: "IPC-CRE-REP-3", accessionNumber: "IPC-CRE-REP-3", patient: { ...deepClone(creSterileSiteCase.patient), mrn: "IPC-MRN-REP", ward: "ICU" }, specimen: { ...deepClone(creSterileSiteCase.specimen), collectedAt: "2026-04-23T08:00:00.000Z" } },
];

export const negativeNoSignalCase: Accession = (() => {
  const accession = baseAccession("IPC-NO-SIGNAL-001", "IPC-MRN-NO-SIGNAL");
  accession.patient.ward = "General Ward";
  accession.specimen = {
    familyCode: "URINE",
    subtypeCode: "URINE_MIDSTREAM",
    collectedAt: "2026-04-24T08:00:00.000Z",
    receivedAt: "2026-04-24T09:00:00.000Z",
    freeTextLabel: "Urine culture",
  };
  accession.isolates = [isolateRow("iso_no_signal_1", "NOGRO", "No growth", "normal_flora")];
  return accession;
})();

export const ipcAcceptanceScenarioCases = {
  creSterileSiteCase,
  mrsaBloodstreamCase,
  vreCase,
  candidaAurisScreenPositiveCase,
  mrsaAdmissionScreenPositiveCase,
  creClearanceSeries,
  creClusterIcuCases,
  repeatedSamePatientCreCases,
  negativeNoSignalCase,
};

export function toAccessionsMap(accessions: Accession[]): MeduguState["accessions"] {
  return Object.fromEntries(accessions.map((accession) => [accession.id, accession]));
}
