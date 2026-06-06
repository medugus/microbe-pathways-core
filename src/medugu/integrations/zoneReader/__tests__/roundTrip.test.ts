// Round-trip + alias coverage tests for the Zone Reader contract.
// Plain assert-style to match other src/medugu/logic/__tests__ files.

import { strict as assert } from "node:assert";
import { buildWorklistExport } from "../exportWorklist";
import { mapImport } from "../importMapper";
import {
  zoneReaderResultImportSchema,
  zoneReaderWorklistExportSchema,
} from "../schemas";
import { ZONE_READER_CONTRACT_VERSION } from "../types";
import type { Accession } from "../../../domain/types";
import { ASTMethod } from "../../../domain/enums";

function makeAccession(): Accession {
  return {
    id: "acc-1",
    accessionNumber: "ACC-2026-0001",
    patient: {
      mrn: "P-001",
      givenName: "Ada",
      familyName: "Lovelace",
      sex: "F",
      ward: "ICU",
    },
    specimen: { familyCode: "BLOOD", subtypeCode: "BLOOD_CULTURE" },
    isolates: [
      { id: "iso-1", isolateNo: 1, organismCode: "ECOLI", organismDisplay: "Escherichia coli" },
    ],
    ast: [
      {
        id: "ast-amp",
        isolateId: "iso-1",
        antibioticCode: "AMP",
        method: ASTMethod.DiskDiffusion,
        standard: "EUCAST",
        rawValue: undefined,
        governance: {},
        cascade: {},
      },
      {
        id: "ast-cip",
        isolateId: "iso-1",
        antibioticCode: "CIP",
        method: ASTMethod.DiskDiffusion,
        standard: "EUCAST",
        rawValue: undefined,
        governance: {},
        cascade: {},
      },
    ],
  } as unknown as Accession;
}

const baseImport = {
  contractVersion: ZONE_READER_CONTRACT_VERSION,
  sourceSystem: "ACME_ZR_1",
  accessionId: "acc-1",
  isolateId: "iso-1",
  astPanelId: "enterobacterales",
  method: "disk_diffusion" as const,
  device: "ACME-SN-001",
};

