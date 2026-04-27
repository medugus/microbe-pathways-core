import assert from "node:assert/strict";
import { amsAcceptanceScenarioCases } from "../../fixtures/amsAcceptanceCases";
import { DEMO_ACCESSIONS } from "../../seed/demoAccessions";
import type { Accession, ASTResult } from "../../domain/types";
import { ReleaseState } from "../../domain/enums";
import { buildReportPreview } from "../reportPreview";
import { buildExport, evaluateExportGate } from "../exportEngine";
import { runValidation } from "../validationEngine";
import { deriveAMSReleaseContext, deriveAMSValidationIssues } from "../amsReleaseGovernance";
import { deriveOperationalDashboard } from "../operationalDashboard";

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function getDemo(id: string): Accession {
  const accession = DEMO_ACCESSIONS.find((candidate) => candidate.id === id);
  assert(accession, `Expected demo accession ${id}.`);
  return clone(accession);
}

function withFrozenReleasePackage(accession: Accession): Accession {
  const preview = buildReportPreview(accession);
  return {
    ...accession,
    release: { ...accession.release, state: ReleaseState.Released },
    releasePackage: {
      builtAt: "2026-04-27T00:00:00.000Z",
      version: accession.release.reportVersion,
      body: preview,
      ruleVersion: accession.ruleVersion,
      breakpointVersion: accession.breakpointVersion,
      exportVersion: accession.exportVersion,
      buildVersion: accession.buildVersion,
    },
  };
}

function placeholderRow(isolateId: string, antibioticCode: string): ASTResult {
  return {
    id: `ast_placeholder_${antibioticCode}`,
    isolateId,
    antibioticCode,
    method: "disk_diffusion",
    standard: "CLSI",
    governance: "draft",
    cascade: "primary",
  };
}

// A) Released accession export chain.
const releasedBase = getDemo("MB25-COL003P");
const released = withFrozenReleasePackage(releasedBase);
const releasedPreview = buildReportPreview(released);
assert(releasedPreview.accessionNumber === released.accessionNumber, "Report preview must build.");
assert(
  released.releasePackage?.body,
  "Frozen release package body must be available for released case.",
);

const releasedGate = evaluateExportGate(released);
assert.equal(releasedGate.available, true, "Export gate must be available for released accession.");
assert.equal(
  releasedGate.fromReleasePackage,
  true,
  "Released export should source from frozen release package.",
);

const fhir = buildExport(released, "fhir");
assert(fhir.content.length > 0, "FHIR export must be non-empty.");
assert(
  fhir.content.includes(released.accessionNumber),
  "FHIR export must include accession number.",
);
assert(fhir.content.includes(released.patient.mrn), "FHIR export must include patient MRN.");
assert(
  fhir.content.includes("urn:medugu:rule-version"),
  "FHIR export must include governed version metadata extension.",
);

const hl7 = buildExport(released, "hl7");
assert(hl7.content.length > 0, "HL7 export must be non-empty.");
assert(hl7.content.includes(released.accessionNumber), "HL7 export must include accession number.");
assert(hl7.content.includes(released.patient.mrn), "HL7 export must include patient MRN.");
assert(
  hl7.content.includes("Versions: rule="),
  "HL7 export must include version metadata summary.",
);

const normalised = buildExport(released, "json");
assert(normalised.content.length > 0, "Normalised JSON export must be non-empty.");
assert(
  normalised.content.includes(released.accessionNumber),
  "Normalised JSON export must include accession number.",
);
assert(
  normalised.content.includes(released.patient.mrn),
  "Normalised JSON export must include patient MRN.",
);
const normalisedParsed = JSON.parse(normalised.content) as {
  versions?: { rule?: string; breakpoint?: string; export?: string; build?: string };
};
assert(
  normalisedParsed.versions?.rule,
  "Normalised JSON export must include rule version metadata.",
);
assert(
  normalisedParsed.versions?.breakpoint,
  "Normalised JSON export must include breakpoint version metadata.",
);
assert(
  normalisedParsed.versions?.export,
  "Normalised JSON export must include export version metadata.",
);
assert(
  normalisedParsed.versions?.build,
  "Normalised JSON export must include build version metadata.",
);

