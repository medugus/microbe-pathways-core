import { amsAcceptanceScenarioCases, toAccessionsMap } from "../../fixtures/amsAcceptanceCases";
import type { Accession, ASTResult } from "../../domain/types";
import { deriveOperationalDashboard } from "../operationalDashboard";
import { deriveAMSReleaseContext, deriveAMSValidationIssues } from "../amsReleaseGovernance";

function assert(condition: unknown, message: string): void {
  if (!condition) throw new Error(message);
}

const fixedNow = Date.parse("2026-04-25T12:00:00.000Z");
const originalDateNow = Date.now;
Date.now = () => fixedNow;

const dashboardCases = [
  amsAcceptanceScenarioCases.restrictedMeropenemPendingApprovalCase,
  amsAcceptanceScenarioCases.restrictedReserveApprovedCase,
  amsAcceptanceScenarioCases.noAmsActionCase,
];

const dashboard = deriveOperationalDashboard(toAccessionsMap(dashboardCases));

const pendingItem = dashboard.items.find(
  (item) =>
    item.accessionId === amsAcceptanceScenarioCases.restrictedMeropenemPendingApprovalCase.id
    && item.category === "ams_pending_approval",
);
assert(!!pendingItem, "Pending restricted AMS item should appear in dashboard queue as ams_pending_approval.");

const approvedPendingItem = dashboard.items.find(
  (item) =>
    item.accessionId === amsAcceptanceScenarioCases.restrictedReserveApprovedCase.id
    && item.category === "ams_pending_approval",
);
assert(!approvedPendingItem, "Approved restricted AMS item should not be incorrectly prioritised as pending.");

const noActionAmsItems = dashboard.items.filter(
  (item) => item.accessionId === amsAcceptanceScenarioCases.noAmsActionCase.id && item.sourceModule === "AMS",
);
assert(noActionAmsItems.length === 0, "No-AMS-action case should not create a false AMS dashboard queue item.");

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function astTemplateRow(isolateId: string, antibioticCode: string): ASTResult {
  return {
    id: `ast_template_${antibioticCode}`,
    isolateId,
    antibioticCode,
    method: "disk_diffusion",
    standard: "CLSI",
    governance: "draft",
    cascade: "primary",
  };
}

const releaseRelevantCase: Accession = (() => {
  const accession = clone(amsAcceptanceScenarioCases.noAmsActionCase);
  accession.id = "AMS-REL-001";
  accession.accessionNumber = "MB26-AMJHEA";
  accession.isolates = [{
    id: "iso_rel_1",
    isolateNo: 1,
    organismCode: "ECOL",
    organismDisplay: "Escherichia coli",
    significance: "significant",
    identifiedAt: "2026-04-25T10:00:00.000Z",
  }];
  accession.ast = [
    {
      id: "ast_rel_amp",
      isolateId: "iso_rel_1",
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
      id: "ast_rel_cip",
      isolateId: "iso_rel_1",
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
    astTemplateRow("iso_rel_1", "MEM"),
    astTemplateRow("iso_rel_1", "CRO"),
    astTemplateRow("iso_rel_1", "CAZ"),
    astTemplateRow("iso_rel_1", "FEP"),
    astTemplateRow("iso_rel_1", "TZP"),
    astTemplateRow("iso_rel_1", "ETP"),
    astTemplateRow("iso_rel_1", "AMK"),
  ];
  accession.amsApprovals = [];
  return accession;
})();

const releaseRelevantContext = deriveAMSReleaseContext(releaseRelevantCase);
assert(
  releaseRelevantContext.pendingApprovalCount === 0,
  "Unentered restricted template rows must not create pending AMS approval count.",
);
const releaseRelevantIssues = deriveAMSValidationIssues(releaseRelevantCase);
assert(
  !releaseRelevantIssues.some((issue) => issue.code.includes("RESTRICTED_APPROVAL_REQUIRED")),
  "Unentered restricted template rows must not create AMS restricted approval validation blockers.",
);

const releaseRelevantDashboard = deriveOperationalDashboard(toAccessionsMap([releaseRelevantCase]));
const releaseRelevantAmsItems = releaseRelevantDashboard.items.filter((item) => item.sourceModule === "AMS");
assert(
  releaseRelevantAmsItems.length === 0,
  "Dashboard must not count unentered restricted template rows as pending AMS approvals.",
);

const enteredRestrictedCase = clone(releaseRelevantCase);
enteredRestrictedCase.id = "AMS-REL-002";
enteredRestrictedCase.accessionNumber = "MB26-AMJHEA-MEM";
enteredRestrictedCase.ast = enteredRestrictedCase.ast.map((row) => (
  row.antibioticCode === "MEM"
    ? {
      ...row,
      rawValue: 0.5,
      rawUnit: "mg/L",
      rawInterpretation: "S",
      interpretedSIR: "S",
      finalInterpretation: "S",
      method: "mic_broth",
      governance: "interpreted",
    }
    : row
));

const enteredRestrictedContext = deriveAMSReleaseContext(enteredRestrictedCase);
assert(
  enteredRestrictedContext.pendingApprovalCount === 1,
  "Entered restricted AST result should create exactly one pending AMS approval requirement.",
);

const enteredRestrictedDashboard = deriveOperationalDashboard(toAccessionsMap([enteredRestrictedCase]));
assert(
  enteredRestrictedDashboard.items.some((item) => item.category === "ams_restricted" || item.category === "ams_pending_approval"),
  "Entered restricted AST result should appear in dashboard AMS pending/restricted queue.",
);

Date.now = originalDateNow;

// eslint-disable-next-line no-console
console.log("[operationalDashboard.ams.test] all assertions passed");