export function runZoneReaderRoundTripTests() {
  const accession = makeAccession();

  // 1. Successful export/import round trip
  const envelope = buildWorklistExport({
    accession,
    isolateId: "iso-1",
    astPanelId: "enterobacterales",
    now: new Date("2026-05-12T10:00:00Z"),
  });
  assert.equal(envelope.schemaVersion, ZONE_READER_CONTRACT_VERSION);
  assert.equal(envelope.createdAt, "2026-05-12T10:00:00.000Z");
  const w = envelope;
  assert.equal(w.sourceSystem, "MEDUGU_LIMS");
  assert.equal(w.standard, "EUCAST");
  assert.equal(w.patientDisplayId, "P-001");
  assert.equal(w.organismName, "Escherichia coli");
  assert.equal(typeof w.organismGroup, "string");
  assert.ok(w.expectedDiscs.length > 0);
  for (const d of w.expectedDiscs) {
    assert.equal(typeof d.discPotency, "string");
    assert.ok(d.discPotency.length > 0);
  }

  const ampDisc = w.expectedDiscs.find((d) => d.antibioticCode === "AMP");
  assert.equal(ampDisc?.antibioticClass, "penicillin");

  const ok = mapImport({
    accession,
    worklist: w,
    payload: {
      ...baseImport,
      readAt: "2026-05-12T10:42:00Z",
      results: [{ antibioticCode: "AMP", zoneDiameterMm: 18, confidence: 0.95 }],
    },
  });
  assert.equal(ok.ok, true);
  assert.equal(ok.matched.length, 1);
  assert.equal(ok.matched[0].astRowId, "ast-amp");
  assert.equal(ok.matched[0].zoneDiameterMm, 18);
  assert.equal(ok.matched[0].requiresReview, false);

  // 2. Low-confidence result requires review
  const lowConf = mapImport({
    accession,
    payload: {
      ...baseImport,
      readAt: "2026-05-12T10:42:00Z",
      results: [{ antibioticCode: "AMP", zoneDiameterMm: 18, confidence: 0.6 }],
    },
  });
  assert.equal(lowConf.ok, true);
  assert.equal(lowConf.matched[0].requiresReview, true);
  assert.ok(lowConf.matched[0].reviewReasons.includes("low_confidence"));
  assert.ok(lowConf.findings.some((f) => f.code === "LOW_CONFIDENCE"));

  // 3. Off-panel antibiotic flagged + ends up in unmatched (no AST row)
  const offPanel = mapImport({
    accession,
    payload: {
      ...baseImport,
      readAt: "2026-05-12T10:42:00Z",
      results: [{ antibioticCode: "ZZZ", zoneDiameterMm: 20, confidence: 0.9 }],
    },
  });
  assert.equal(offPanel.ok, true);
  assert.ok(offPanel.findings.some((f) => f.code === "ANTIBIOTIC_OFF_PANEL"));
  assert.equal(offPanel.unmatched.length, 1);
  assert.equal(offPanel.matched.length, 0);

  // 4. Duplicate antibiotic flagged
  const dup = mapImport({
    accession,
    payload: {
      ...baseImport,
      readAt: "2026-05-12T10:42:00Z",
      results: [
        { antibioticCode: "AMP", zoneDiameterMm: 18, confidence: 0.9 },
        { antibioticCode: "AMP", zoneDiameterMm: 19, confidence: 0.9 },
      ],
    },
  });
  assert.ok(dup.findings.some((f) => f.code === "DUPLICATE_ROW"));

  // 5. Implausible zone flagged
  const implausible = mapImport({
    accession,
    payload: {
      ...baseImport,
      readAt: "2026-05-12T10:42:00Z",
      results: [{ antibioticCode: "AMP", zoneDiameterMm: 60, confidence: 0.9 }],
    },
  });
  assert.equal(implausible.ok, true);
  assert.ok(implausible.findings.some((f) => f.code === "IMPLAUSIBLE_ZONE"));
  assert.ok(implausible.matched[0].reviewReasons.includes("implausible_zone"));

  // 6. Alias: zoneMm vs zoneDiameterMm both accepted, normalised identically
  const aliasZone = mapImport({
    accession,
    payload: {
      ...baseImport,
      measuredAt: "2026-05-12T10:42:00Z", // alias for readAt
      results: [{ antibioticCode: "AMP", zoneMm: 22, confidence: 0.9 }],
    },
  });
  assert.equal(aliasZone.ok, true);
  assert.equal(aliasZone.matched[0].zoneDiameterMm, 22);

  // 7. Alias: confidence numeric vs readerConfidence band
  const aliasConfNumeric = mapImport({
    accession,
    payload: {
      ...baseImport,
      readAt: "2026-05-12T10:42:00Z",
      results: [{ antibioticCode: "AMP", zoneDiameterMm: 22, confidence: 0.95 }],
    },
  });
  assert.equal(aliasConfNumeric.matched[0].readerConfidence, "high");

  const aliasConfBand = mapImport({
    accession,
    payload: {
      ...baseImport,
      readAt: "2026-05-12T10:42:00Z",
      results: [{ antibioticCode: "AMP", zoneDiameterMm: 22, readerConfidence: "low" }],
    },
  });
  assert.equal(aliasConfBand.matched[0].readerConfidence, "low");
  assert.ok(aliasConfBand.matched[0].reviewReasons.includes("low_confidence"));

  // 8. Accession mismatch is a blocker
  const blocked = mapImport({
    accession,
    payload: {
      ...baseImport,
      accessionId: "WRONG",
      readAt: "2026-05-12T10:42:00Z",
      results: [{ antibioticCode: "AMP", zoneDiameterMm: 18 }],
    },
  });
  assert.equal(blocked.ok, false);
  assert.ok(blocked.findings.some((f) => f.code === "ACCESSION_MISMATCH"));

  // 9. measurementSource alias normalisation: "reader" → "auto_reader",
  //    "manual" → "manual_entry", canonical values pass through unchanged.
  const srcReader = mapImport({
    accession,
    payload: {
      ...baseImport,
      readAt: "2026-05-12T10:42:00Z",
      results: [
        { antibioticCode: "AMP", zoneDiameterMm: 18, confidence: 0.9, measurementSource: "reader" },
      ],
    },
  });
  assert.equal(srcReader.matched.length, 1);
  // The mapper returns MatchedRow which doesn't surface measurementSource directly,
  // so re-parse via the schema to confirm normalisation at the contract boundary.
  const normReader = zoneReaderResultImportSchema.parse({
    ...baseImport,
    readAt: "2026-05-12T10:42:00Z",
    results: [
      { antibioticCode: "AMP", zoneDiameterMm: 18, confidence: 0.9, measurementSource: "reader" },
    ],
  });
  assert.equal(normReader.results[0].measurementSource, "auto_reader");

  const normManual = zoneReaderResultImportSchema.parse({
    ...baseImport,
    readAt: "2026-05-12T10:42:00Z",
    results: [
      { antibioticCode: "AMP", zoneDiameterMm: 18, measurementSource: "manual" },
    ],
  });
  assert.equal(normManual.results[0].measurementSource, "manual_entry");
  // Manual entry with no numeric confidence → readerConfidence band "manual".
  assert.equal(normManual.results[0].readerConfidence, "manual");

  const normImported = zoneReaderResultImportSchema.parse({
    ...baseImport,
    readAt: "2026-05-12T10:42:00Z",
    results: [
      { antibioticCode: "AMP", zoneDiameterMm: 18, confidence: 0.9, measurementSource: "imported" },
    ],
  });
  assert.equal(normImported.results[0].measurementSource, "imported");

  // 10. Confidence band normalisation from numeric.
  assert.equal(
    zoneReaderResultImportSchema.parse({
      ...baseImport,
      readAt: "2026-05-12T10:42:00Z",
      results: [{ antibioticCode: "AMP", zoneDiameterMm: 18, confidence: 0.95 }],
    }).results[0].readerConfidence,
    "high",
  );
  assert.equal(
    zoneReaderResultImportSchema.parse({
      ...baseImport,
      readAt: "2026-05-12T10:42:00Z",
      results: [{ antibioticCode: "AMP", zoneDiameterMm: 18, confidence: 0.7 }],
    }).results[0].readerConfidence,
    "medium",
  );
  assert.equal(
    zoneReaderResultImportSchema.parse({
      ...baseImport,
      readAt: "2026-05-12T10:42:00Z",
      results: [{ antibioticCode: "AMP", zoneDiameterMm: 18, confidence: 0.3 }],
    }).results[0].readerConfidence,
    "low",
  );
}

