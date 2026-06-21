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

function creKlebsiellaClusterAst(isolateId: string): ASTResult[] {
  return [
    ast(isolateId, "AMP", 6, "R"),
    ast(isolateId, "AMC", 10, "R"),
    ast(isolateId, "CRO", 6, "R"),
    ast(isolateId, "CAZ", 6, "R"),
    ast(isolateId, "FEP", 10, "R"),
    ast(isolateId, "MEM", 8, "R", ASTMethod.MIC_Broth),
    ast(isolateId, "ETP", 8, "R", ASTMethod.MIC_Broth),
    ast(isolateId, "CIP", 10, "R"),
    ast(isolateId, "GEN", 10, "R"),
    ast(isolateId, "AMK", 18, "S"),
    ast(isolateId, "CST", 0.5, "S", ASTMethod.MIC_Broth),
  ];
}

function mrsaClusterAst(isolateId: string): ASTResult[] {
  return [
    ast(isolateId, "FOX", 6, "R"),
    ast(isolateId, "OXA", 6, "R"),
    ast(isolateId, "AMP", 8, "R"),
    ast(isolateId, "ERY", 6, "R"),
    ast(isolateId, "CLI", 22, "S"),
    ast(isolateId, "SXT", 24, "S"),
    ast(isolateId, "VAN", 1, "S", ASTMethod.MIC_Broth),
  ];
}

// ---------- Build scenarios ----------

// 1. MRSA bloodstream infection (MB25-EF34GH)
const mrsa = (() => {
  const drawTime = dayAgo(2);
  const positiveTime = dayAgo(1);
  const i = iso(1, "SAUR", "Staphylococcus aureus", {
    growthQuantifierCode: "HEAVY",
    bloodSourceLinks: [{ setNo: 1, bottleType: "AEROBIC" }],
  });
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
      details: {
        sets: [
          {
            drawSite: "CENTRAL_LINE",
            lumenLabel: "Central line lumen",
            bottleTypes: ["AEROBIC", "ANAEROBIC"],
            drawTime,
          },
        ],
        bottleResults: [
          {
            setNo: 1,
            bottleType: "AEROBIC",
            growth: "growth",
            status: "flagged_positive",
            loadedAt: drawTime,
            positiveAt: positiveTime,
            ttpHours: 24,
            drawToPositiveHours: 24,
            gramStain: {
              result: "GPC_CLUSTERS",
              morphology: "Gram-positive cocci in clusters",
              performedBy: "demo",
              performedAt: positiveTime,
            },
            maldiTof: {
              performed: true,
              organismCode: "SAUR",
              organismDisplay: "Staphylococcus aureus",
              confidence: "high",
              score: "2.25",
              performedBy: "demo",
              performedAt: positiveTime,
            },
            directAst: {
              performed: true,
              method: "EUCAST_RAST",
              standard: "EUCAST",
              panelName: "Staphylococcus direct RAST",
              startedAt: positiveTime,
              readAt: now,
              performedBy: "demo",
              resultSummary: "Cefoxitin resistant; glycopeptide MIC pending.",
            },
            criticalCall: {
              calledBy: "demo",
              calledTo: "ICU registrar",
              calledAt: positiveTime,
              readBack: true,
              notes: "Positive blood culture: GPC in clusters, likely Staphylococcus species.",
            },
          },
          {
            setNo: 1,
            bottleType: "ANAEROBIC",
            growth: "pending",
            status: "incubating",
            loadedAt: drawTime,
          },
        ],
      },
    },
    ...emptyTail(),
    isolates: [i],
    ast: mrsaClusterAst(i.id),
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
    ast: creKlebsiellaClusterAst(i.id),
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
      subtypeCode: "COL_MRSA_ADMISSION",
      collectedAt: now,
      receivedAt: now,
      containerCode: "SWAB_TRANSPORT",
      freeTextLabel: "MRSA admission screen",
      details: { screenRound: "ADMISSION", screenSites: ["NARES", "GROIN", "AXILLA"] },
    },
    ...emptyTail(),
    isolates: [i],
    ast: mrsaClusterAst(i.id),
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

