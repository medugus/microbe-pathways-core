import type { Accession } from "../domain/types";
import { runValidation } from "./validationEngine";
import { evaluateIPC } from "./ipcEngine";
import { deriveColonisationContext, isColonisationScreen } from "./ipcColonisation";
import { deriveLocalOutbreakWatch } from "./ipcLocalWatch";
import { approvalStatusForRow, isRestrictedRow, latestApprovalForRow } from "./amsEngine";
import { SPECIMEN_FAMILIES } from "../config/specimenFamilies";
import { getBottleResults, isPositiveBottle } from "./bloodBottles";

export type OperationalQueueCategory =
  | "critical_result"
  | "release_blocker"
  | "validation_warning"
  | "ipc_high_priority"
  | "ipc_action"
  | "ipc_outbreak_watch"
  | "colonisation_follow_up"
  | "ams_restricted"
  | "ams_pending_approval"
  | "consultant_approval"
  | "phone_out"
  | "routine_review";

export type OperationalQueuePriority = "critical" | "high" | "review" | "routine";

export type OperationalQueueOwnerRole =
  | "bench_scientist"
  | "senior_scientist"
  | "consultant_microbiologist"
  | "ams_pharmacist"
  | "ipc_officer"
  | "mixed";

export type OperationalQueueSourceModule = "IPC" | "AMS" | "Validation" | "Release" | "AST" | "Specimen";
export type OperationalQueueTargetSection =
  | "IPC"
  | "AMS"
  | "Validation"
  | "Release"
  | "AST"
  | "Specimen"
  | "Report"
  | "Dashboard";

export type OperationalQueueItem = {
  id: string;
  accessionId: string;
  targetAccessionId: string;
  targetSection: OperationalQueueTargetSection;
  accessionNumber?: string;
  patientLabel?: string;
  ward?: string;
  specimenLabel?: string;
  organismOrPhenotype?: string;
  category: OperationalQueueCategory;
  priority: OperationalQueuePriority;
  reason: string;
  recommendedAction: string;
  ownerRole: OperationalQueueOwnerRole;
  dueLabel?: string;
  ageHours?: number;
  sourceModule: OperationalQueueSourceModule;
  limitationNote?: string;
};

type OperationalQueueItemDraft = Omit<OperationalQueueItem, "targetAccessionId" | "targetSection">;

export type OperationalDashboardSummary = {
  totalLoadedCases: number;
  openQueueItems: number;
  criticalOrHighPriorityQueueItems: number;
  criticalUrgentCases: number;
  releaseBlocked: number;
  pendingPhoneOut: number;
  pendingConsultantApproval: number;
  amsPendingOrRestricted: number;
  ipcHighPriority: number;
  colonisationOrClearanceFollowUp: number;
  releasedOrCompletedCases: number;
  noActionCases: number;
  medianOpenQueueAgeHours: number | null;
};

export type OperationalDashboardData = {
  items: OperationalQueueItem[];
  summary: OperationalDashboardSummary;
  limitationNote: string;
};

const HIGH_PRIORITY_IPC_RULE_CODES = new Set([
  "CRE_ALERT",
  "CRAB_ALERT",
  "CRPA_ALERT",
  "VRE_ALERT",
  "MRSA_ALERT",
  "CAURIS_ALERT",
  "CDI_ALERT",
  "ESBL_INVASIVE_ALERT",
]);

const STERILE_SITE_KEYWORD_RE = /(sterile|csf|pleural|ascitic|synovial|pericardial|spa|image_guided)/i;

function toPatientLabel(accession: Accession): string {
  const name = [accession.patient.givenName, accession.patient.familyName].filter(Boolean).join(" ").trim();
  return name || accession.patient.mrn || accession.accessionNumber;
}

function toSpecimenLabel(accession: Accession): string {
  return accession.specimen.freeTextLabel ?? accession.specimen.subtypeCode;
}

