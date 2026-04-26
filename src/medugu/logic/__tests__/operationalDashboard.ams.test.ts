import { amsAcceptanceScenarioCases, toAccessionsMap } from "../../fixtures/amsAcceptanceCases";
import { deriveOperationalDashboard } from "../operationalDashboard";

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

Date.now = originalDateNow;

// eslint-disable-next-line no-console
console.log("[operationalDashboard.ams.test] all assertions passed");
