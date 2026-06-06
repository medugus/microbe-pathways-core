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

  // 8. Accession id mismatch is a blocker
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
  assert.equal(blocked.matched.length, 0, "no matched rows on blocker");

  // 8b. Accession number mismatch is a blocker
  const accNumBad = mapImport({
    accession,
    payload: {
      ...baseImport,
      accessionNumber: "WRONG-NUMBER",
      readAt: "2026-05-12T10:42:00Z",
      results: [{ antibioticCode: "AMP", zoneDiameterMm: 18 }],
    },
  });
  assert.equal(accNumBad.ok, false);
  assert.ok(accNumBad.findings.some((f) => f.code === "ACCESSION_NUMBER_MISMATCH"));

  // 8c. Isolate mismatch is a blocker
  const isoBad = mapImport({
    accession,
    payload: {
      ...baseImport,
      isolateId: "iso-DOES-NOT-EXIST",
      readAt: "2026-05-12T10:42:00Z",
      results: [{ antibioticCode: "AMP", zoneDiameterMm: 18 }],
    },
  });
  assert.equal(isoBad.ok, false);
  assert.ok(isoBad.findings.some((f) => f.code === "ISOLATE_NOT_FOUND"));

  // 8d. AST panel mismatch is a blocker
  const panelBad = mapImport({
    accession,
    payload: {
      ...baseImport,
      astPanelId: "not_a_real_panel",
      readAt: "2026-05-12T10:42:00Z",
      results: [{ antibioticCode: "AMP", zoneDiameterMm: 18 }],
    },
  });
  assert.equal(panelBad.ok, false);
  assert.ok(panelBad.findings.some((f) => f.code === "PANEL_NOT_FOUND"));

  // 8e. Unsupported schema/contract version → SCHEMA_PARSE_FAILED, no writes
  const verBad = mapImport({
    accession,
    payload: {
      ...baseImport,
      contractVersion: "9.9.9",
      readAt: "2026-05-12T10:42:00Z",
      results: [{ antibioticCode: "AMP", zoneDiameterMm: 18 }],
    },
  });
  assert.equal(verBad.ok, false);
  assert.ok(verBad.findings.some((f) => f.code === "SCHEMA_PARSE_FAILED"));
  assert.equal(verBad.matched.length, 0);

  // 8f. Cross-worklist mismatch (worklist supplied but identities differ).
  const wrongWorklist = mapImport({
    accession,
    worklist: { ...envelope, isolateId: "iso-OTHER" } as typeof envelope,
    payload: {
      ...baseImport,
      readAt: "2026-05-12T10:42:00Z",
      results: [{ antibioticCode: "AMP", zoneDiameterMm: 18 }],
    },
  });
  assert.equal(wrongWorklist.ok, false);
  assert.ok(wrongWorklist.findings.some((f) => f.code === "WORKLIST_ISOLATE_MISMATCH"));

  // 8g. Protected boundary — MatchedRow exposes ONLY raw measurement /
  //     provenance fields. It must not carry interpreted SIR, phenotype,
  //     cascade, stewardship, IPC, validation or release state.
  const proofRow = ok.matched[0];
  const allowedKeys = new Set([
    "antibioticCode",
    "astRowId",
    "zoneDiameterMm",
    "readerConfidence",
    "confidenceNumeric",
    "notes",
    "imageReference",
    "manualEdited",
    "overrideReason",
    "requiresReview",
    "reviewReasons",
  ]);
  for (const k of Object.keys(proofRow)) {
    assert.ok(allowedKeys.has(k), `MatchedRow leaks non-raw field: ${k}`);
  }
  const forbidden = [
    "sir",
    "interpretation",
    "phenotype",
    "cascade",
    "cascadeOverride",
    "stewardship",
    "ipc",
    "validationState",
    "releaseState",
    "reported",
    "amsApproval",
  ];
  for (const k of forbidden) {
    assert.equal((proofRow as any)[k], undefined, `MatchedRow must not carry ${k}`);
  }

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

  // 11. manualEdited=false: originalValue / correctedValue / overrideReason
  //     may all be null. This is the real-world export shape.
  const nullAudit = mapImport({
    accession,
    payload: {
      ...baseImport,
      readAt: "2026-05-12T10:42:00Z",
      results: [
        {
          antibioticCode: "AMP",
          zoneDiameterMm: 18,
          confidence: 0.95,
          manualEdited: false,
          originalValue: null,
          correctedValue: null,
          overrideReason: null,
          reviewedBy: null,
          reviewedAt: null,
        },
      ],
    },
  });
  assert.equal(nullAudit.ok, true, "null override fields with manualEdited=false must pass");
  assert.equal(nullAudit.matched.length, 1);
  assert.equal(nullAudit.matched[0].manualEdited, false);

  // 12. manualEdited=true with the complete override-audit quintet passes.
  const completeAudit = mapImport({
    accession,
    payload: {
      ...baseImport,
      readAt: "2026-05-12T10:42:00Z",
      results: [
        {
          antibioticCode: "AMP",
          zoneDiameterMm: 19,
          confidence: 0.95,
          manualEdited: true,
          originalValue: 18,
          correctedValue: 19,
          overrideReason: "edge of plate",
          reviewedBy: "tech-1",
          reviewedAt: "2026-05-12T10:45:00Z",
        },
      ],
    },
  });
  assert.equal(completeAudit.ok, true);
  assert.equal(completeAudit.matched[0].manualEdited, true);
  assert.equal(completeAudit.matched[0].overrideReason, "edge of plate");

  // 13. manualEdited=true with missing override fields → blocker with the
  //     MANUAL_EDIT_AUDIT_INCOMPLETE code and a friendly rule hint.
  const incompleteAudit = mapImport({
    accession,
    payload: {
      ...baseImport,
      readAt: "2026-05-12T10:42:00Z",
      results: [
        {
          antibioticCode: "AMP",
          zoneDiameterMm: 19,
          confidence: 0.95,
          manualEdited: true,
          originalValue: null,
          correctedValue: null,
          overrideReason: null,
          reviewedBy: null,
          reviewedAt: null,
        },
      ],
    },
  });
  assert.equal(incompleteAudit.ok, false);
  assert.ok(
    incompleteAudit.findings.some((f) => f.code === "MANUAL_EDIT_AUDIT_INCOMPLETE"),
    "expected MANUAL_EDIT_AUDIT_INCOMPLETE finding",
  );
  assert.ok(
    incompleteAudit.findings.some((f) => f.code === "SCHEMA_RULE_HINT"),
    "expected SCHEMA_RULE_HINT explanation finding",
  );

  // 14. Boundary proof — MatchedRow from a passing import still only exposes
  //     raw measurement / provenance fields; no interpreted SIR, phenotype,
  //     cascade, stewardship, IPC, validation or release leak through.
  const proofRow2 = nullAudit.matched[0];
  for (const k of [
    "sir",
    "interpretation",
    "phenotype",
    "cascade",
    "stewardship",
    "ipc",
    "validationState",
    "releaseState",
    "reported",
  ]) {
    assert.equal(
      (proofRow2 as unknown as Record<string, unknown>)[k],
      undefined,
      `MatchedRow must not carry ${k}`,
    );
  }

  // 15. Row alignment — MISSING_AST_ROW for an antibiotic with no row at all.
  //     Strict matching does NOT auto-create rows; it surfaces a structured
  //     alignment + warning finding.
  const missingRow = mapImport({
    accession,
    payload: {
      ...baseImport,
      readAt: "2026-05-12T10:42:00Z",
      results: [{ antibioticCode: "TEC", zoneDiameterMm: 18, confidence: 0.9 }],
    },
  });
  assert.equal(missingRow.ok, true);
  assert.equal(missingRow.matched.length, 0);
  assert.equal(missingRow.unmatched.length, 1);
  assert.equal(missingRow.alignment.length, 1);
  assert.equal(missingRow.alignment[0].reason, "MISSING_AST_ROW");
  assert.equal(missingRow.alignment[0].antibioticCode, "TEC");
  assert.ok(
    missingRow.findings.some(
      (f) => f.code === "MISSING_AST_ROW" && f.antibioticCode === "TEC",
    ),
    "expected MISSING_AST_ROW finding",
  );

  // 16. Method mismatch — only a MIC row exists for VAN, reader returns
  //     disk_diffusion. Must NOT match and must NOT auto-convert.
  const accVan: Accession = {
    ...makeAccession(),
    ast: [
      ...makeAccession().ast,
      {
        id: "ast-van-mic",
        isolateId: "iso-1",
        antibioticCode: "VAN",
        method: ASTMethod.MIC_Broth,
        standard: "EUCAST",
        rawValue: 1,
        governance: {},
        cascade: {},
      } as any,
    ],
  } as Accession;
  const methodMismatch = mapImport({
    accession: accVan,
    payload: {
      ...baseImport,
      readAt: "2026-05-12T10:42:00Z",
      results: [{ antibioticCode: "VAN", zoneDiameterMm: 17, confidence: 0.9 }],
    },
  });
  assert.equal(methodMismatch.ok, true);
  assert.equal(methodMismatch.matched.length, 0);
  assert.equal(methodMismatch.alignment[0].reason, "METHOD_MISMATCH");
  assert.equal(methodMismatch.alignment[0].existingMethod, ASTMethod.MIC_Broth);
  assert.ok(
    methodMismatch.findings.some(
      (f) => f.code === "METHOD_MISMATCH" && f.antibioticCode === "VAN",
    ),
  );
  // The MIC row is left untouched — proof there's no auto-conversion.
  assert.equal(
    accVan.ast.find((a) => a.antibioticCode === "VAN")?.method,
    ASTMethod.MIC_Broth,
  );

  // 17. After a matching disk-diffusion row is created on the same isolate,
  //     re-running mapImport now matches cleanly.
  const accWithDisk: Accession = {
    ...accVan,
    ast: [
      ...accVan.ast,
      {
        id: "ast-van-disk",
        isolateId: "iso-1",
        antibioticCode: "VAN",
        method: ASTMethod.DiskDiffusion,
        standard: "EUCAST",
        rawValue: undefined,
        governance: {},
        cascade: {},
      } as any,
    ],
  } as Accession;
  const reMatched = mapImport({
    accession: accWithDisk,
    payload: {
      ...baseImport,
      readAt: "2026-05-12T10:42:00Z",
      results: [{ antibioticCode: "VAN", zoneDiameterMm: 17, confidence: 0.9 }],
    },
  });
  assert.equal(reMatched.ok, true);
  assert.equal(reMatched.matched.length, 1);
  assert.equal(reMatched.matched[0].astRowId, "ast-van-disk");
  assert.equal(reMatched.alignment.length, 0);

  // 18. Standard mismatch — disk row exists but under a different standard
  //     than the worklist expects.
  const accCLSI: Accession = {
    ...makeAccession(),
    ast: makeAccession().ast.map((r) =>
      r.antibioticCode === "AMP" ? ({ ...r, standard: "CLSI" } as typeof r) : r,
    ),
  } as Accession;
  const stdMismatch = mapImport({
    accession: accCLSI,
    worklist: { ...envelope, standard: "EUCAST" } as typeof envelope,
    payload: {
      ...baseImport,
      readAt: "2026-05-12T10:42:00Z",
      results: [{ antibioticCode: "AMP", zoneDiameterMm: 18, confidence: 0.9 }],
    },
  });
  assert.equal(stdMismatch.matched.length, 0);
  assert.equal(stdMismatch.alignment[0].reason, "STANDARD_MISMATCH");
  assert.equal(stdMismatch.alignment[0].existingStandard, "CLSI");
  assert.equal(stdMismatch.alignment[0].expectedStandard, "EUCAST");
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