// B) Unreleased accession export gate.
const unreleased = getDemo("MB25-AB12CD");
const unreleasedGate = evaluateExportGate(unreleased);
assert.equal(
  unreleasedGate.available,
  false,
  "Export gate must be unavailable for unreleased accession.",
);
assert(
  unreleasedGate.reason && unreleasedGate.reason.length > 0,
  "Unreleased export block reason must exist.",
);
assert(
  unreleasedGate.reason?.includes("Report not yet released") ||
    unreleasedGate.reason?.includes("Export blocked by"),
  "Unreleased export should be blocked before release per current export gate contract.",
);

// C) Urine M/C/S regression fixture.
const urine = getDemo("MB25-AB12CD");
urine.id = "MB26-URINE-MCS-INT-001";
urine.accessionNumber = urine.id;
urine.patient.mrn = "AMCE-URINE-REG-001";
urine.specimen.familyCode = "URINE";
urine.specimen.subtypeCode = "URINE_MIDSTREAM";
urine.microscopy = [
  { id: "mic_u_gram", stainCode: "gram", result: "gram_negative_bacilli", notes: "few" },
];
const urineIsolateId = urine.isolates[0]?.id ?? "iso_urine_reg_1";
urine.isolates = [
  {
    id: urineIsolateId,
    isolateNo: 1,
    organismCode: "ECOL",
    organismDisplay: "Escherichia coli",
    significance: "significant",
    colonyCountCfuPerMl: 1e5,
    identifiedAt: "2026-04-27T01:00:00.000Z",
  },
];
urine.ast = [
  {
    id: "ast_urine_amp",
    isolateId: urineIsolateId,
    antibioticCode: "AMP",
    method: "disk_diffusion",
    standard: "CLSI",
    rawValue: 8,
    rawUnit: "mm",
    rawInterpretation: "R",
    interpretedSIR: "R",
    finalInterpretation: "R",
    governance: "interpreted",
    cascade: "primary",
  },
  {
    id: "ast_urine_cip",
    isolateId: urineIsolateId,
    antibioticCode: "CIP",
    method: "disk_diffusion",
    standard: "CLSI",
    rawValue: 22,
    rawUnit: "mm",
    rawInterpretation: "S",
    interpretedSIR: "S",
    finalInterpretation: "S",
    governance: "interpreted",
    cascade: "primary",
  },
  placeholderRow(urineIsolateId, "MEM"),
  placeholderRow(urineIsolateId, "ETP"),
  placeholderRow(urineIsolateId, "TZP"),
];
urine.amsApprovals = [];

const urinePreview = buildReportPreview(urine);
assert.equal(urinePreview.specimen.pathway, "diagnostic", "Urine report preview must build.");
const urineValidation = runValidation(urine);
const urineAstIncomplete = urineValidation.blockers.filter(
  (issue) => issue.code === "AST_INCOMPLETE",
);
assert(
  !urineAstIncomplete.some(
    (issue) => issue.message.includes("MEM") || issue.message.includes("ETP"),
  ),
  "Blank AST placeholders must not create AST_INCOMPLETE blockers.",
);
const urineAmsIssues = deriveAMSValidationIssues(urine);
assert(
  !urineAmsIssues.some((issue) => issue.code.includes("RESTRICTED_APPROVAL_REQUIRED")),
  "Unentered restricted drugs must not create AMS approval blockers.",
);
assert.equal(
  urinePreview.internalNotes.length,
  0,
  "Clinician-facing report preview must not include internal AMS/IPC notes by default.",
);

// D) Restricted-drug approval regression.
const pendingRestricted = clone(amsAcceptanceScenarioCases.restrictedMeropenemPendingApprovalCase);