function toAgeHours(accession: Accession): number | undefined {
  const base = accession.specimen.collectedAt ?? accession.specimen.receivedAt ?? accession.createdAt;
  const ms = Date.parse(base);
  if (!Number.isFinite(ms)) return undefined;
  return Math.max(0, Math.round((Date.now() - ms) / 3_600_000));
}

function normaliseAccessions(accessions: Record<string, Accession> | Accession[]): Accession[] {
  return Array.isArray(accessions) ? accessions : Object.values(accessions);
}

function isSterileSite(accession: Accession): boolean {
  const family = SPECIMEN_FAMILIES.find((f) => f.code === accession.specimen.familyCode);
  const subtype = family?.subtypes.find((s) => s.code === accession.specimen.subtypeCode);
  if (subtype?.tags?.includes("sterile_site")) return true;

  const haystack = `${accession.specimen.familyCode} ${accession.specimen.subtypeCode} ${accession.specimen.freeTextLabel ?? ""}`;
  return STERILE_SITE_KEYWORD_RE.test(haystack);
}

function hasPositiveBloodCulture(accession: Accession): boolean {
  if (accession.specimen.familyCode !== "BLOOD") return false;
  if (accession.isolates.some((iso) => iso.organismCode !== "NOGRO")) return true;
  return getBottleResults(accession).some(isPositiveBottle);
}

function hasSignificantResult(accession: Accession): boolean {
  return accession.isolates.some((iso) => iso.significance === "significant" && iso.organismCode !== "NOGRO");
}

function targetSectionForItem(item: OperationalQueueItemDraft): OperationalQueueTargetSection {
  if (item.category === "ipc_high_priority" || item.category === "ipc_action" || item.category === "ipc_outbreak_watch") {
    return "IPC";
  }
  if (item.category === "colonisation_follow_up") return "IPC";
  if (item.category === "ams_restricted" || item.category === "ams_pending_approval") return "AMS";
  if (item.category === "validation_warning") return "Validation";
  if (item.category === "release_blocker" || item.category === "consultant_approval" || item.category === "phone_out") {
    return "Release";
  }
  if (item.category === "critical_result") return "Validation";
  if (item.category === "routine_review") {
    if (item.sourceModule === "IPC") return "IPC";
    if (item.sourceModule === "AMS") return "AMS";
    if (item.sourceModule === "Validation") return "Validation";
    if (item.sourceModule === "Release") return "Release";
    if (item.sourceModule === "AST") return "AST";
    if (item.sourceModule === "Specimen") return "Specimen";
    return "Dashboard";
  }
  return "Dashboard";
}

function pushItem(queue: OperationalQueueItem[], item: OperationalQueueItemDraft) {
  queue.push({
    ...item,
    targetAccessionId: item.accessionId,
    targetSection: targetSectionForItem(item),
    reason: item.reason.trim() || "Operational review required.",
  });
}

export function getOperationalPriority(item: OperationalQueueItem): number {
  const categoryWeight: Record<OperationalQueueCategory, number> = {
    critical_result: 1000,
    release_blocker: 900,
    phone_out: 800,
    consultant_approval: 700,
    ipc_high_priority: 600,
    ipc_action: 560,
    ipc_outbreak_watch: 500,
    ams_pending_approval: 400,
    ams_restricted: 390,
    colonisation_follow_up: 300,
    validation_warning: 200,
    routine_review: 100,
  };

  const priorityWeight: Record<OperationalQueuePriority, number> = {
    critical: 40,
    high: 30,
    review: 20,
    routine: 10,
  };

  return categoryWeight[item.category] + priorityWeight[item.priority];
}

