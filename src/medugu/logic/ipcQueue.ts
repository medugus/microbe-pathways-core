import { getOrganism } from "../config/organisms";
import type { Accession, MeduguState } from "../domain/types";
import type { IPCDecision } from "./ipcEngine";
import { evaluateIPC } from "./ipcEngine";
import { deriveColonisationContext } from "./ipcColonisation";
import { deriveLocalOutbreakWatch } from "./ipcLocalWatch";

export type IPCQueueType =
  | "high_priority_signal"
  | "open_action"
  | "colonisation_positive"
  | "clearance_incomplete"
  | "possible_cluster"
  | "review";

export type IPCQueuePriorityLevel = "critical" | "high" | "review" | "routine";

export type IPCQueueItem = {
  id: string;
  accessionNumber?: string;
  patientLabel?: string;
  ward?: string;
  specimenLabel?: string;
  organismOrPhenotype?: string;
  queueType: IPCQueueType;
  priority: IPCQueuePriorityLevel;
  reason: string;
  recommendedAction: string;
  relatedRuleCode?: string;
  dueLabel?: string;
  ageHours?: number;
  limitationNote: string;
};

const HIGH_PRIORITY_RULE_CODES = new Set(["CAURIS_ALERT", "CRE_ALERT", "CRAB_ALERT", "CRPA_ALERT"]);
const REVIEW_RULE_CODES = new Set(["MRSA_ALERT", "VRE_ALERT"]);

const LIMITATION_NOTE =
  "Browser-local queue across currently loaded cases; requires backend persistence for hospital-wide task management.";

const ACTION_LABELS: Record<string, string> = {
  contact_precautions: "contact precautions",
  contact_plus_precautions: "contact-plus precautions",
  droplet_precautions: "droplet precautions",
  airborne_precautions: "airborne precautions",
  single_room: "single room",
  cohort_room: "cohort room",
  enhanced_environmental_cleaning: "enhanced environmental cleaning",
  notify_ipc_team: "notify IPC team",
  notify_attending: "notify attending clinician",
  notify_public_health: "notify public health",
  screen_contacts: "screen contacts",
};

function toPatientLabel(accession: Accession): string {
  const given = accession.patient.givenName?.trim();
  const family = accession.patient.familyName?.trim();
  const combined = [given, family].filter(Boolean).join(" ");
  return combined || accession.patient.mrn || "not available";
}

function toAgeHours(accession: Accession): number | undefined {
  const timestamp = accession.specimen.collectedAt ?? accession.specimen.receivedAt ?? accession.createdAt;
  const ms = Date.parse(timestamp);
  if (!Number.isFinite(ms)) return undefined;
  const age = (Date.now() - ms) / 3_600_000;
  return age >= 0 ? Math.round(age) : undefined;
}

function dueLabelForTiming(timing: IPCDecision["timing"]): string {
  if (timing === "immediate") return "Immediate escalation";
  if (timing === "same_shift") return "Due same shift";
  if (timing === "within_24h") return "Due within 24h";
  return "Next business day";
}

function actionSummary(actions: string[]): string {
  if (actions.length === 0) return "Review IPC context according to local policy.";
  return actions.map((action) => ACTION_LABELS[action] ?? action.replaceAll("_", " ")).join(", ");
}

function decisionPriority(decision: IPCDecision): IPCQueuePriorityLevel {
  if (HIGH_PRIORITY_RULE_CODES.has(decision.ruleCode) || decision.timing === "immediate") return "critical";
  if (REVIEW_RULE_CODES.has(decision.ruleCode) || decision.timing === "same_shift") return "high";
  if (decision.timing === "within_24h") return "review";
  return "routine";
}

function queueTypeForDecision(decision: IPCDecision): IPCQueueType {
  if (HIGH_PRIORITY_RULE_CODES.has(decision.ruleCode) || decision.timing === "immediate") {
    return "high_priority_signal";
  }
  return "review";
}

export function getIPCQueueReason(item: IPCQueueItem): string {
  if (item.reason.trim().length > 0) return item.reason;

  if (item.queueType === "open_action") return "Open IPC action inferred from signal metadata in browser phase.";
  if (item.queueType === "colonisation_positive") return "Positive colonisation screen requires IPC review.";
  if (item.queueType === "clearance_incomplete") return "Clearance attempt is incomplete and needs follow-up.";
  if (item.queueType === "possible_cluster") return "Local outbreak watch flagged a possible cluster among currently loaded cases.";
  if (item.queueType === "high_priority_signal") return "High-priority IPC signal requires rapid escalation.";
  return "Review-level IPC signal among currently loaded cases.";
}

export function getIPCQueuePriority(item: IPCQueueItem): number {
  const priorityWeight: Record<IPCQueuePriorityLevel, number> = {
    critical: 700,
    high: 600,
    review: 500,
    routine: 400,
  };

  const typeWeight: Record<IPCQueueType, number> = {
    high_priority_signal: 90,
    possible_cluster: 80,
    open_action: 70,
    colonisation_positive: 60,
    clearance_incomplete: 50,
    review: 40,
  };

  return priorityWeight[item.priority] + typeWeight[item.queueType];
}

export function sortIPCQueueItems(items: IPCQueueItem[]): IPCQueueItem[] {
  return [...items].sort((a, b) => {
    const priorityDelta = getIPCQueuePriority(b) - getIPCQueuePriority(a);
    if (priorityDelta !== 0) return priorityDelta;

    const ageA = a.ageHours ?? -1;
    const ageB = b.ageHours ?? -1;
    if (ageB !== ageA) return ageB - ageA;

    return (a.accessionNumber ?? "").localeCompare(b.accessionNumber ?? "");
  });
}

