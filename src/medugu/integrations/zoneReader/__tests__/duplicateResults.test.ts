import { describe, expect, it } from "vitest";
import { collapseDuplicateZoneResults } from "../importMapper";
import type { ZoneResult } from "../types";

function result(antibioticCode: string, zoneDiameterMm: number): ZoneResult {
  return {
    antibioticCode,
    zoneDiameterMm,
    measurementSource: "manual_entry",
  };
}

describe("duplicate Zone Reader results", () => {
  it("retains one row per antibiotic using the last supplied value", () => {
    const collapsed = collapseDuplicateZoneResults([
      result("AMP", 18),
      result("CIP", 24),
      result("AMP", 21),
    ]);

    expect(collapsed.results).toEqual([
      result("AMP", 21),
      result("CIP", 24),
    ]);
    expect(collapsed.duplicateCodes).toEqual(new Set(["AMP"]));
  });

  it("does not flag unique antibiotic rows", () => {
    const collapsed = collapseDuplicateZoneResults([
      result("AMP", 18),
      result("CIP", 24),
    ]);

    expect(collapsed.results).toHaveLength(2);
    expect(collapsed.duplicateCodes.size).toBe(0);
  });
});