// 11. Reset-proof outbreak demonstration: 3 linked CRE Klebsiella cases.
const outbreakKlebsiella1 = (() => {
  const collected = dayAgo(3);
  const i = iso(1, "KPNE", "Klebsiella pneumoniae", {
    id: "iso_out_kpn_1",
    growthQuantifierCode: "HEAVY",
    identifiedAt: collected,
  });
  return {
    ...base("MB25-OUT-KPN1", WorkflowStage.IPC, collected),
    priority: Priority.Stat,
    patient: {
      mrn: "AMCE-006101",
      givenName: "Maryam",
      familyName: "Bala",
      sex: Sex.Female,
      dob: "1966-03-14",
      ward: "ICU",
      attendingClinician: "Dr. Lawal",
    },
    specimen: {
      familyCode: "LRT",
      subtypeCode: "LRT_ETA",
      collectedAt: collected,
      receivedAt: collected,
      containerCode: "STERILE_TRAP",
      freeTextLabel: "Endotracheal aspirate - outbreak watch",
      details: { ventilatorStatus: "INVASIVE_VENT" },
    },
    ...emptyTail(),
    isolates: [i],
    ast: creKlebsiellaClusterAst(i.id),
    release: { state: ReleaseState.Draft, reportVersion: 0 },
  } as Accession;
})();

const outbreakKlebsiella2 = (() => {
  const collected = dayAgo(2);
  const i = iso(1, "KPNE", "Klebsiella pneumoniae", {
    id: "iso_out_kpn_2",
    growthQuantifierCode: "HEAVY",
    identifiedAt: collected,
  });
  return {
    ...base("MB25-OUT-KPN2", WorkflowStage.IPC, collected),
    priority: Priority.Stat,
    patient: {
      mrn: "AMCE-006102",
      givenName: "Godwin",
      familyName: "Okeke",
      sex: Sex.Male,
      dob: "1958-08-22",
      ward: "ICU",
      attendingClinician: "Dr. Eze",
    },
    specimen: {
      familyCode: "LRT",
      subtypeCode: "LRT_ETA",
      collectedAt: collected,
      receivedAt: collected,
      containerCode: "STERILE_TRAP",
      freeTextLabel: "Endotracheal aspirate - outbreak watch",
      details: { ventilatorStatus: "INVASIVE_VENT" },
    },
    ...emptyTail(),
    isolates: [i],
    ast: creKlebsiellaClusterAst(i.id),
    release: { state: ReleaseState.Draft, reportVersion: 0 },
  } as Accession;
})();

const outbreakKlebsiella3 = (() => {
  const collected = dayAgo(1);
  const i = iso(1, "KPNE", "Klebsiella pneumoniae", {
    id: "iso_out_kpn_3",
    growthQuantifierCode: "MODERATE",
    identifiedAt: collected,
  });
  return {
    ...base("MB25-OUT-KPN3", WorkflowStage.IPC, collected),
    priority: Priority.Urgent,
    patient: {
      mrn: "AMCE-006103",
      givenName: "Fatima",
      familyName: "Musa",
      sex: Sex.Female,
      dob: "1974-12-02",
      ward: "ICU",
      attendingClinician: "Dr. Omole",
    },
    specimen: {
      familyCode: "LRT",
      subtypeCode: "LRT_ETA",
      collectedAt: collected,
      receivedAt: collected,
      containerCode: "STERILE_TRAP",
      freeTextLabel: "Endotracheal aspirate - outbreak watch",
      details: { ventilatorStatus: "INVASIVE_VENT" },
    },
    ...emptyTail(),
    isolates: [i],
    ast: creKlebsiellaClusterAst(i.id),
    release: { state: ReleaseState.Draft, reportVersion: 0 },
  } as Accession;
})();

// 12. Reset-proof outbreak demonstration: 4 linked MRSA admission screens.
const outbreakMrsa1 = (() => {
  const collected = dayAgo(4);
  const i = iso(1, "SAUR", "Staphylococcus aureus (MRSA)", {
    id: "iso_out_mrsa_1",
    growthQuantifierCode: "LIGHT",
    identifiedAt: collected,
  });
  return {
    ...base("MB25-OUT-MRSA1", WorkflowStage.IPC, collected),
    priority: Priority.Routine,
    patient: {
      mrn: "AMCE-006201",
      givenName: "Ifeoma",
      familyName: "Nwankwo",
      sex: Sex.Female,
      dob: "1987-06-11",
      ward: "Surgical Admission Unit",
      attendingClinician: "Dr. Ajayi",
    },
    specimen: {
      familyCode: "COLONISATION",
      subtypeCode: "COL_MRSA_ADMISSION",
      collectedAt: collected,
      receivedAt: collected,
      containerCode: "SWAB_TRANSPORT",
      freeTextLabel: "MRSA admission screen - outbreak watch",
      details: { screenRound: "ADMISSION", screenSites: ["NARES", "GROIN", "AXILLA"] },
    },
    ...emptyTail(),
    isolates: [i],
    ast: mrsaClusterAst(i.id),
    release: { state: ReleaseState.Draft, reportVersion: 0 },
  } as Accession;
})();

