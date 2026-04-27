import { ipcAcceptanceScenarioCases, toAccessionsMap } from "../../fixtures/ipcAcceptanceCases";
import { deriveIPCOfficerQueue } from "../ipcQueue";

function assert(condition: unknown, message: string): void {
  if (!condition) throw new Error(message);
}

const fixedNow = Date.parse("2026-04-25T12:00:00.000Z");
const originalDateNow = Date.now;
Date.now = () => fixedNow;

const queueCases = [
  ipcAcceptanceScenarioCases.candidaAurisScreenPositiveCase,
  ipcAcceptanceScenarioCases.creSterileSiteCase,
  ipcAcceptanceScenarioCases.mrsaBloodstreamCase,
  ...ipcAcceptanceScenarioCases.creClearanceSeries,
  ipcAcceptanceScenarioCases.mrsaAdmissionScreenPositiveCase,
];
const queueMap = toAccessionsMap(queueCases);
const queue = deriveIPCOfficerQueue(
  ipcAcceptanceScenarioCases.candidaAurisScreenPositiveCase,
  queueMap,
);

const firstRoutineIndex = queue.findIndex((item) => item.priority === "routine");
const candidaHighIndex = queue.findIndex(
  (item) => item.relatedRuleCode === "CAURIS_ALERT" && item.queueType === "high_priority_signal",
);
const creHighIndex = queue.findIndex(
  (item) => item.relatedRuleCode === "CRE_ALERT" && item.queueType === "high_priority_signal",
);
assert(candidaHighIndex >= 0, "Candida auris high-priority signal should appear in queue.");
assert(creHighIndex >= 0, "CRE high-priority signal should appear in queue.");
assert(
  firstRoutineIndex === -1 || candidaHighIndex < firstRoutineIndex,
  "Candida auris high-priority signal should sort above routine items.",
);
assert(
  firstRoutineIndex === -1 || creHighIndex < firstRoutineIndex,
  "CRE high-priority signal should sort above routine items.",
);
assert(
  queue.some((item) => item.queueType === "colonisation_positive"),
  "Colonisation positives should appear in the IPC officer queue.",
);
assert(
  queue.some((item) => item.queueType === "clearance_incomplete"),
  "Clearance incomplete scenario should appear in the IPC officer queue.",
);
assert(
  queue.every(
    (item) =>
      item.limitationNote.toLowerCase().includes("browser-local") ||
      item.limitationNote.toLowerCase().includes("currently loaded"),
  ),
  "Queue items should include browser-local limitation note wording.",
);

Date.now = originalDateNow;

// eslint-disable-next-line no-console
console.log("[ipcQueue.test] all assertions passed");