const pendingValidation = runValidation(pendingRestricted);
const pendingContext = deriveAMSReleaseContext(pendingRestricted);
assert(pendingContext.hasReleaseBlocker, "AMS blocker must exist before restricted-drug approval.");
assert(
  pendingValidation.blockers.some((issue) => issue.code.includes("RESTRICTED_APPROVAL_REQUIRED")),
  "Validation blocker list must include restricted approval required before approval.",
);

const approvedRestricted = clone(pendingRestricted);
approvedRestricted.id = "MB26-AMS-APPROVAL-APPROVED-001";
approvedRestricted.accessionNumber = approvedRestricted.id;
approvedRestricted.amsApprovals = (approvedRestricted.amsApprovals ?? []).map((item) => ({
  ...item,
  status: "approved",
  decided: { at: "2026-04-27T01:45:00.000Z", actor: "AMS pharmacist" },
}));

const approvedValidation = runValidation(approvedRestricted);
assert(
  !approvedValidation.blockers.some((issue) => issue.code.includes("RESTRICTED_APPROVAL_REQUIRED")),
  "AMS blocker must clear after restricted-drug approval.",
);
const approvedContext = deriveAMSReleaseContext(approvedRestricted);
assert.equal(
  approvedContext.hasReleaseBlocker,
  false,
  "Release AMS context must clear after approval.",
);
assert.equal(
  approvedContext.pendingApprovalCount,
  0,
  "AMS pending count must clear after approval.",
);
const approvedDashboard = deriveOperationalDashboard([approvedRestricted]);
assert(
  !approvedDashboard.items.some((item) => item.category === "ams_pending_approval"),
  "Dashboard must not show approved restricted item as pending AMS approval.",
);

// E) Blood culture regression fixture (existing demo + in-test blood set linkage details).
const blood = getDemo("MB25-EF34GH");
blood.specimen.details = {
  sets: [
    {
      drawSite: "Peripheral left",
      lumenLabel: "N/A",
      bottleTypes: ["aerobic", "anaerobic"],
      drawTime: "2026-04-27T02:00:00.000Z",
    },
  ],
};
blood.isolates = blood.isolates.map((iso) => ({
  ...iso,
  bloodSourceLinks: [{ setNo: 1, bottleType: "aerobic" }],
  bottleResults: [
    {
      setNo: 1,
      bottleType: "aerobic",
      growth: "growth",
      positiveAt: "2026-04-27T06:00:00.000Z",
      ttpHours: 4,
    },
    {
      setNo: 1,
      bottleType: "anaerobic",
      growth: "no_growth",
    },
  ],
}));
const releasedBlood = withFrozenReleasePackage(blood);
const bloodPreview = buildReportPreview(releasedBlood);
assert(
  (bloodPreview.bloodSets?.length ?? 0) > 0,
  "Blood culture report preview must include blood set details when present.",
);

const bloodFhir = buildExport(releasedBlood, "fhir");
assert(
  bloodFhir.content.includes("Blood culture set 1") || bloodFhir.content.includes("set-1"),
  "Blood culture export must include blood set details in FHIR output.",
);

const bloodJson = buildExport(releasedBlood, "json");
const bloodJsonParsed = JSON.parse(bloodJson.content) as {
  bloodSets?: unknown[];
  bloodLinkage?: { bottles?: unknown[]; isolateLinks?: unknown[] };
};
assert((bloodJsonParsed.bloodSets?.length ?? 0) > 0, "JSON export must include blood set details.");
assert(
  (bloodJsonParsed.bloodLinkage?.bottles?.length ?? 0) > 0 &&
    (bloodJsonParsed.bloodLinkage?.isolateLinks?.length ?? 0) > 0,
  "JSON export must include blood bottle and isolate linkage details.",
);

const releasedBloodGate = evaluateExportGate(releasedBlood);
assert.equal(
  releasedBloodGate.fromReleasePackage,
  true,
  "Released blood-culture export must remain sourced from frozen release package.",
);

console.log("[reportReleaseExport.integration.test] all assertions passed");
