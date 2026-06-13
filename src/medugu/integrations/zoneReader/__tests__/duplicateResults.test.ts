import { describe, expect, it } from "vitest";
import { groupDuplicateZoneResults } from "../importMapper";
import type { ZoneResult } from "../types";

function result(antibioticCode: string, zoneDiameterMm: number): ZoneResult {
  return {
    antibioticCode,
    zoneDiameterMm,
    measurementSource: "manual_entry",
  };
}

describe("duplicate Zone Reader results", () => {
  it("preserves every supplied value for explicit review", () => {
    const grouped = groupDuplicateZoneResults([
      result("AMP", 18),
      result("CIP", 24),
      result("AMP", 21),
    ]);

    expect(grouped).toEqual([
      {
        antibioticCode: "AMP",
        candidates: [result("AMP", 18), result("AMP", 21)],
      },
      {
        antibioticCode: "CIP",
        candidates: [result("CIP", 24)],
      },
    ]);
  });

  it("keeps unique antibiotic rows as single-candidate groups", () => {
    const grouped = groupDuplicateZoneResults([
      result("AMP", 18),
      result("CIP", 24),
    ]);

    expect(grouped).toHaveLength(2);
    expect(grouped.every((group) => group.candidates.length === 1)).toBe(true);
  });
});
