import type { Accession, AMSApprovalRequest, ASTResult, Isolate, MeduguState } from "../domain/types";
import { ASTMethod, Priority, ReleaseState, Sex, WorkflowStage } from "../domain/enums";

function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function astRow(
  isolateId: string,
  antibioticCode: string,
  interpretation: "S" | "I" | "R",
  governance: ASTResult["governance"] = "interpreted",
  method: ASTMethod = ASTMethod.DiskDiffusion,
): ASTResult {
  return {
    id: `ast_${isolateId}_${antibioticCode}`,
    isolateId,
    antibioticCode,
    method,
    standard: "CLSI",
    rawValue: interpretation === "S" ? 22 : interpretation === "I" ? 16 : 8,
    rawUnit: method === ASTMethod.MIC_Broth ? "mg/L" : "mm",
    rawInterpretation: interpretation,
    interpretedSIR: interpretation,
    finalInterpretation: interpretation,
    governance,
    cascade: "primary",
  };
}

function isolateRow(id: string, organismCode: string, organismDisplay: string): Isolate {
  return {
    id,
    isolateNo: 1,
    organismCode,
    organismDisplay,
    significance: "significant",
    identifiedAt: "2026-04-25T10:00:00.000Z",
  };
}

function approval(
  id: string,
  astId: string,
  isolateId: string,
  antibioticCode: string,
  status: AMSApprovalRequest["status"],
): AMSApprovalRequest {
  return {
    id,
    astId,
    isolateId,
    antibioticCode,
    status,
    dueBy: "2026-04-26T10:00:00.000Z",
    requested: {
      at: "2026-04-25T10:05:00.000Z",
      actor: "AMS pharmacist",
      note: "Acceptance fixture",
    },
  };
}