export function deriveIPCOfficerQueue(
  currentAccession: Accession,
  allAccessions: MeduguState["accessions"],
): IPCQueueItem[] {
  const loaded = Object.values(allAccessions);
  if (loaded.length === 0) return [];

  const queue: IPCQueueItem[] = [];

  for (const accession of loaded) {
    const report = evaluateIPC(accession, allAccessions);
    const signalMap = new Map(accession.ipc.map((signal) => [`${signal.ruleCode}|${signal.organismCode ?? ""}`, signal]));

    for (const decision of report.decisions) {
      const signalKey = `${decision.ruleCode}|${decision.organismCode ?? ""}`;
      const signal = signalMap.get(signalKey);
      const organismLabel = decision.organismCode
        ? getOrganism(decision.organismCode)?.display ?? decision.organismCode
        : undefined;
      const phenotypeLabel = decision.phenotypes.length > 0 ? decision.phenotypes.join(", ") : undefined;
      const organismOrPhenotype = [organismLabel, phenotypeLabel].filter(Boolean).join(" · ") || undefined;

      queue.push({
        id: `${accession.id}:${decision.ruleCode}:signal`,
        accessionNumber: accession.accessionNumber,
        patientLabel: toPatientLabel(accession),
        ward: accession.patient.ward,
        specimenLabel: accession.specimen.freeTextLabel ?? accession.specimen.subtypeCode,
        organismOrPhenotype,
        queueType: queueTypeForDecision(decision),
        priority: decisionPriority(decision),
        reason: decision.message,
        recommendedAction: actionSummary(decision.actions),
        relatedRuleCode: decision.ruleCode,
        dueLabel: dueLabelForTiming(decision.timing),
        ageHours: toAgeHours(accession),
        limitationNote: LIMITATION_NOTE,
      });

      if (decision.actions.length > 0 && !signal?.acknowledgedAt) {
        queue.push({
          id: `${accession.id}:${decision.ruleCode}:open-action`,
          accessionNumber: accession.accessionNumber,
          patientLabel: toPatientLabel(accession),
          ward: accession.patient.ward,
          specimenLabel: accession.specimen.freeTextLabel ?? accession.specimen.subtypeCode,
          organismOrPhenotype,
          queueType: "open_action",
          priority: decision.timing === "immediate" ? "high" : "review",
          reason: `Open IPC action inferred from signal metadata (${decision.actions.length} pending action${decision.actions.length === 1 ? "" : "s"}).`,
          recommendedAction: `Follow IPC action checklist: ${actionSummary(decision.actions)}.`,
          relatedRuleCode: decision.ruleCode,
          dueLabel: dueLabelForTiming(decision.timing),
          ageHours: toAgeHours(accession),
          limitationNote: LIMITATION_NOTE,
        });
      }
    }

    const colonisation = deriveColonisationContext(accession, allAccessions);
    if (colonisation.isScreen && colonisation.screenResult === "positive") {
      queue.push({
        id: `${accession.id}:colonisation-positive`,
        accessionNumber: accession.accessionNumber,
        patientLabel: toPatientLabel(accession),
        ward: accession.patient.ward,
        specimenLabel: accession.specimen.freeTextLabel ?? accession.specimen.subtypeCode,
        organismOrPhenotype: colonisation.targetOrganism,
        queueType: "colonisation_positive",
        priority: colonisation.targetOrganism?.toLowerCase().includes("auris") ? "critical" : "high",
        reason: `Positive colonisation screen (${colonisation.screenPurpose ?? "unknown"}) with carrier status ${colonisation.episodeStatus ?? "not available"}.`,
        recommendedAction:
          colonisation.nextAction ??
          "Review colonisation result, apply local precautions, and arrange follow-up screen according to policy.",
        dueLabel: "Review this shift",
        ageHours: toAgeHours(accession),
        limitationNote: colonisation.limitationNote ?? LIMITATION_NOTE,
      });
    }

    if (
      colonisation.isScreen &&
      colonisation.episodeStatus === "clearance_attempt" &&
      typeof colonisation.clearanceCount === "number" &&
      typeof colonisation.clearanceRequired === "number"
    ) {
      queue.push({
        id: `${accession.id}:clearance-incomplete`,
        accessionNumber: accession.accessionNumber,
        patientLabel: toPatientLabel(accession),
        ward: accession.patient.ward,
        specimenLabel: accession.specimen.freeTextLabel ?? accession.specimen.subtypeCode,
        organismOrPhenotype: colonisation.targetOrganism,
        queueType: "clearance_incomplete",
        priority: "review",
        reason: `Clearance incomplete: ${colonisation.clearanceCount}/${colonisation.clearanceRequired} consecutive negative screens.`,
        recommendedAction:
          colonisation.nextAction ??
          "Continue precautions and schedule remaining clearance screens per local policy.",
        dueLabel: "Follow-up due",
        ageHours: toAgeHours(accession),
        limitationNote: colonisation.limitationNote ?? LIMITATION_NOTE,
      });
    }
  }

  const localWatch = deriveLocalOutbreakWatch(currentAccession, allAccessions);
  for (const watch of localWatch.signalItems) {
    queue.push({
      id: `local-watch:${watch.id}`,
      ward: watch.ward,
      organismOrPhenotype: [watch.organismLabel, watch.phenotypeLabel].filter(Boolean).join(" / ") || undefined,
      queueType: "possible_cluster",
      priority: watch.severity === "high" ? "critical" : watch.severity === "watch" ? "high" : "review",
      reason: watch.triggerSummary,
      recommendedAction: watch.recommendedAction,
      dueLabel: watch.severity === "high" ? "Immediate IPC huddle" : "Review cluster linkage",
      limitationNote: watch.limitationNote,
    });
  }

  return sortIPCQueueItems(queue.map((item) => ({ ...item, reason: getIPCQueueReason(item) })));
}
