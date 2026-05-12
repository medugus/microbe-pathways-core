// Plain assert-style round-trip test for the Zone Reader contract — matches
// the convention used by other src/medugu/logic/__tests__ files.

import { strict as assert } from "node:assert";
import { buildWorklistExport } from "../exportWorklist";
import { mapImport } from "../importMapper";
import { ZONE_READER_CONTRACT_VERSION } from "../types";
import type { Accession } from "../../../domain/types";
import { ASTMethod } from "../../../domain/enums";

function makeAccession(): Accession {
  return {
    id: "acc-1",
    accessionNumber: "ACC-2026-0001",
    isolates: [
      { id: "iso-1", isolateNo: 1, organismDisplay: "Escherichia coli" },
    ],
    ast: [
      {
        id: "ast-1",
        isolateId: "iso-1",
        antibioticCode: "AMP",
        method: ASTMethod.DiskDiffusion,
        standard: "EUCAST",
        rawValue: undefined,
        governance: {},
        cascade: {},
      },
    ],
  } as unknown as Accession;
}

export function runZoneReaderRoundTripTests() {
  const accession = makeAccession();

  const w = buildWorklistExport({
    accession,
    isolateId: "iso-1",
    astPanelId: "enterobacterales",
    now: new Date("2026-05-12T10:00:00Z"),
  });
  assert.equal(w.contractVersion, ZONE_READER_CONTRACT_VERSION);
  assert.equal(w.accessionId, "acc-1");
  assert.equal(w.isolateId, "iso-1");
  assert.equal(w.astPanelId, "enterobacterales");
  assert.ok(w.expectedDiscs.length > 0);

  const ok = mapImport({
    accession,
    worklist: w,
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
  assert.equal(ok.ok, true);
  assert.equal(ok.matched.length, 1);
  assert.equal(ok.matched[0].astRowId, "ast-1");
  assert.equal(ok.matched[0].zoneMm, 18);

  const blocked = mapImport({
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
  assert.equal(blocked.ok, false);
  assert.ok(blocked.findings.some((f) => f.code === "ACCESSION_MISMATCH"));
}
