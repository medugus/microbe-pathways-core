import { ipcAcceptanceScenarioCases } from "../../fixtures/ipcAcceptanceCases";
import { evaluateIPC } from "../ipcEngine";

function assert(condition: unknown, message: string): void {
  if (!condition) throw new Error(message);
}

const cre = evaluateIPC(ipcAcceptanceScenarioCases.creSterileSiteCase);
assert(cre.decisions.some((decision) => decision.ruleCode === "CRE_ALERT"), "CRE sterile-site case must trigger CRE_ALERT.");
assert(
  cre.decisions.some((decision) => decision.ruleCode === "CRE_ALERT" && decision.timing === "immediate"),
  "CRE sterile-site case must be immediate/high-priority.",
);

const mrsa = evaluateIPC(ipcAcceptanceScenarioCases.mrsaBloodstreamCase);
assert(mrsa.decisions.some((decision) => decision.ruleCode === "MRSA_ALERT"), "MRSA bloodstream case must trigger MRSA_ALERT.");

const vre = evaluateIPC(ipcAcceptanceScenarioCases.vreCase);
assert(vre.decisions.some((decision) => decision.ruleCode === "VRE_ALERT"), "VRE case must trigger VRE_ALERT.");

const cauris = evaluateIPC(ipcAcceptanceScenarioCases.candidaAurisScreenPositiveCase);
assert(cauris.decisions.some((decision) => decision.ruleCode === "CAURIS_ALERT"), "Candida auris case must trigger CAURIS_ALERT.");
assert(
  cauris.decisions.some((decision) => decision.ruleCode === "CAURIS_ALERT" && decision.timing === "immediate"),
  "Candida auris signal must be immediate/high-priority.",
);

const noSignal = evaluateIPC(ipcAcceptanceScenarioCases.negativeNoSignalCase);
assert(noSignal.decisions.length === 0, "Negative/no-signal case should produce no IPC signals.");

// eslint-disable-next-line no-console
console.log("[ipcEngine.test] all assertions passed");