export function sortOperationalQueueItems(items: OperationalQueueItem[]): OperationalQueueItem[] {
  return [...items].sort((a, b) => {
    const p = getOperationalPriority(b) - getOperationalPriority(a);
    if (p !== 0) return p;

    const dueA = a.dueLabel?.toLowerCase().includes("overdue") ? 1 : 0;
    const dueB = b.dueLabel?.toLowerCase().includes("overdue") ? 1 : 0;
    if (dueB !== dueA) return dueB - dueA;

    const ageA = a.ageHours ?? -1;
    const ageB = b.ageHours ?? -1;
    if (ageB !== ageA) return ageB - ageA;

    const statA = a.reason.toLowerCase().includes("stat") ? 1 : 0;
    const statB = b.reason.toLowerCase().includes("stat") ? 1 : 0;
    if (statB !== statA) return statB - statA;

    return (a.accessionNumber ?? "").localeCompare(b.accessionNumber ?? "");
  });
}

export function deriveOperationalQueueItems(
  accessions: Record<string, Accession> | Accession[],
): OperationalQueueItem[] {
  const loaded = normaliseAccessions(accessions);
  const byId = Object.fromEntries(loaded.map((a) => [a.id, a]));
  const queue: OperationalQueueItem[] = [];

  for (const accession of loaded) {
    const validation = runValidation(accession);
    const ipc = evaluateIPC(accession, byId);
    const colonisation = deriveColonisationContext(accession, byId);
    const ageHours = toAgeHours(accession);

    const hasPhoneOutRequirement = validation.phoneOutRequiredPending;
    const hasCriticalPriority = accession.priority === "stat" || accession.priority === "urgent";
    const isCsf = /csf/i.test(`${accession.specimen.subtypeCode} ${accession.specimen.freeTextLabel ?? ""}`);
    const positiveBlood = hasPositiveBloodCulture(accession);
    const hasHighRiskIpcSignal = ipc.decisions.some((d) => HIGH_PRIORITY_IPC_RULE_CODES.has(d.ruleCode));

    if (
      hasPhoneOutRequirement ||
      positiveBlood ||
      isCsf ||
      (isSterileSite(accession) && hasHighRiskIpcSignal) ||
      (hasCriticalPriority && hasSignificantResult(accession))
    ) {
      pushItem(queue, {
        id: `${accession.id}:critical-result`,
        accessionId: accession.id,
        accessionNumber: accession.accessionNumber,
        patientLabel: toPatientLabel(accession),
        ward: accession.patient.ward,
        specimenLabel: toSpecimenLabel(accession),
        organismOrPhenotype: accession.isolates.find((i) => i.organismCode !== "NOGRO")?.organismDisplay,
        category: "critical_result",
        priority: "critical",
        reason:
          validation.phoneOutRequiredPending
            ? "Critical communication pathway flagged this accession and phone-out remains pending."
            : positiveBlood
              ? "Positive blood culture requires urgent review and escalation."
              : isCsf
                ? "CSF specimen requires urgent consultant-facing review."
                : "Sterile-site high-risk signal requires urgent escalation.",
        recommendedAction:
          "Prioritise immediate review, confirm critical communication completion, and progress urgent clinical escalation.",
        ownerRole: "mixed",
        dueLabel: "Immediate",
        ageHours,
        sourceModule: "Validation",
        limitationNote: describeOperationalDashboardLimitations(),
      });
    }

    if (validation.blockers.length > 0) {
      pushItem(queue, {
        id: `${accession.id}:release-blocker`,
        accessionId: accession.id,
        accessionNumber: accession.accessionNumber,
        patientLabel: toPatientLabel(accession),
        ward: accession.patient.ward,
        specimenLabel: toSpecimenLabel(accession),
        category: "release_blocker",
        priority: "high",
        reason: `${validation.blockers.length} validation blocker(s) currently prevent release.`,
        recommendedAction: "Resolve blocking validation/release requirements before final release.",
        ownerRole: "senior_scientist",
        dueLabel: "Overdue until resolved",
        ageHours,
        sourceModule: "Release",
        limitationNote: describeOperationalDashboardLimitations(),
      });
    }

    const unacknowledgedPhoneOut = accession.phoneOuts.some((p) => !p.acknowledged);
    if (validation.phoneOutRequiredPending || unacknowledgedPhoneOut) {
      pushItem(queue, {
        id: `${accession.id}:phone-out`,
        accessionId: accession.id,
        accessionNumber: accession.accessionNumber,
        patientLabel: toPatientLabel(accession),
        ward: accession.patient.ward,
        specimenLabel: toSpecimenLabel(accession),
        category: "phone_out",
        priority: "high",
        reason: validation.phoneOutRequiredPending
          ? "Phone-out is required and not documented as acknowledged."
          : "At least one phone-out event remains unacknowledged.",
        recommendedAction: "Document and acknowledge phone-out communication with clinician recipient.",
        ownerRole: "senior_scientist",
        dueLabel: "Immediate",
        ageHours,
        sourceModule: "Release",
        limitationNote: describeOperationalDashboardLimitations(),
      });
    }

    if (validation.consultantApprovalPending || (isCsf && !accession.release.consultantApproval)) {
      pushItem(queue, {
        id: `${accession.id}:consultant-approval`,
        accessionId: accession.id,
        accessionNumber: accession.accessionNumber,
        patientLabel: toPatientLabel(accession),
        ward: accession.patient.ward,
        specimenLabel: toSpecimenLabel(accession),
        category: "consultant_approval",
        priority: "high",
        reason: "Consultant approval is pending before release completion.",
        recommendedAction: "Record consultant microbiologist approval/sign-off prior to release.",
        ownerRole: "consultant_microbiologist",
        ageHours,
        sourceModule: "Release",
        limitationNote: describeOperationalDashboardLimitations(),
      });
    }

    for (const decision of ipc.decisions) {
      const organism = accession.isolates.find((iso) => iso.id === decision.isolateId)?.organismDisplay;
      const phenotype = decision.phenotypes.join(", ");
      const organismOrPhenotype = [organism, phenotype].filter(Boolean).join(" · ") || undefined;
      const highPriority =
        HIGH_PRIORITY_IPC_RULE_CODES.has(decision.ruleCode) ||
        decision.timing === "immediate" ||
        decision.timing === "same_shift";

      pushItem(queue, {
        id: `${accession.id}:ipc:${decision.ruleCode}:${decision.isolateId}`,
        accessionId: accession.id,
        accessionNumber: accession.accessionNumber,
        patientLabel: toPatientLabel(accession),
        ward: accession.patient.ward,
        specimenLabel: toSpecimenLabel(accession),
        organismOrPhenotype,
        category: highPriority ? "ipc_high_priority" : "ipc_action",
        priority: highPriority ? "high" : "review",
        reason: decision.message,
        recommendedAction:
          decision.actions.length > 0
            ? `Execute IPC actions: ${decision.actions.join(", ").replaceAll("_", " ")}.`
            : "Review IPC context and complete relevant preventive controls.",
        ownerRole: "ipc_officer",
        dueLabel:
          decision.timing === "immediate"
            ? "Immediate"
            : decision.timing === "same_shift"
              ? "Same shift"
              : decision.timing === "within_24h"
                ? "Within 24h"
                : "Routine",
        ageHours,
        sourceModule: "IPC",
        limitationNote: describeOperationalDashboardLimitations(),
      });
    }

    const restrictedRows = accession.ast.filter((row) => isRestrictedRow(row));
    for (const row of restrictedRows) {
      const status = approvalStatusForRow(accession, row.id);
      if (status === "approved") continue;
      const latest = latestApprovalForRow(accession, row.id);
      const isPending = status === "pending";
      pushItem(queue, {
        id: `${accession.id}:ams:${row.id}`,
        accessionId: accession.id,
        accessionNumber: accession.accessionNumber,
        patientLabel: toPatientLabel(accession),
        ward: accession.patient.ward,
        specimenLabel: toSpecimenLabel(accession),
        organismOrPhenotype: accession.isolates.find((iso) => iso.id === row.isolateId)?.organismDisplay,
        category: isPending ? "ams_pending_approval" : "ams_restricted",
        priority: isPending ? "high" : "review",
        reason: isPending
          ? `Restricted antimicrobial ${row.antibioticCode} is pending AMS approval.`
          : `Restricted antimicrobial ${row.antibioticCode} is not yet approved (status: ${status}).`,
        recommendedAction: isPending
          ? "AMS pharmacist to approve/deny request and document decision note."
          : "Request AMS approval for restricted antimicrobial before clinical visibility.",
        ownerRole: "ams_pharmacist",
        dueLabel: latest?.dueBy
          ? (new Date(latest.dueBy).getTime() < Date.now() ? "Overdue AMS" : "AMS due")
          : undefined,
        ageHours,
        sourceModule: "AMS",
        limitationNote: describeOperationalDashboardLimitations(),
      });
    }

    if (colonisation.isScreen) {
      const incompleteClearance =
        colonisation.episodeStatus === "clearance_attempt" &&
        typeof colonisation.clearanceCount === "number" &&
        typeof colonisation.clearanceRequired === "number" &&
        colonisation.clearanceCount < colonisation.clearanceRequired;
      const positiveScreen = colonisation.screenResult === "positive";

      if (positiveScreen || incompleteClearance) {
        pushItem(queue, {
          id: `${accession.id}:colonisation-follow-up`,
          accessionId: accession.id,
          accessionNumber: accession.accessionNumber,
          patientLabel: toPatientLabel(accession),
          ward: accession.patient.ward,
          specimenLabel: toSpecimenLabel(accession),
          organismOrPhenotype: colonisation.targetOrganism,
          category: "colonisation_follow_up",
          priority: positiveScreen && /auris/i.test(colonisation.targetOrganism ?? "") ? "high" : "review",
          reason: positiveScreen
            ? "Positive colonisation screen requires IPC follow-up and precaution review."
            : `Clearance incomplete (${colonisation.clearanceCount}/${colonisation.clearanceRequired} negative screens).`,
          recommendedAction:
            colonisation.nextAction ??
            "Continue colonisation follow-up workflow and schedule next required screen.",
          ownerRole: "ipc_officer",
          dueLabel: positiveScreen ? "Same shift" : "Follow-up due",
          ageHours,
          sourceModule: isColonisationScreen(accession) ? "IPC" : "Specimen",
          limitationNote: colonisation.limitationNote ?? describeOperationalDashboardLimitations(),
        });
      }
    }

    for (const warning of validation.warnings) {
      pushItem(queue, {
        id: `${accession.id}:validation-warning:${warning.code}`,
        accessionId: accession.id,
        accessionNumber: accession.accessionNumber,
        patientLabel: toPatientLabel(accession),
        ward: accession.patient.ward,
        specimenLabel: toSpecimenLabel(accession),
        category: "validation_warning",
        priority: "review",
        reason: warning.message,
        recommendedAction: "Review warning and complete remediation where clinically required.",
        ownerRole: "bench_scientist",
        ageHours,
        sourceModule: "Validation",
        limitationNote: describeOperationalDashboardLimitations(),
      });
    }
  }

  if (loaded.length > 0) {
    const reference = loaded[0];
    const watch = deriveLocalOutbreakWatch(reference, byId);
    for (const item of watch.signalItems) {
      pushItem(queue, {
        id: `outbreak-watch:${item.id}`,
        accessionId: item.relatedAccessions[0] ?? reference.id,
        accessionNumber: item.relatedAccessions[0],
        patientLabel: `Cluster (${item.patientAdjustedCount} cases)`,
        ward: item.ward,
        specimenLabel: `Window ${item.windowDays}d`,
        organismOrPhenotype: [item.organismLabel, item.phenotypeLabel].filter(Boolean).join(" / ") || undefined,
        category: "ipc_outbreak_watch",
        priority: item.severity === "high" ? "high" : "review",
        reason: item.triggerSummary,
        recommendedAction: item.recommendedAction,
        ownerRole: "ipc_officer",
        dueLabel: item.severity === "high" ? "Immediate IPC huddle" : "Cluster review",
        sourceModule: "IPC",
        limitationNote: item.limitationNote,
      });
    }
  }

  return sortOperationalQueueItems(queue);
}

