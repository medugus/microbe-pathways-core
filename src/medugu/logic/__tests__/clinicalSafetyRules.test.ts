import { describe, expect, it } from "vitest";
import type { IPCSignal } from "../../domain/types";
import { DEMO_ACCESSIONS } from "../../seed/demoAccessions";
import { IPCFlag } from "../../domain/enums";
import { evaluateIsolate } from "../astEngine";
import { deriveIPCReleaseContext } from "../ipcReportGovernance";
import { buildPathologistCommentSuggestion } from "../pathologistComments";
import { buildReportPreview } from "../reportPreview";
import {
  getColonisationScreenPathway,
  isAllowedColonisationScreenOrganism,
  resolveSpecimen,
} from "../specimenResolver";
import { runValidation } from "../validationEngine";

function accession(accessionNumber: string) {
  const found = DEMO_ACCESSIONS.find((item) => item.accessionNumber === accessionNumber);
  if (!found) throw new Error(`Missing demo accession ${accessionNumber}`);
  return found;
}

describe("clinical safety rules", () => {
  it("keeps MRSA admission screens on the restricted screen pathway", () => {
    const pathway = getColonisationScreenPathway("COLONISATION", "COL_MRSA_ADMISSION");
    const resolved = resolveSpecimen("COLONISATION", "COL_MRSA_ADMISSION");
    const screen = accession("MB25-COL001");

    expect(pathway).not.toBeNull();
    expect(pathway?.organismCodes).toEqual(["SAUR", "NOGRO"]);
    expect(pathway?.requiredAstAntibioticCodes).toEqual(["FOX", "OXA"]);
    expect(isAllowedColonisationScreenOrganism("COLONISATION", "COL_MRSA_ADMISSION", "SAUR")).toBe(
      true,
    );
    expect(isAllowedColonisationScreenOrganism("COLONISATION", "COL_MRSA_ADMISSION", "ECOL")).toBe(
      false,
    );
    expect(resolved.ok && resolved.profile.gating.pathway).toBe("screen");
    expect(resolved.ok && resolved.profile.reportSections).toEqual(["screenResult"]);
    expect(screen.specimen.details?.screenSites).toEqual(["NARES", "GROIN", "AXILLA"]);
  });

  it("keeps CPE/CPO screens restricted to Enterobacterales targets", () => {
    const pathway = getColonisationScreenPathway("COLONISATION", "COL_CPE_RECTAL");

    expect(pathway?.positiveOrganismCodes).toEqual(["ECOL", "KPNE", "PMIR", "ENTC"]);
    expect(pathway?.allowedAstPanelIds).toEqual(["cpe_screen"]);
    expect(isAllowedColonisationScreenOrganism("COLONISATION", "COL_CPE_RECTAL", "KPNE")).toBe(
      true,
    );
    expect(isAllowedColonisationScreenOrganism("COLONISATION", "COL_CPE_RECTAL", "SAUR")).toBe(
      false,
    );
  });

  it("flags MRSA and inducible clindamycin resistance from the admission-screen fixture", () => {
    const screen = accession("MB25-COL001");
    const isolate = screen.isolates[0];
    if (!isolate) throw new Error("MRSA screen fixture has no isolate");

    const result = evaluateIsolate(screen, isolate);
    const clindamycin = screen.ast.find((row) => row.antibioticCode === "CLI");

    expect(result.phenotypeFlags).toEqual(
      expect.arrayContaining(["MRSA", "inducible_clindamycin_R"]),
    );
    expect(clindamycin).toBeDefined();
    expect(result.rowPatches[clindamycin!.id]).toMatchObject({
      interpretedSIR: "R",
      finalInterpretation: "R",
      cascadeDecision: "suppressed_by_phenotype",
    });
  });

  it("flags VRE from a colonisation-screen fixture", () => {
    const screen = accession("MB25-COL002");
    const isolate = screen.isolates[0];
    if (!isolate) throw new Error("VRE screen fixture has no isolate");

    const result = evaluateIsolate(screen, isolate);

    expect(result.phenotypeFlags).toContain("VRE");
    expect(result.fired.map((rule) => rule.ruleCode)).toContain("ENT_VRE");
  });

  it("flags CRE and carbapenemase suspicion from the sterile-site fixture", () => {
    const caseRecord = accession("MB25-CRE001");
    const isolate = caseRecord.isolates[0];
    if (!isolate) throw new Error("CRE fixture has no isolate");

    const result = evaluateIsolate(caseRecord, isolate);

    expect(result.phenotypeFlags).toEqual(
      expect.arrayContaining(["CRE", "carbapenemase_suspected"]),
    );
    expect(result.fired.map((rule) => rule.ruleCode)).toContain("ENB_CRE");
  });

  it("projects blood-culture positive-bottle workup without ordinary microscopy", () => {
    const blood = accession("MB25-EF34GH");
    const doc = buildReportPreview(blood);
    const aerobic = doc.bloodBottles?.find(
      (bottle) => bottle.setNo === 1 && bottle.bottleType === "AEROBIC",
    );

    expect(blood.specimen.familyCode).toBe("BLOOD");
    expect(blood.microscopy).toEqual([]);
    expect(aerobic).toMatchObject({
      growth: "growth",
      gramStain: { result: "GPC_CLUSTERS" },
      maldiTof: { performed: true, organismDisplay: "Staphylococcus aureus" },
      directAst: { performed: true, method: "EUCAST_RAST", standard: "EUCAST" },
    });
  });

  it("does not treat archived IPC notifications as open release clutter", () => {
    const signal: IPCSignal = {
      id: "ipc_test_archived",
      flag: IPCFlag.MDRO,
      organismCode: "SAUR",
      ruleCode: "MRSA_ALERT",
      message: "MRSA signal",
      raisedAt: "2026-04-25T12:00:00.000Z",
      archivedAt: "2026-04-25T12:05:00.000Z",
      notifiedAt: "2026-04-25T12:05:00.000Z",
      notificationMethod: "email",
    };

    const blood = accession("MB25-EF34GH");
    const archived = { ...blood, ipc: [signal] };
    const open = { ...blood, ipc: [{ ...signal, archivedAt: undefined, notifiedAt: undefined }] };

    expect(deriveIPCReleaseContext(archived)).toBeNull();
    expect(deriveIPCReleaseContext(open)?.signalCount).toBe(1);
  });

  it("resolves genital specimens as a governed genital/STI pathway", () => {
    const hvs = resolveSpecimen("GENITAL", "GEN_HVS");
    const urethral = resolveSpecimen("GENITAL", "GEN_URETHRAL");

    expect(hvs.ok && hvs.profile.workbenchPanels).toContain("genital_panel");
    expect(hvs.ok && hvs.profile.microscopy.required).toContain("wetMount");
    expect(hvs.ok && hvs.profile.reportSections).toEqual(["microscopy", "culture"]);

    expect(urethral.ok && urethral.profile.workbenchPanels).toEqual(["genital_panel", "sti_panel"]);
    expect(urethral.ok && urethral.profile.syndrome).toBe("sti_syndrome");
    expect(urethral.ok && urethral.profile.reportSections).toContain("ast");
  });

  it("generates pathologist comments from AST resistance patterns", () => {
    const cre = accession("MB25-CRE001");
    const comment = buildPathologistCommentSuggestion(cre);

    expect(comment.scenarioCodes).toEqual(expect.arrayContaining(["CRO_ENTEROBACTERALES"]));
    expect(comment.text).toContain("Carbapenem-resistant Enterobacterales");
  });

  it("requires scientist verification and pathologist authorization before release", () => {
    const caseRecord = accession("MB25-CRE001");
    const blockedCodes = runValidation(caseRecord).blockers.map((issue) => issue.code);

    expect(blockedCodes).toEqual(
      expect.arrayContaining([
        "MLS_SIGNOFF_REQUIRED",
        "PATHOLOGIST_COMMENT_REQUIRED",
        "PATHOLOGIST_AUTHORIZATION_REQUIRED",
      ]),
    );

    const signed = {
      ...caseRecord,
      release: {
        ...caseRecord.release,
        medicalLabScientistSignOff: {
          role: "medical_lab_scientist" as const,
          signedBy: "MLS Demo",
          signedAt: "2026-06-22T00:00:00.000Z",
        },
        pathologistComment: {
          text: "Reviewed and authorised.",
          generatedText: "Reviewed and authorised.",
          scenarioCodes: ["TEST"],
          generatedAt: "2026-06-22T00:00:00.000Z",
          updatedAt: "2026-06-22T00:00:00.000Z",
          updatedBy: "test",
          edited: false,
        },
        pathologistAuthorization: {
          role: "pathologist" as const,
          signedBy: "Pathologist Demo",
          signedAt: "2026-06-22T00:01:00.000Z",
        },
      },
    };
    const signedCodes = runValidation(signed).blockers.map((issue) => issue.code);

    expect(signedCodes).not.toContain("MLS_SIGNOFF_REQUIRED");
    expect(signedCodes).not.toContain("PATHOLOGIST_COMMENT_REQUIRED");
    expect(signedCodes).not.toContain("PATHOLOGIST_AUTHORIZATION_REQUIRED");
  });
});
