import { describe, expect, it } from "vitest";
import type { Accession, ASTResult, Isolate } from "../../domain/types";
import { ASTMethod, Priority, ReleaseState, Sex, WorkflowStage } from "../../domain/enums";
import { evaluateIPC } from "../ipcEngine";
import { runValidation } from "../validationEngine";

const now = "2026-04-25T10:00:00.000Z";

function baseAccession(id: string): Accession {
  return {
    id,
    accessionNumber: id,
    createdAt: now,
    updatedAt: now,
    workflowStatus: WorkflowStage.Validation,
    stage: WorkflowStage.Validation,
    priority: Priority.Urgent,
    ruleVersion: "test",
    breakpointVersion: "test",
    exportVersion: "test",
    buildVersion: "test",
    patient: {
      mrn: `MRN-${id}`,
      givenName: "DEF",
      familyName: "Safety",
      sex: Sex.Unknown,
      ward: "Medical Ward",
      attendingClinician: "Dr Safety",
    },
    specimen: {
      familyCode: "STERILE_FLUID",
      subtypeCode: "SF_PLEURAL",
      collectedAt: "2026-04-25T08:00:00.000Z",
      receivedAt: "2026-04-25T09:00:00.000Z",
      freeTextLabel: "Pleural fluid",
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
    release: { state: ReleaseState.Draft, reportVersion: 0 },
    audit: [],
  };
}

function isolate(id: string, organismCode: string, organismDisplay: string): Isolate {
  return {
    id,
    isolateNo: 1,
    organismCode,
    organismDisplay,
    significance: "significant",
    identifiedAt: now,
  };
}

function ast(
  isolateId: string,
  antibioticCode: string,
  finalInterpretation: "S" | "I" | "R",
  method: ASTMethod = ASTMethod.DiskDiffusion,
): ASTResult {
  return {
    id: `${isolateId}_${antibioticCode}`,
    isolateId,
    antibioticCode,
    method,
    standard: "CLSI",
    rawValue: finalInterpretation === "R" ? 6 : 24,
    rawUnit: method === ASTMethod.MIC_Broth ? "mg/L" : "mm",
    rawInterpretation: finalInterpretation,
    interpretedSIR: finalInterpretation,
    finalInterpretation,
    governance: "interpreted",
    cascade: "primary",
  };
}

function accessionFor(
  id: string,
  organismCode: string,
  organismDisplay: string,
  rows: ASTResult[],
): Accession {
  const accession = baseAccession(id);
  const iso = isolate(`${id}_iso_1`, organismCode, organismDisplay);
  accession.isolates = [iso];
  accession.ast = rows.map((row) => ({ ...row, isolateId: iso.id, id: `${id}_${row.antibioticCode}` }));
  return accession;
}

function withAcknowledgedPhoneOut(accession: Accession): Accession {
  return {
    ...accession,
    phoneOuts: [
      {
        id: `${accession.id}_phoneout`,
        at: now,
        calledBy: "regression",
        recipient: "Dr Safety",
        reasonCode: "critical_value",
        message: "Sterile-site IPC critical alert acknowledged.",
        acknowledged: true,
        acknowledgedAt: now,
      },
    ],
  };
}

const cases = [
  {
    id: "DEF001-MRSA",
    expectedRuleCode: "MRSA_ALERT",
    accession: accessionFor("DEF001-MRSA", "SAUR", "Staphylococcus aureus", [ast("placeholder", "FOX", "R")]),
  },
  {
    id: "DEF001-VRE",
    expectedRuleCode: "VRE_ALERT",
    accession: accessionFor("DEF001-VRE", "EFAM", "Enterococcus faecium", [
      ast("placeholder", "VAN", "R", ASTMethod.MIC_Broth),
    ]),
  },
  {
    id: "DEF001-CRE",
    expectedRuleCode: "CRE_ALERT",
    accession: accessionFor("DEF001-CRE", "KPNE", "Klebsiella pneumoniae", [
      ast("placeholder", "MEM", "R", ASTMethod.MIC_Broth),
    ]),
  },
  {
    id: "DEF001-CRAB",
    expectedRuleCode: "CRAB_ALERT",
    accession: accessionFor("DEF001-CRAB", "ABAU", "Acinetobacter baumannii complex", [
      ast("placeholder", "MEM", "R", ASTMethod.MIC_Broth),
    ]),
  },
  {
    id: "DEF001-CRPA",
    expectedRuleCode: "CRPA_ALERT",
    accession: accessionFor("DEF001-CRPA", "PAER", "Pseudomonas aeruginosa", [
      ast("placeholder", "MEM", "R", ASTMethod.MIC_Broth),
    ]),
  },
  {
    id: "DEF001-CAURIS",
    expectedRuleCode: "CAURIS_ALERT",
    accession: accessionFor("DEF001-CAURIS", "CAUR", "Candida auris", []),
  },
];

describe("DEF-001 sterile-site IPC phone-out blocker", () => {
  it.each(cases)("$id blocks release until phone-out acknowledgement", ({ accession, expectedRuleCode }) => {
    const ipc = evaluateIPC(accession);
    expect(ipc.decisions.map((decision) => decision.ruleCode)).toContain(expectedRuleCode);

    const blocked = runValidation(accession);
    expect(blocked.releaseAllowed).toBe(false);
    expect(blocked.blockers.map((blocker) => blocker.code)).toContain("PHONE_OUT_REQUIRED");

    const acknowledged = runValidation(withAcknowledgedPhoneOut(accession));
    expect(acknowledged.blockers.map((blocker) => blocker.code)).not.toContain("PHONE_OUT_REQUIRED");
  });
});
