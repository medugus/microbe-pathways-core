import { describe, it, expect } from "vitest";
import { buildWorklistExport } from "../exportWorklist";
import { mapImport } from "../importMapper";
import { ZONE_READER_CONTRACT_VERSION } from "../types";
import type { Accession } from "../../../domain/types";
import { ASTMethod, ASTStandard } from "../../../domain/enums";

function makeAccession(): Accession {
  // Minimal stub — only the fields the Zone Reader integration reads.
  // Cast through unknown so the test does not depend on every Accession field.
  const a = {
    id: "acc-1",
    accessionNumber: "ACC-2026-0001",
    isolates: [
      {
        id: "iso-1",
        isolateNo: 1,
        organismDisplay: "Escherichia coli",
      },
    ],
    ast: [
      {
        id: "ast-1",
        isolateId: "iso-1",
        antibioticCode: "AMP",
        method: ASTMethod.DiskDiffusion,
        standard: ASTStandard.EUCAST,
        rawValue: undefined,
        governance: {},
        cascade: {},
      },
    ],
  } as unknown as Accession;
  return a;
}

describe("Zone Reader contract round-trip", () => {
  it("builds an export envelope with the expected key", () => {
    const accession = makeAccession();
    const w = buildWorklistExport({
      accession,
      isolateId: "iso-1",
      astPanelId: "enterobacterales",
      now: new Date("2026-05-12T10:00:00Z"),
    });
    expect(w.contractVersion).toBe(ZONE_READER_CONTRACT_VERSION);
    expect(w.accessionId).toBe("acc-1");
    expect(w.isolateId).toBe("iso-1");
    expect(w.astPanelId).toBe("enterobacterales");
    expect(w.expectedDiscs.length).toBeGreaterThan(0);
  });

  it("maps a matching import payload onto an existing AST row", () => {
    const accession = makeAccession();
    const worklist = buildWorklistExport({
      accession,
      isolateId: "iso-1",
      astPanelId: "enterobacterales",
    });
    const result = mapImport({
      accession,
      worklist,
      payload: {
        contractVersion: ZONE_READER_CONTRACT_VERSION,
        sourceSystem: "ACME_ZR_1",
        measuredAt: new Date().toISOString(),
        accessionId: "acc-1",
        isolateId: "iso-1",
        astPanelId: "enterobacterales",
        method: "disk_diffusion",
        results: [{ antibioticCode: "AMP", zoneMm: 18 }],
      },
    });
    expect(result.ok).toBe(true);
    expect(result.matched).toHaveLength(1);
    expect(result.matched[0].astRowId).toBe("ast-1");
    expect(result.matched[0].zoneMm).toBe(18);
  });

  it("blocks an accession-id mismatch", () => {
    const accession = makeAccession();
    const result = mapImport({
      accession,
      payload: {
        contractVersion: ZONE_READER_CONTRACT_VERSION,
        sourceSystem: "ACME_ZR_1",
        measuredAt: new Date().toISOString(),
        accessionId: "WRONG",
        isolateId: "iso-1",
        astPanelId: "enterobacterales",
        method: "disk_diffusion",
        results: [{ antibioticCode: "AMP", zoneMm: 18 }],
      },
    });
    expect(result.ok).toBe(false);
    expect(result.findings.some((f) => f.code === "ACCESSION_MISMATCH")).toBe(true);
  });
});
