import { ipcAcceptanceScenarioCases, toAccessionsMap } from "../../fixtures/ipcAcceptanceCases";
import { deriveIPCOfficerQueue } from "../ipcQueue";

function assert(condition: unknown, message: string): void {
  if (!condition) throw new Error(message);
}

const queueCases = [
  ipcAcceptanceScenarioCases.candidaAurisScreenPositiveCase,
  ipcAcceptanceScenarioCases.creSterileSiteCase,
  ipcAcceptanceScenarioCases.mrsaBloodstreamCase,
  ...ipcAcceptanceScenarioCases.creClearanceSeries,
  ipcAcceptanceScenarioCases.mrsaAdmissionScreenPositiveCase,
];
const queueMap = toAccessionsMap(queueCases);
const queue = deriveIPCOfficerQueue(ipcAcceptanceScenarioCases.candidaAurisScreenPositiveCase, queueMap);

const topPriorities = queue.slice(0, 4).map((item) => item.priority);
assert(topPriorities.includes("critical"), "High-priority Candida auris/CRE items should appear near queue top.");
assert(
  queue.some((item) => item.queueType === "colonisation_positive"),
  "Colonisation positives should appear in the IPC officer queue.",
);
assert(
  queue.some((item) => item.queueType === "clearance_incomplete"),
  "Clearance incomplete scenario should appear in the IPC officer queue.",
);
assert(
  queue.every((item) => item.limitationNote.toLowerCase().includes("browser-local") || item.limitationNote.toLowerCase().includes("currently loaded")),
  "Queue items should include browser-local limitation note wording.",
);

// eslint-disable-next-line no-console
console.log("[ipcQueue.test] all assertions passed");
