import { ipcAcceptanceScenarioCases, toAccessionsMap } from "../../fixtures/ipcAcceptanceCases";
import { deriveLocalOutbreakWatch } from "../ipcLocalWatch";

function assert(condition: unknown, message: string): void {
  if (!condition) throw new Error(message);
}

const fixedNow = Date.parse("2026-04-25T12:00:00.000Z");
const originalDateNow = Date.now;
Date.now = () => fixedNow;

const clusterMap = toAccessionsMap(ipcAcceptanceScenarioCases.creClusterIcuCases);
const clusterReport = deriveLocalOutbreakWatch(ipcAcceptanceScenarioCases.creClusterIcuCases[0], clusterMap, 7);
assert(clusterReport.summary === "outbreak watch", "Three ICU cases in 7 days should produce outbreak watch summary.");
assert(clusterReport.signalItems.some((item) => item.patientAdjustedCount === 3), "Cluster should show patient-adjusted count of 3.");

const repeatedMap = toAccessionsMap(ipcAcceptanceScenarioCases.repeatedSamePatientCreCases);
const repeatedReport = deriveLocalOutbreakWatch(ipcAcceptanceScenarioCases.repeatedSamePatientCreCases[0], repeatedMap, 7);
assert(
  repeatedReport.items.every((item) => item.patientAdjustedCount <= 1),
  "Repeated same-patient cultures must deduplicate and not inflate patient-adjusted counts.",
);

const noneMap = toAccessionsMap([ipcAcceptanceScenarioCases.negativeNoSignalCase]);
const noneReport = deriveLocalOutbreakWatch(ipcAcceptanceScenarioCases.negativeNoSignalCase, noneMap, 7);
assert(noneReport.summary === "no local cluster", "No comparable IPC cases should yield no local cluster.");

const summaryWords = `${clusterReport.summary} ${repeatedReport.summary} ${noneReport.summary}`;
assert(!summaryWords.includes("confirmed outbreak"), "Watch output must not claim confirmed outbreak.");

Date.now = originalDateNow;

// eslint-disable-next-line no-console
console.log("[ipcLocalWatch.test] all assertions passed");