const outbreakMrsa2 = (() => {
  const collected = dayAgo(3);
  const i = iso(1, "SAUR", "Staphylococcus aureus (MRSA)", {
    id: "iso_out_mrsa_2",
    growthQuantifierCode: "LIGHT",
    identifiedAt: collected,
  });
  return {
    ...base("MB25-OUT-MRSA2", WorkflowStage.IPC, collected),
    priority: Priority.Routine,
    patient: {
      mrn: "AMCE-006202",
      givenName: "Musa",
      familyName: "Garba",
      sex: Sex.Male,
      dob: "1970-01-20",
      ward: "Surgical Admission Unit",
      attendingClinician: "Dr. Ajayi",
    },
    specimen: {
      familyCode: "COLONISATION",
      subtypeCode: "COL_MRSA_ADMISSION",
      collectedAt: collected,
      receivedAt: collected,
      containerCode: "SWAB_TRANSPORT",
      freeTextLabel: "MRSA admission screen - outbreak watch",
      details: { screenRound: "ADMISSION", screenSites: ["NARES", "GROIN", "AXILLA"] },
    },
    ...emptyTail(),
    isolates: [i],
    ast: mrsaClusterAst(i.id),
    release: { state: ReleaseState.Draft, reportVersion: 0 },
  } as Accession;
})();

const outbreakMrsa3 = (() => {
  const collected = dayAgo(2);
  const i = iso(1, "SAUR", "Staphylococcus aureus (MRSA)", {
    id: "iso_out_mrsa_3",
    growthQuantifierCode: "LIGHT",
    identifiedAt: collected,
  });
  return {
    ...base("MB25-OUT-MRSA3", WorkflowStage.IPC, collected),
    priority: Priority.Routine,
    patient: {
      mrn: "AMCE-006203",
      givenName: "Helen",
      familyName: "Danjuma",
      sex: Sex.Female,
      dob: "1961-10-05",
      ward: "Surgical Admission Unit",
      attendingClinician: "Dr. Mensah",
    },
    specimen: {
      familyCode: "COLONISATION",
      subtypeCode: "COL_MRSA_ADMISSION",
      collectedAt: collected,
      receivedAt: collected,
      containerCode: "SWAB_TRANSPORT",
      freeTextLabel: "MRSA admission screen - outbreak watch",
      details: { screenRound: "ADMISSION", screenSites: ["NARES", "GROIN", "AXILLA"] },
    },
    ...emptyTail(),
    isolates: [i],
    ast: mrsaClusterAst(i.id),
    release: { state: ReleaseState.Draft, reportVersion: 0 },
  } as Accession;
})();

const outbreakMrsa4 = (() => {
  const collected = dayAgo(1);
  const i = iso(1, "SAUR", "Staphylococcus aureus (MRSA)", {
    id: "iso_out_mrsa_4",
    growthQuantifierCode: "LIGHT",
    identifiedAt: collected,
  });
  return {
    ...base("MB25-OUT-MRSA4", WorkflowStage.IPC, collected),
    priority: Priority.Routine,
    patient: {
      mrn: "AMCE-006204",
      givenName: "Samuel",
      familyName: "Etim",
      sex: Sex.Male,
      dob: "1954-04-30",
      ward: "Surgical Admission Unit",
      attendingClinician: "Dr. Bello",
    },
    specimen: {
      familyCode: "COLONISATION",
      subtypeCode: "COL_MRSA_ADMISSION",
      collectedAt: collected,
      receivedAt: collected,
      containerCode: "SWAB_TRANSPORT",
      freeTextLabel: "MRSA admission screen - outbreak watch",
      details: { screenRound: "ADMISSION", screenSites: ["NARES", "GROIN", "AXILLA"] },
    },
    ...emptyTail(),
    isolates: [i],
    ast: mrsaClusterAst(i.id),
    release: { state: ReleaseState.Draft, reportVersion: 0 },
  } as Accession;
})();

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
  outbreakKlebsiella1,
  outbreakKlebsiella2,
  outbreakKlebsiella3,
  outbreakMrsa1,
  outbreakMrsa2,
  outbreakMrsa3,
  outbreakMrsa4,
];
