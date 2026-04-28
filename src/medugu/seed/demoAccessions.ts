// Seeded demo accessions — Phase 4 named benchmark scenarios.
// Each case is fully wired (isolates + AST rows where applicable) so engines
// fire on first load without requiring manual data entry.

import type { Accession, ASTResult, Isolate } from "../domain/types";
import { Priority, ReleaseState, Sex, WorkflowStage, ASTMethod } from "../domain/enums";
import {
  BUILD_VERSION,
  BREAKPOINT_VERSION,
  EXPORT_VERSION,
  RULE_VERSION,
} from "../domain/versions";

const now = new Date().toISOString();
const dayAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString();

function emptyTail() {
  return {
    specimenAssessments: [],
    microscopy: [],
    isolates: [] as Isolate[],
    ast: [] as ASTResult[],
    interpretiveComments: [],
    phoneOuts: [],
    stewardship: [],
    ipc: [],
    validation: [],
    audit: [],
    ruleVersion: RULE_VERSION.version,
    breakpointVersion: BREAKPOINT_VERSION,
    exportVersion: EXPORT_VERSION,
    buildVersion: BUILD_VERSION,
  };
}

function base(id: string, status: WorkflowStage, createdAt = now) {
  return {
    id,
    accessionNumber: id,
    createdAt,
    updatedAt: createdAt,
    workflowStatus: status,
    stage: status,
  };
}

function iso(
  isolateNo: number,
  organismCode: string,
  organismDisplay: string,
  extra: Partial<Isolate> = {},
): Isolate {
  return {
    id: `iso_${organismCode}_${isolateNo}`,
    isolateNo,
    organismCode,
    organismDisplay,
    significance: "significant",
    identifiedAt: now,
    ...extra,
  };
}

function ast(
  isolateId: string,
  antibioticCode: string,
  rawValue: number | undefined,
  rawInterpretation: "S" | "I" | "R",
  method: ASTMethod = ASTMethod.DiskDiffusion,
): ASTResult {
  const rawUnit: "mm" | "mg/L" = method === ASTMethod.DiskDiffusion ? "mm" : "mg/L";
  return {
    id: `ast_${isolateId}_${antibioticCode}`,
    isolateId,
    antibioticCode,
    method,
    standard: "CLSI",
    rawValue,
    rawUnit,
    rawInterpretation,
    interpretedSIR: rawInterpretation,
    finalInterpretation: rawInterpretation,
    governance: "interpreted",
    cascade: "primary",
  };
}

// ---------- Build scenarios ----------

// 1. MRSA bloodstream infection (MB25-EF34GH)
const mrsa = (() => {
  const i = iso(1, "SAUR", "Staphylococcus aureus", { growthQuantifierCode: "HEAVY" });
  return {
    ...base("MB25-EF34GH", WorkflowStage.AST),
    priority: Priority.Urgent,
    patient: {
      mrn: "AMCE-000456",
      givenName: "Tunde",
      familyName: "Adeyemi",
      sex: Sex.Male,
      dob: "1968-09-30",
      ward: "ICU",
      attendingClinician: "Dr. Eze",
    },
    specimen: {
      familyCode: "BLOOD",
      subtypeCode: "BC_CENTRAL_LINE",
      collectedAt: now,
      receivedAt: now,
      containerCode: "BC_BOTTLE_AEROBIC",
      freeTextLabel: "Blood culture, central line",
    },
    ...emptyTail(),
    isolates: [i],
    ast: [
      ast(i.id, "FOX", 6, "R"),
      ast(i.id, "OXA", 6, "R"),
      ast(i.id, "AMP", 8, "R"),
      ast(i.id, "CRO", 14, "R"),
      ast(i.id, "VAN", 1, "S", ASTMethod.MIC_Broth),
      ast(i.id, "ERY", 6, "R"),
      ast(i.id, "CLI", 22, "S"),
      ast(i.id, "SXT", 24, "S"),
    ],
    release: { state: ReleaseState.Draft, reportVersion: 0 },
  } as Accession;
})();

