import { describe, expect, it } from "vitest";
import type { Accession, ASTResult, Isolate, MeduguState } from "../../domain/types";
import { ASTMethod, Priority, ReleaseState, Sex, WorkflowStage } from "../../domain/enums";
import { computeLiveAntibiogram } from "../antibiogramEngine";

const now = "2026-05-01T10:00:00.000Z";

function accession(id: string, mrn: string, createdAt: string, isolate: Isolate, ast: ASTResult[]): Accession {
  return {
    id,
    accessionNumber: id,
    createdAt,
    updatedAt: createdAt,
    workflowStatus: WorkflowStage.AST,
    stage: WorkflowStage.AST,
    priority: Priority.Routine,
    ruleVersion: "test",
    breakpointVersion: "test",
    exportVersion: "test",
    buildVersion: "test",
    patient: { mrn, givenName: "A", familyName: "Patient", sex: Sex.Unknown },
    specimen: { familyCode: "URINE", subtypeCode: "URINE_MIDSTREAM", collectedAt: createdAt },
    specimenAssessments: [],
    microscopy: [],
    isolates: [isolate],
    ast,
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
  };
}

function ast(id: string, isolateId: string, antibioticCode: string, sir: "S" | "I" | "R"): ASTResult {
  return {
    id,
    isolateId,
    antibioticCode,
    method: ASTMethod.DiskDiffusion,
    standard: "EUCAST",
    rawValue: sir === "R" ? 6 : 24,
    rawUnit: "mm",
    rawInterpretation: sir,
    interpretedSIR: sir,
    finalInterpretation: sir,
    governance: "interpreted",
    cascade: "primary",
  };
}

function state(accessions: Accession[]): MeduguState {
  return {
    schemaVersion: 1,
    accessions: Object.fromEntries(accessions.map((item) => [item.id, item])),
    accessionOrder: accessions.map((item) => item.id),
    activeAccessionId: accessions[0]?.id ?? null,
    ruleVersion: { ruleSetId: "test", version: "test", effectiveFrom: "2026-01-01" },
    breakpointVersion: "test",
    exportVersion: "test",
    buildVersion: "test",
  };
}

describe("live antibiogram engine", () => {
  it("uses first patient-organism-drug isolate before calculating susceptible percentage", () => {
    const firstIso = isolate("iso_1", "ECOL", "Escherichia coli");
    const repeatIso = isolate("iso_2", "ECOL", "Escherichia coli");
    const secondPatientIso = isolate("iso_3", "ECOL", "Escherichia coli");

    const result = computeLiveAntibiogram(
      state([
        accession("ACC-1", "MRN-1", "2026-04-01T10:00:00.000Z", firstIso, [
          ast("ast_1", firstIso.id, "CIP", "S"),
        ]),
        accession("ACC-2", "MRN-1", "2026-04-02T10:00:00.000Z", repeatIso, [
          ast("ast_2", repeatIso.id, "CIP", "R"),
        ]),
        accession("ACC-3", "MRN-2", "2026-04-03T10:00:00.000Z", secondPatientIso, [
          ast("ast_3", secondPatientIso.id, "CIP", "R"),
        ]),
      ]),
      { minCount: 30 },
      new Date(now),
    );

    const ecol = result.organismRows.find((row) => row.organismCode === "ECOL");
    expect(ecol?.patientCount).toBe(2);
    expect(ecol?.cells.CIP.total).toBe(2);
    expect(ecol?.cells.CIP.susceptible).toBe(1);
    expect(ecol?.cells.CIP.susceptiblePercent).toBe(50);
    expect(ecol?.cells.CIP.lowCount).toBe(true);
  });

  it("filters by specimen family and organism group", () => {
    const ecol = isolate("iso_ecol", "ECOL", "Escherichia coli");
    const saur = isolate("iso_saur", "SAUR", "Staphylococcus aureus");
    const urine = accession("ACC-U", "MRN-U", "2026-04-01T10:00:00.000Z", ecol, [
      ast("ast_u", ecol.id, "CIP", "S"),
    ]);
    const blood = accession("ACC-B", "MRN-B", "2026-04-02T10:00:00.000Z", saur, [
      ast("ast_b", saur.id, "FOX", "R"),
    ]);
    blood.specimen = { familyCode: "BLOOD", subtypeCode: "BC_PERIPHERAL", collectedAt: blood.createdAt };

    const result = computeLiveAntibiogram(
      state([urine, blood]),
      { specimenFamily: "URINE", organismGroup: "enterobacterales", minCount: 1 },
      new Date(now),
    );

    expect(result.organismRows.map((row) => row.organismCode)).toEqual(["ECOL"]);
    expect(result.lowCountCellCount).toBe(0);
  });
});
