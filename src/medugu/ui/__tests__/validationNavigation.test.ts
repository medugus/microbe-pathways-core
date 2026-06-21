import { describe, expect, it } from "vitest";
import { targetForValidationIssue } from "../validationNavigation";

describe("validation navigation", () => {
  it("routes blood bottle workup blockers to the bottle workup anchor", () => {
    expect(
      targetForValidationIssue({
        code: "BC_ISO_1_SOURCE_MISSING",
        section: "isolate",
      }),
    ).toEqual({
      sectionId: "sec-isolate",
      anchorId: "blood-culture-bottle-workup",
      label: "Blood bottle workup",
    });

    expect(
      targetForValidationIssue({
        code: "BC_BOTTLE_GRAM_MISSING_1_AEROBIC",
        section: "isolate",
      }).anchorId,
    ).toBe("blood-culture-bottle-workup");
  });

  it("routes IPC and blood set blockers to their resolving sections", () => {
    expect(
      targetForValidationIssue({
        code: "IPC_HIGH_PRIORITY_CRE_ALERT",
        section: "release",
      }).sectionId,
    ).toBe("sec-ipc");

    expect(
      targetForValidationIssue({
        code: "BC_SET_1_DRAWSITE_MISSING",
        section: "specimen",
      }).sectionId,
    ).toBe("sec-specimen");
  });
});