// 2. ESBL UTI (MB25-AB12CD)
const esbl = (() => {
  const i = iso(1, "ECOL", "Escherichia coli", {
    colonyCountCfuPerMl: 1e5,
    growthQuantifierCode: "HEAVY",
  });
  return {
    ...base("MB25-AB12CD", WorkflowStage.AST),
    priority: Priority.Routine,
    patient: {
      mrn: "AMCE-000123",
      givenName: "Amaka",
      familyName: "Okafor",
      sex: Sex.Female,
      dob: "1991-04-12",
      ward: "Medical Ward A",
      attendingClinician: "Dr. Bello",
    },
    specimen: {
      familyCode: "URINE",
      subtypeCode: "URINE_MIDSTREAM",
      collectedAt: now,
      receivedAt: now,
      containerCode: "STERILE_UNIVERSAL",
      volumeMl: 20,
      freeTextLabel: "Mid-stream urine",
    },
    ...emptyTail(),
    isolates: [i],
    ast: [
      ast(i.id, "AMP", 8, "R"),
      ast(i.id, "AMC", 14, "I"),
      ast(i.id, "CRO", 14, "R"),
      ast(i.id, "CAZ", 14, "R"),
      ast(i.id, "FEP", 16, "I"),
      ast(i.id, "MEM", 0.25, "S", ASTMethod.MIC_Broth),
      ast(i.id, "CIP", 14, "R"),
      ast(i.id, "GEN", 18, "S"),
      ast(i.id, "NIT", 22, "S"),
      ast(i.id, "FOS", 22, "S"),
      ast(i.id, "SXT", 22, "S"),
    ],
    release: { state: ReleaseState.Draft, reportVersion: 0 },
  } as Accession;
})();

// 3. CRE sterile-site infection (MB25-CRE001) — pleural fluid
const cre = (() => {
  const i = iso(1, "KPNE", "Klebsiella pneumoniae", { growthQuantifierCode: "MODERATE" });
  return {
    ...base("MB25-CRE001", WorkflowStage.AST),
    priority: Priority.Stat,
    patient: {
      mrn: "AMCE-002345",
      givenName: "Chinedu",
      familyName: "Obi",
      sex: Sex.Male,
      dob: "1972-02-10",
      ward: "ICU",
      attendingClinician: "Dr. Lawal",
    },
    specimen: {
      familyCode: "STERILE_FLUID",
      subtypeCode: "SF_PLEURAL",
      collectedAt: now,
      receivedAt: now,
      containerCode: "STERILE_UNIVERSAL",
      volumeMl: 10,
      freeTextLabel: "Pleural fluid",
    },
    ...emptyTail(),
    isolates: [i],
    ast: [
      ast(i.id, "AMP", 6, "R"),
      ast(i.id, "AMC", 10, "R"),
      ast(i.id, "CRO", 6, "R"),
      ast(i.id, "CAZ", 6, "R"),
      ast(i.id, "FEP", 10, "R"),
      ast(i.id, "MEM", 8, "R", ASTMethod.MIC_Broth),
      ast(i.id, "ETP", 10, "R", ASTMethod.MIC_Broth),
      ast(i.id, "CIP", 10, "R"),
      ast(i.id, "GEN", 10, "R"),
      ast(i.id, "AMK", 18, "S"),
      ast(i.id, "CST", 0.5, "S", ASTMethod.MIC_Broth),
    ],
    release: { state: ReleaseState.Draft, reportVersion: 0 },
  } as Accession;
})();

