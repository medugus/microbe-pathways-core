import assert from "node:assert/strict";
import { DEMO_ACCESSIONS } from "../../seed/demoAccessions";
import {
  EUCAST_2026_BREAKPOINT_REGISTRY,
  findDiskBreakpoint,
  findMICBreakpoint,
} from "../../config/breakpoints";
import { buildReportPreview } from "../reportPreview";
import { buildExport, evaluateExportGate } from "../exportEngine";
import { buildNormalisedJson } from "../export/jsonExport";

const candidateWithoutActiveTwin = EUCAST_2026_BREAKPOINT_REGISTRY.find((row) => {
  if ((row.breakpointStatus ?? "active") === "active") return false;
  return !EUCAST_2026_BREAKPOINT_REGISTRY.some(
    (candidate) =>
      candidate.organismGroup === row.organismGroup &&
      candidate.antibioticCode === row.antibioticCode &&
      candidate.method === row.method &&
      (candidate.breakpointStatus ?? "active") === "active",
  );
});

assert(candidateWithoutActiveTwin, "Expected at least one EUCAST 2026 candidate-only record.");
const candidate = candidateWithoutActiveTwin!;

if (candidate.method === "mic") {
  const resolved = findMICBreakpoint(candidate.organismGroup, candidate.antibioticCode, "EUCAST");
  assert.equal(
    resolved,
    undefined,
    "Candidate-only EUCAST MIC rows must not resolve as active breakpoints.",
  );
} else {
  const resolved = findDiskBreakpoint(candidate.organismGroup, candidate.antibioticCode, "EUCAST");
  assert.equal(
    resolved,
    undefined,
    "Candidate-only EUCAST disk rows must not resolve as active breakpoints.",
  );
}

const released = DEMO_ACCESSIONS.find((a) => a.id === "MB25-COL003P");
assert(released, "Expected released demo accession MB25-COL003P.");
const releasedWithPackage = {
  ...released!,
  releasePackage: {
    builtAt: new Date().toISOString(),
    version: released!.release.reportVersion,
    body: buildReportPreview(released!),
    ruleVersion: released!.ruleVersion,
    breakpointVersion: released!.breakpointVersion,
    exportVersion: released!.exportVersion,
    buildVersion: released!.buildVersion,
  },
};

const preview = buildReportPreview(releasedWithPackage);
assert(preview.versions.rule, "Report preview must include rule version metadata.");
assert(preview.versions.breakpoint, "Report preview must include breakpoint version metadata.");
assert(preview.versions.export, "Report preview must include export version metadata.");
assert(preview.versions.build, "Report preview must include build version metadata.");

const gate = evaluateExportGate(releasedWithPackage);
assert.equal(
  gate.fromReleasePackage,
  true,
  "Released exports must be sourced from frozen package.",
);
assert(gate.versions.rule, "Export gate must include rule version metadata.");
assert(gate.versions.breakpoint, "Export gate must include breakpoint version metadata.");
assert(gate.versions.export, "Export gate must include export version metadata.");
assert(gate.versions.build, "Export gate must include build version metadata.");

const fhir = buildExport(releasedWithPackage, "fhir");
assert(fhir.content.includes("urn:medugu:rule-version"), "FHIR export must include rule version.");
assert(
  fhir.content.includes("urn:medugu:breakpoint-version"),
  "FHIR export must include breakpoint version.",
);

const hl7 = buildExport(releasedWithPackage, "hl7");
assert(hl7.content.includes("Versions: rule="), "HL7 export must include version summary NTE.");

const normalised = buildNormalisedJson(releasedWithPackage);
assert(normalised.versions.rule, "Normalised JSON must include rule version metadata.");
assert(normalised.versions.breakpoint, "Normalised JSON must include breakpoint metadata.");
assert(normalised.versions.export, "Normalised JSON must include export metadata.");
assert(normalised.versions.build, "Normalised JSON must include build metadata.");

const mutatedLive = {
  ...releasedWithPackage,
  ruleVersion: "mutated-live-rule",
  breakpointVersion: "mutated-live-breakpoint",
  exportVersion: "mutated-live-export",
  buildVersion: "mutated-live-build",
};
const frozenNormalised = buildNormalisedJson(mutatedLive);
const frozenBodyVersions = releasedWithPackage.releasePackage?.body as
  | { versions?: { rule?: string; breakpoint?: string } }
  | undefined;
assert.equal(
  frozenNormalised.versions.rule,
  frozenBodyVersions?.versions?.rule,
  "Released normalised export must continue using frozen report versions.",
);
assert.equal(
  frozenNormalised.versions.breakpoint,
  frozenBodyVersions?.versions?.breakpoint,
  "Released normalised export must continue using frozen breakpoint version.",
);

console.log("[configVersionCoherence.test] all assertions passed");
