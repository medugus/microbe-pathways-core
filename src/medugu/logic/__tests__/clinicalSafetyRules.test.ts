import { describe, expect, it } from "vitest";
import { DEMO_ACCESSIONS } from "../../seed/demoAccessions";
import { evaluateIsolate } from "../astEngine";
import {
  getColonisationScreenPathway,
  isAllowedColonisationScreenOrganism,
  resolveSpecimen,
} from "../specimenResolver";

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
    expect(isAllowedColonisationScreenOrganism("COLONISATION", "COL_MRSA_ADMISSION", "SAUR")).toBe(true);
    expect(isAllowedColonisationScreenOrganism("COLONISATION", "COL_MRSA_ADMISSION", "ECOL")).toBe(false);
    expect(resolved.ok && resolved.profile.gating.pathway).toBe("screen");
    expect(resolved.ok && resolved.profile.reportSections).toEqual(["screenResult"]);
    expect(screen.specimen.details?.screenSites).toEqual(["NARES", "GROIN", "AXILLA"]);
  });

  it("keeps CPE/CPO screens restricted to Enterobacterales targets", () => {
    const pathway = getColonisationScreenPathway("COLONISATION", "COL_CPE_RECTAL");

    expect(pathway?.positiveOrganismCodes).toEqual(["ECOL", "KPNE", "PMIR", "ENTC"]);
    expect(pathway?.allowedAstPanelIds).toEqual(["cpe_screen"]);
    expect(isAllowedColonisationScreenOrganism("COLONISATION", "COL_CPE_RECTAL", "KPNE")).toBe(true);
    expect(isAllowedColonisationScreenOrganism("COLONISATION", "COL_CPE_RECTAL", "SAUR")).toBe(false);
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
});