// 4. Sputum quality rejection — Bartlett fail (MB25-NP78QR)
const sputum = (() => {
  return {
    ...base("MB25-NP78QR", WorkflowStage.Microscopy),
    priority: Priority.Routine,
    patient: {
      mrn: "AMCE-001011",
      givenName: "Chika",
      familyName: "Nwosu",
      sex: Sex.Male,
      dob: "1955-06-04",
      ward: "Respiratory Ward",
      attendingClinician: "Dr. Okonkwo",
    },
    specimen: {
      familyCode: "LRT",
      subtypeCode: "LRT_SPUTUM",
      collectedAt: now,
      receivedAt: now,
      containerCode: "STERILE_UNIVERSAL",
      volumeMl: 5,
      freeTextLabel: "Sputum",
    },
    ...emptyTail(),
    microscopy: [
      {
        id: "mic_bartlett_1",
        stainCode: "qualityScore_Bartlett",
        result: "REJECT",
        organismsSeen: "Heavy squamous epithelial cells (>25/lpf), few leukocytes",
        notes: "Bartlett score -2 — saliva-contaminated; specimen unsuitable for culture.",
      },
    ],
    specimenAssessments: [
      {
        id: "sa_1",
        assessedAt: now,
        assessedBy: "local",
        acceptable: false,
        rejectionReasonCode: "LRT_BARTLETT_FAIL",
        conditionFlags: ["saliva", "low_leukocytes"],
        notes: "Bartlett quality screen failed; request repeat deep cough sputum.",
      },
    ],
    release: { state: ReleaseState.Draft, reportVersion: 0 },
  } as Accession;
})();

// 5. CSF meningitis — consultant-controlled release (MB25-JK56LM)
const csf = (() => {
  const i = iso(1, "SPNE", "Streptococcus pneumoniae", { growthQuantifierCode: "MODERATE" });
  return {
    ...base("MB25-JK56LM", WorkflowStage.Validation),
    priority: Priority.Stat,
    patient: {
      mrn: "AMCE-000789",
      givenName: "Ngozi",
      familyName: "Umeh",
      sex: Sex.Female,
      dob: "2002-01-22",
      ward: "Paediatrics",
      attendingClinician: "Dr. Sani",
    },
    specimen: {
      familyCode: "STERILE_FLUID",
      subtypeCode: "SF_CSF",
      collectedAt: now,
      receivedAt: now,
      containerCode: "STERILE_UNIVERSAL",
      volumeMl: 2,
      freeTextLabel: "CSF, lumbar puncture",
    },
    ...emptyTail(),
    microscopy: [
      { id: "mic_csf_g", stainCode: "gram", result: "gram_positive", organismsSeen: "Gram-positive diplococci" },
      { id: "mic_csf_w", stainCode: "cellCountWBC", result: "1850" },
      { id: "mic_csf_r", stainCode: "cellCountRBC", result: "5" },
      { id: "mic_csf_d", stainCode: "differential", result: "neutrophils 92%" },
    ],
    isolates: [i],
    ast: [
      ast(i.id, "CRO", 28, "S"),
      ast(i.id, "VAN", 0.5, "S", ASTMethod.MIC_Broth),
      ast(i.id, "MEM", 24, "S"),
      ast(i.id, "AMP", 26, "S"),
      ast(i.id, "ERY", 18, "S"),
      ast(i.id, "NIT", 22, "S"),
    ],
    phoneOuts: [
      {
        id: "po_csf_1",
        at: now,
        calledBy: "local",
        recipient: "Dr. Sani",
        reasonCode: "critical_value",
        message: "CSF Gram-positive diplococci — likely S. pneumoniae meningitis.",
        acknowledged: true,
        acknowledgedAt: now,
      },
    ],
    release: { state: ReleaseState.PendingValidation, reportVersion: 0 },
  } as Accession;
})();

// 6. MRSA admission screen positive
const mrsaScreen = (() => {
  const i = iso(1, "SAUR", "Staphylococcus aureus (MRSA screen)", {
    growthQuantifierCode: "LIGHT",
    significance: "significant",
  });
  return {
    ...base("MB25-COL001", WorkflowStage.Culture),
    priority: Priority.Routine,
    patient: {
      mrn: "AMCE-004001",
      givenName: "Lola",
      familyName: "Akinola",
      sex: Sex.Female,
      dob: "1983-05-04",
      ward: "Surgical Admission Unit",
      attendingClinician: "Dr. Ajayi",
    },
    specimen: {
      familyCode: "COLONISATION",
      subtypeCode: "COL_MRSA_NOSE",
      collectedAt: now,
      receivedAt: now,
      containerCode: "SWAB_TRANSPORT",
      freeTextLabel: "MRSA admission screen",
    },
    ...emptyTail(),
    isolates: [i],
    ast: [ast(i.id, "FOX", 6, "R"), ast(i.id, "OXA", 8, "R"), ast(i.id, "VAN", 1, "S", ASTMethod.MIC_Broth)],
    release: { state: ReleaseState.Draft, reportVersion: 0 },
  } as Accession;
})();

