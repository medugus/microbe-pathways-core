import { IPC_RULES, type IPCReportVisibility, type IPCRule } from "../config/ipcRules";
import { IPCFlag } from "../domain/enums";
import type { Accession, IPCSignal, ValidationIssue } from "../domain/types";
import { newId } from "../domain/ids";

export interface IPCReleaseContext {
  signalCount: number;
  highPriorityCount: number;
  reviewSignalCount: number;
  openActionCount: number;
  hasReleaseBlockingRule: boolean;
}

const HIGH_PRIORITY_FLAGS = new Set<IPCFlag>([
  IPCFlag.CarbapenemResistant,
  IPCFlag.MDRO,
  IPCFlag.XDR,
]);

function getRuleForSignal(signal: IPCSignal): IPCRule | undefined {
  return IPC_RULES.find((rule) => rule.ruleCode === signal.ruleCode);
}

function isOpenSignal(signal: IPCSignal): boolean {
  return !signal.acknowledgedAt;
}

function isHighPrioritySignal(signal: IPCSignal, rule?: IPCRule): boolean {
  if (HIGH_PRIORITY_FLAGS.has(signal.flag)) return true;
  return rule?.timing === "immediate" || rule?.timing === "same_shift";
}

function isReviewSignal(rule?: IPCRule): boolean {
  if (!rule) return false;
  return rule.governanceStatus === "review_only" || rule.ruleCategory === "review";
}

function defaultReleaseImpact(signal: IPCSignal, rule?: IPCRule): "none" | "warning" | "blocker" {
  if (rule?.releaseImpact) return rule.releaseImpact;
  return isHighPrioritySignal(signal, rule) ? "warning" : "none";
}

export function getIPCReportVisibility(signal: IPCSignal, rule?: IPCRule): IPCReportVisibility {
  if (rule?.reportVisibility) return rule.reportVisibility;
  return "internal_only";
}

export function shouldShowIPCOnClinicianReport(signal: IPCSignal, rule?: IPCRule): boolean {
  return (
    getIPCReportVisibility(signal, rule) === "clinician_report" &&
    !!rule?.clinicianReportText?.trim()
  );
}

export function deriveIPCValidationIssues(accession: Accession): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  for (const signal of accession.ipc) {
    if (!isOpenSignal(signal)) continue;

    const rule = getRuleForSignal(signal);
    const releaseImpact = defaultReleaseImpact(signal, rule);
    const severity =
      rule?.validationSeverity ??
      (releaseImpact === "blocker" ? "blocker" : releaseImpact === "warning" ? "warning" : "info");

    if (severity === "info" && releaseImpact === "none") continue;

    if (severity === "blocker") {
      issues.push({
        id: newId("vi"),
        severity: "block",
        code: `IPC_RELEASE_BLOCKER_${signal.ruleCode}`,
        section: "release",
        message: `Open IPC signal: ${signal.ruleCode}. Rule metadata marks this as release-blocking until IPC action is acknowledged.`,
      });
      continue;
    }

    if (isHighPrioritySignal(signal, rule)) {
      issues.push({
        id: newId("vi"),
        severity: "warn",
        code: `IPC_HIGH_PRIORITY_${signal.ruleCode}`,
        section: "release",
        message: `Open IPC high-priority signal: ${signal.ruleCode}. Confirm IPC action/notification before release.`,
      });
      continue;
    }

    issues.push({
      id: newId("vi"),
      severity: severity === "warning" ? "warn" : "info",
      code: `IPC_SIGNAL_${signal.ruleCode}`,
      section: "release",
      message: `Open IPC signal: ${signal.ruleCode}. Review IPC governance notes before release.`,
    });
  }

  return issues;
}

export function deriveIPCReleaseContext(accession: Accession): IPCReleaseContext | null {
  const openSignals = accession.ipc.filter(isOpenSignal);
  if (openSignals.length === 0) return null;

  let highPriorityCount = 0;
  let reviewSignalCount = 0;
  let openActionCount = 0;
  let hasReleaseBlockingRule = false;

  for (const signal of openSignals) {
    const rule = getRuleForSignal(signal);
    if (isHighPrioritySignal(signal, rule)) highPriorityCount += 1;
    if (isReviewSignal(rule)) reviewSignalCount += 1;
    openActionCount += rule?.actions.length ?? 0;
    hasReleaseBlockingRule =
      hasReleaseBlockingRule || defaultReleaseImpact(signal, rule) === "blocker";
  }

  if (highPriorityCount === 0 && reviewSignalCount === 0) return null;

  return {
    signalCount: openSignals.length,
    highPriorityCount,
    reviewSignalCount,
    openActionCount,
    hasReleaseBlockingRule,
  };
}

export function deriveIPCInternalReportNotes(accession: Accession): string[] {
  const notes: string[] = [];

  for (const signal of accession.ipc) {
    if (!isOpenSignal(signal)) continue;
    const rule = getRuleForSignal(signal);
    const visibility = getIPCReportVisibility(signal, rule);
    if (visibility === "none" || visibility === "clinician_report") continue;

    notes.push(`Internal IPC note — not clinician-facing: ${signal.ruleCode}. ${signal.message}`);
  }

  return notes;
}
