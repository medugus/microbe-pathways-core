import type { Accession } from "../../domain/types";
import { computeMedian, normaliseAccessions, uniqueAccessionCount } from "./dashboardMetrics";
import type { OperationalDashboardSummary, OperationalQueueItem } from "./dashboardTypes";

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
  const openQueueAgeHours = items
    .map((item) => item.ageHours)
    .filter((age): age is number => typeof age === "number");
  const medianOpenQueueAgeHours =
    openQueueItems === 0 || openQueueAgeHours.length !== openQueueItems
      ? null
      : computeMedian(openQueueAgeHours);

  const releasedOrCompletedCases = loaded.filter(
    (accession) =>
      accession.release.state === "released" || accession.workflowStatus === "released",
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
    pendingConsultantApproval: uniqueAccessionCount(
      items,
      (item) => item.category === "consultant_approval",
    ),
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