// 7. VRE contact screen positive
const vreScreen = (() => {
  const i = iso(1, "EFAM", "Enterococcus faecium (VRE screen)", {
    growthQuantifierCode: "LIGHT",
    significance: "significant",
  });
  return {
    ...base("MB25-COL002", WorkflowStage.Culture),
    priority: Priority.Routine,
    patient: {
      mrn: "AMCE-004002",
      givenName: "Hauwa",
      familyName: "Yusuf",
      sex: Sex.Female,
      dob: "1971-01-14",
      ward: "ICU",
      attendingClinician: "Dr. Omole",
    },
    specimen: {
      familyCode: "COLONISATION",
      subtypeCode: "COL_VRE_RECTAL",
      collectedAt: now,
      receivedAt: now,
      containerCode: "SWAB_TRANSPORT",
      freeTextLabel: "VRE contact screen",
    },
    ...emptyTail(),
    isolates: [i],
    ast: [ast(i.id, "VAN", 32, "R", ASTMethod.MIC_Broth), ast(i.id, "TEC", 24, "R")],
    release: { state: ReleaseState.Draft, reportVersion: 0 },
  } as Accession;
})();

// 8. CRE/CPE clearance pathway: prior positive and current negative.
const cpeScreenPositive = (() => {
  const i = iso(1, "KPNE", "Klebsiella pneumoniae (CPE screen)", {
    growthQuantifierCode: "LIGHT",
    significance: "significant",
  });
  return {
    ...base("MB25-COL003P", WorkflowStage.Released, dayAgo(30)),
    priority: Priority.Routine,
    patient: {
      mrn: "AMCE-004003",
      givenName: "Funmi",
      familyName: "Adebayo",
      sex: Sex.Female,
      dob: "1979-11-17",
      ward: "Surgical HDU",
      attendingClinician: "Dr. Ibrahim",
    },
    specimen: {
      familyCode: "COLONISATION",
      subtypeCode: "COL_CPE_RECTAL",
      collectedAt: dayAgo(30),
      receivedAt: dayAgo(30),
      containerCode: "SWAB_TRANSPORT",
      freeTextLabel: "CPE admission screen",
    },
    ...emptyTail(),
    isolates: [i],
    ast: [ast(i.id, "MEM", 8, "R", ASTMethod.MIC_Broth), ast(i.id, "ETP", 8, "R", ASTMethod.MIC_Broth)],
    release: { state: ReleaseState.Released, reportVersion: 1 },
  } as Accession;
})();

const cpeScreenNeg1 = (() => ({
  ...base("MB25-COL003A", WorkflowStage.Released, dayAgo(20)),
  priority: Priority.Routine,
  patient: { ...cpeScreenPositive.patient },
  specimen: {
    familyCode: "COLONISATION",
    subtypeCode: "COL_CPE_RECTAL",
    collectedAt: dayAgo(20),
    receivedAt: dayAgo(20),
    containerCode: "SWAB_TRANSPORT",
    freeTextLabel: "CPE clearance screen 1",
  },
  ...emptyTail(),
  isolates: [iso(1, "NOGRO", "No growth", { significance: "indeterminate" })],
  release: { state: ReleaseState.Released, reportVersion: 1 },
}) as Accession)();

const cpeScreenNeg2 = (() => ({
  ...base("MB25-COL003B", WorkflowStage.Released, dayAgo(10)),
  priority: Priority.Routine,
  patient: { ...cpeScreenPositive.patient },
  specimen: {
    familyCode: "COLONISATION",
    subtypeCode: "COL_CPE_RECTAL",
    collectedAt: dayAgo(10),
    receivedAt: dayAgo(10),
    containerCode: "SWAB_TRANSPORT",
    freeTextLabel: "CPE clearance screen 2",
  },
  ...emptyTail(),
  isolates: [iso(1, "NOGRO", "No growth", { significance: "indeterminate" })],
  release: { state: ReleaseState.Released, reportVersion: 1 },
}) as Accession)();