function baseAccession(id: string, mrn: string): Accession {
  return {
    id,
    accessionNumber: id,
    createdAt: "2026-04-25T10:00:00.000Z",
    updatedAt: "2026-04-25T10:00:00.000Z",
    workflowStatus: WorkflowStage.AST,
    stage: WorkflowStage.AST,
    priority: Priority.Routine,
    patient: {
      mrn,
      givenName: "AMS",
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
    amsApprovals: [],
    ruleVersion: "1.0.0",
    breakpointVersion: "EUCAST-2026.1",
    exportVersion: "1.0.0",
    buildVersion: "dev",
  };
}

export const restrictedMeropenemPendingApprovalCase: Accession = (() => {
  const accession = baseAccession("AMS-ACC-001", "AMS-MRN-001");
  const iso = isolateRow("iso_ams_1", "KPNE", "Klebsiella pneumoniae");
  const mem = astRow(iso.id, "MEM", "S", "interpreted", ASTMethod.MIC_Broth);
  accession.isolates = [iso];
  accession.ast = [mem];
  accession.amsApprovals = [approval("ams_req_1", mem.id, iso.id, "MEM", "pending")];
  return accession;
})();

export const ceftriaxoneResistantUnderReviewCase: Accession = (() => {
  const accession = baseAccession("AMS-ACC-002", "AMS-MRN-002");
  const iso = isolateRow("iso_ams_2", "ECOL", "Enterobacterales");
  const cro = astRow(iso.id, "CRO", "R");
  accession.isolates = [iso];
  accession.ast = [cro];
  accession.amsApprovals = [approval("ams_req_2", cro.id, iso.id, "CRO", "pending")];
  return accession;
})();

export const deEscalationOpportunityCase: Accession = (() => {
  const accession = baseAccession("AMS-ACC-003", "AMS-MRN-003");
  const iso = isolateRow("iso_ams_3", "ECOL", "Enterobacterales");
  const mem = astRow(iso.id, "MEM", "S", "interpreted", ASTMethod.MIC_Broth);
  const cxm = astRow(iso.id, "CXM", "S");
  accession.isolates = [iso];
  accession.ast = [mem, cxm];
  accession.amsApprovals = [approval("ams_req_3", mem.id, iso.id, "MEM", "pending")];
  return accession;
})();

export const noTherapyUnderReviewCase: Accession = (() => {
  const accession = baseAccession("AMS-ACC-004", "AMS-MRN-004");
  const iso = isolateRow("iso_ams_4", "KPNE", "Klebsiella pneumoniae");
  const mem = astRow(iso.id, "MEM", "S", "interpreted", ASTMethod.MIC_Broth);
  accession.isolates = [iso];
  accession.ast = [mem];
  accession.amsApprovals = [];
  return accession;
})();

export const accessAntibioticActiveUnrestrictedCase: Accession = (() => {
  const accession = baseAccession("AMS-ACC-005", "AMS-MRN-005");
  const iso = isolateRow("iso_ams_5", "ECOL", "Escherichia coli");
  const gen = astRow(iso.id, "GEN", "S");
  accession.isolates = [iso];
  accession.ast = [gen];
  accession.amsApprovals = [approval("ams_req_5", gen.id, iso.id, "GEN", "pending")];
  return accession;
})();

export const csfHighRiskSyndromeCase: Accession = (() => {
  const accession = baseAccession("AMS-ACC-006", "AMS-MRN-006");
  accession.specimen = {
    familyCode: "STERILE_FLUID",
    subtypeCode: "SF_CSF",
    collectedAt: "2026-04-25T08:00:00.000Z",
    receivedAt: "2026-04-25T09:00:00.000Z",
    freeTextLabel: "CSF",
  };
  accession.patient.ward = "ICU";
  const iso = isolateRow("iso_ams_6", "KPNE", "Klebsiella pneumoniae");
  const mem = astRow(iso.id, "MEM", "S", "interpreted", ASTMethod.MIC_Broth);
  const cxm = astRow(iso.id, "CXM", "S");
  accession.isolates = [iso];
  accession.ast = [mem, cxm];
  accession.amsApprovals = [approval("ams_req_6", mem.id, iso.id, "MEM", "pending")];
  return accession;
})();

export const restrictedReserveApprovedCase: Accession = (() => {
  const accession = baseAccession("AMS-ACC-007", "AMS-MRN-007");
  accession.patient.ward = "High Dependency";
  const iso = isolateRow("iso_ams_7", "KPNE", "Klebsiella pneumoniae");
  const cst = astRow(iso.id, "CST", "S", "approved", ASTMethod.MIC_Broth);
  accession.isolates = [iso];
  accession.ast = [cst];
  accession.amsApprovals = [approval("ams_req_7", cst.id, iso.id, "CST", "approved")];
  accession.amsApprovals[0].decided = {
    at: "2026-04-25T11:00:00.000Z",
    actor: "AMS pharmacist",
    note: "Approved for current context",
  };
  return accession;
})();

export const noAmsActionCase: Accession = (() => {
  const accession = baseAccession("AMS-ACC-008", "AMS-MRN-008");
  accession.specimen = {
    familyCode: "URINE",
    subtypeCode: "URINE_MIDSTREAM",
    collectedAt: "2026-04-25T08:00:00.000Z",
    receivedAt: "2026-04-25T09:00:00.000Z",
    freeTextLabel: "Urine culture",
  };
  accession.isolates = [
    {
      ...isolateRow("iso_ams_8", "NOGRO", "No growth"),
      significance: "normal_flora",
    },
  ];
  accession.ast = [];
  accession.amsApprovals = [];
  return accession;
})();

export const amsAcceptanceScenarioCases = {
  restrictedMeropenemPendingApprovalCase,
  ceftriaxoneResistantUnderReviewCase,
  deEscalationOpportunityCase,
  noTherapyUnderReviewCase,
  accessAntibioticActiveUnrestrictedCase,
  csfHighRiskSyndromeCase,
  restrictedReserveApprovedCase,
  noAmsActionCase,
};

export function toAccessionsMap(accessions: Accession[]): MeduguState["accessions"] {
  return Object.fromEntries(accessions.map((accession) => [accession.id, deepClone(accession)]));
}