// VRE screen accession fixture — confirms the exported envelope passes the
// Zone Reader importer's strict shape (schemaVersion + createdAt + worklist
// wrapper, non-null organismGroup, non-null discPotency on every disc).
export function runZoneReaderVreExportFixtureTest() {
  const accession: Accession = {
    id: "MB25-COL002",
    accessionNumber: "MB25-COL002",
    patient: { mrn: "MRN-COL002", givenName: "VRE", familyName: "Screen", ward: "Onc" },
    specimen: { familyCode: "STOOL", subtypeCode: "RECTAL_SWAB" },
    isolates: [
      {
        id: "iso_EFAM_1",
        isolateNo: 1,
        organismCode: "EFAM",
        organismDisplay: "Enterococcus faecium",
      },
    ],
    ast: [
      {
        id: "ast-vanco",
        isolateId: "iso_EFAM_1",
        antibioticCode: "vancomycin",
        method: ASTMethod.DiskDiffusion,
        standard: "EUCAST",
        rawValue: undefined,
        governance: {},
        cascade: {},
      },
    ],
  } as unknown as Accession;

  const envelope = buildWorklistExport({
    accession,
    isolateId: "iso_EFAM_1",
    astPanelId: "enterococcus",
    now: new Date("2026-06-06T09:00:00Z"),
  });

  // Envelope shape Zone Reader importer requires.
  assert.equal(envelope.schemaVersion, "1.0.0");
  assert.equal(typeof envelope.createdAt, "string");
  assert.equal(envelope.worklistId, "MB25-COL002:iso_EFAM_1:enterococcus");
  assert.equal(envelope.sourceSystem, "MEDUGU_LIMS");

  // organismGroup is a string (importer rejects null).
  assert.equal(typeof envelope.organismGroup, "string");
  assert.equal(envelope.organismGroup, "enterococcus");

  // discPotency is a NON-EMPTY string on every expected disc — placeholder
  // "unspecified" until a true potency mapping is added.
  assert.ok(envelope.expectedDiscs.length > 0);
  for (const d of envelope.expectedDiscs) {
    assert.equal(typeof d.discPotency, "string");
    assert.ok(d.discPotency.length > 0);
    assert.equal(d.discPotency, "unspecified");
  }

  // Disallowed root fields must NOT appear in the export.
  for (const k of [
    "contractVersion",
    "generatedAt",
    "isolateNo",
    "patientName",
    "ward",
    "specimenCode",
    "organismDisplay",
    "astPanelLabel",
    "method",
  ]) {
    assert.equal((envelope as any)[k], undefined, k + " must NOT be present at root");
  }

  // Required root fields
  for (const k of ["sourceSystem","accessionId","accessionNumber","isolateId","specimenType","organismName","organismCode","organismGroup","astPanelId","astPanelName","standard"] as const) {
    assert.ok((envelope as any)[k] !== undefined, k + " must be present at root");
  }

  // Round-trip identity preserved.
  assert.equal(envelope.accessionId, "MB25-COL002");
  assert.equal(envelope.isolateId, "iso_EFAM_1");
  assert.equal(envelope.astPanelId, "enterococcus");

  // The exported envelope must parse cleanly through the producer schema —
  // this mirrors what the Zone Reader importer enforces on its side.
  zoneReaderWorklistExportSchema.parse(envelope);
}