const cpeScreenNeg3Current = (() => ({
  ...base("MB25-COL003C", WorkflowStage.Culture),
  priority: Priority.Routine,
  patient: { ...cpeScreenPositive.patient },
  specimen: {
    familyCode: "COLONISATION",
    subtypeCode: "COL_CPE_RECTAL",
    collectedAt: now,
    receivedAt: now,
    containerCode: "SWAB_TRANSPORT",
    freeTextLabel: "CPE clearance screen 3",
  },
  ...emptyTail(),
  isolates: [iso(1, "NOGRO", "No growth", { significance: "indeterminate" })],
  release: { state: ReleaseState.Draft, reportVersion: 0 },
}) as Accession)();

// 9. Candida auris screen positive
const candidaAurisScreen = (() => {
  const i = iso(1, "CAUR", "Candida auris", {
    growthQuantifierCode: "MODERATE",
    significance: "significant",
  });
  return {
    ...base("MB25-COL004", WorkflowStage.Culture),
    priority: Priority.Stat,
    patient: {
      mrn: "AMCE-004004",
      givenName: "Aisha",
      familyName: "Karim",
      sex: Sex.Female,
      dob: "1962-07-18",
      ward: "Burns Unit",
      attendingClinician: "Dr. Odeh",
    },
    specimen: {
      familyCode: "COLONISATION",
      subtypeCode: "COL_CANDIDA_AURIS",
      collectedAt: now,
      receivedAt: now,
      containerCode: "SWAB_TRANSPORT",
      freeTextLabel: "Candida auris contact screen",
    },
    ...emptyTail(),
    isolates: [i],
    release: { state: ReleaseState.Draft, reportVersion: 0 },
  } as Accession;
})();

// 10. CRAB and CRPA screens to cover high-value target organisms.
const crabScreen = (() => ({
  ...base("MB25-COL005", WorkflowStage.Culture),
  priority: Priority.Routine,
  patient: {
    mrn: "AMCE-004005",
    givenName: "Peter",
    familyName: "Osuji",
    sex: Sex.Male,
    dob: "1959-12-03",
    ward: "ICU",
    attendingClinician: "Dr. Mensah",
  },
  specimen: {
    familyCode: "COLONISATION",
    subtypeCode: "COL_CRAB_SCREEN",
    collectedAt: now,
    receivedAt: now,
    containerCode: "SWAB_TRANSPORT",
    freeTextLabel: "CRAB weekly colonisation screen",
  },
  ...emptyTail(),
  isolates: [iso(1, "ABAU", "Acinetobacter baumannii", { significance: "significant" })],
  release: { state: ReleaseState.Draft, reportVersion: 0 },
}) as Accession)();

const crpaScreenNoPrior = (() => ({
  ...base("MB25-COL006", WorkflowStage.Culture),
  priority: Priority.Routine,
  patient: {
    mrn: "AMCE-004006",
    givenName: "Grace",
    familyName: "Nnaji",
    sex: Sex.Female,
    dob: "1990-03-09",
    ward: "High Dependency Unit",
    attendingClinician: "Dr. Danladi",
  },
  specimen: {
    familyCode: "COLONISATION",
    subtypeCode: "COL_CRPA_SCREEN",
    collectedAt: now,
    receivedAt: now,
    containerCode: "SWAB_TRANSPORT",
    freeTextLabel: "CRPA clearance screen",
  },
  ...emptyTail(),
  isolates: [iso(1, "NOGRO", "No growth", { significance: "indeterminate" })],
  release: { state: ReleaseState.Draft, reportVersion: 0 },
}) as Accession)();

export const DEMO_ACCESSIONS: Accession[] = [
  mrsa,
  esbl,
  cre,
  sputum,
  csf,
  mrsaScreen,
  vreScreen,
  cpeScreenPositive,
  cpeScreenNeg1,
  cpeScreenNeg2,
  cpeScreenNeg3Current,
  candidaAurisScreen,
  crabScreen,
  crpaScreenNoPrior,
];
