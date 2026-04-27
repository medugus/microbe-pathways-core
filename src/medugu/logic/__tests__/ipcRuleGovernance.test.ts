import { IPC_RULES } from "../../config/ipcRules";
import type { IPCSignal } from "../../domain/types";
import { IPCFlag } from "../../domain/enums";
import { getIPCRuleGovernanceSummary, getRuleForSignal } from "../ipcRuleGovernance";

function assert(condition: unknown, message: string): void {
  if (!condition) throw new Error(message);
}

const fixedNow = Date.parse("2026-04-25T12:00:00.000Z");
const originalDateNow = Date.now;
Date.now = () => fixedNow;

const summary = getIPCRuleGovernanceSummary(IPC_RULES);
assert(
  summary.totalRules === IPC_RULES.length,
  "Governance summary should count all configured IPC rules.",
);
assert(
  summary.rulesWithoutActions === IPC_RULES.filter((rule) => rule.actions.length === 0).length,
  "Rules missing actions should be flagged in governance summary.",
);
assert(
  summary.rulesWithoutNotificationTargets ===
    IPC_RULES.filter((rule) => rule.notify.length === 0).length,
  "Rules missing notification targets should be flagged in governance summary.",
);

const linkedSignal: IPCSignal = {
  id: "ipc_test_signal",
  flag: IPCFlag.MDRO,
  ruleCode: "CRE_ALERT",
  message: "test",
  raisedAt: "2026-04-25T10:00:00.000Z",
};
const matchedRule = getRuleForSignal(linkedSignal, IPC_RULES);
assert(
  matchedRule?.ruleCode === "CRE_ALERT",
  "getRuleForSignal should resolve a matching rule when available.",
);

const unlinkedSignal: IPCSignal = {
  id: "ipc_unknown_signal",
  flag: IPCFlag.AlertOrganism,
  ruleCode: "UNKNOWN_RULE",
  message: "test",
  raisedAt: "2026-04-25T10:00:00.000Z",
};
assert(
  getRuleForSignal(unlinkedSignal, IPC_RULES) === undefined,
  "Unknown signal rule codes should not be force-matched.",
);

Date.now = originalDateNow;

// eslint-disable-next-line no-console
console.log("[ipcRuleGovernance.test] all assertions passed");