function uniqueAccessionCount(items: OperationalQueueItem[], predicate: (item: OperationalQueueItem) => boolean): number {
  return new Set(items.filter(predicate).map((item) => item.accessionId)).size;
}

export function getOperationalSummary(
  accessions: Record<string, Accession> | Accession[],
  items: OperationalQueueItem[],
): OperationalDashboardSummary {
  const loaded = normaliseAccessions(accessions);
  const itemsByAccession = new Map<string, OperationalQueueItem[]>();
  for (const item of items) {
    const accessionItems = itemsByAccession.get(item.accessionId) ?? [];
    accessionItems.push(item);
    itemsByAccession.set(item.accessionId, accessionItems);
  }

  const openQueueItems = items.length;
  const criticalOrHighPriorityQueueItems = items.filter(
    (item) => item.priority === "critical" || item.priority === "high",
  ).length;
  const openQueueAgeHours = items.map((item) => item.ageHours).filter((age): age is number => typeof age === "number");
  const medianOpenQueueAgeHours =
    openQueueItems === 0 || openQueueAgeHours.length !== openQueueItems ? null : computeMedian(openQueueAgeHours);

  const releasedOrCompletedCases = loaded.filter(
    (accession) => accession.release.state === "released" || accession.workflowStatus === "released",
  ).length;
  const noActionCases = loaded.filter((accession) => {
    const accessionOpenItems = itemsByAccession.get(accession.id) ?? [];
    const isReleasedOrCompleted =
      accession.release.state === "released" || accession.workflowStatus === "released";
    return accessionOpenItems.length === 0 && !isReleasedOrCompleted;
  }).length;

  return {
    totalLoadedCases: loaded.length,
    openQueueItems,
    criticalOrHighPriorityQueueItems,
    criticalUrgentCases: uniqueAccessionCount(items, (item) => item.category === "critical_result"),
    releaseBlocked: uniqueAccessionCount(items, (item) => item.category === "release_blocker"),
    pendingPhoneOut: uniqueAccessionCount(items, (item) => item.category === "phone_out"),
    pendingConsultantApproval: uniqueAccessionCount(items, (item) => item.category === "consultant_approval"),
    amsPendingOrRestricted: uniqueAccessionCount(
      items,
      (item) => item.category === "ams_pending_approval" || item.category === "ams_restricted",
    ),
    ipcHighPriority: uniqueAccessionCount(items, (item) => item.category === "ipc_high_priority"),
    colonisationOrClearanceFollowUp: uniqueAccessionCount(
      items,
      (item) => item.category === "colonisation_follow_up",
    ),
    releasedOrCompletedCases,
    noActionCases,
    medianOpenQueueAgeHours,
  };
}

function computeMedian(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return Math.round(((sorted[middle - 1] + sorted[middle]) / 2) * 10) / 10;
  }
  return sorted[middle];
}

export function describeOperationalDashboardLimitations(): string {
  return "Metrics use only cases currently loaded in this browser.";
}

export function deriveOperationalDashboard(
  accessions: Record<string, Accession> | Accession[],
): OperationalDashboardData {
  const items = deriveOperationalQueueItems(accessions);
  return {
    items,
    summary: getOperationalSummary(accessions, items),
    limitationNote: describeOperationalDashboardLimitations(),
  };
}
