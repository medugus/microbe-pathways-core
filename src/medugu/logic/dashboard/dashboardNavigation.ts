import type {
  OperationalQueueItem,
  OperationalQueueItemDraft,
  OperationalQueueTargetSection,
} from "./dashboardTypes";

function targetSectionForItem(item: OperationalQueueItemDraft): OperationalQueueTargetSection {
  if (
    item.category === "ipc_high_priority" ||
    item.category === "ipc_action" ||
    item.category === "ipc_outbreak_watch"
  ) {
    return "IPC";
  }
  if (item.category === "colonisation_follow_up") return "IPC";
  if (item.category === "ams_restricted" || item.category === "ams_pending_approval") return "AMS";
  if (item.category === "validation_warning") return "Validation";
  if (
    item.category === "release_blocker" ||
    item.category === "consultant_approval" ||
    item.category === "phone_out"
  ) {
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

export function toOperationalQueueItem(item: OperationalQueueItemDraft): OperationalQueueItem {
  return {
    ...item,
    targetAccessionId: item.accessionId,
    targetSection: targetSectionForItem(item),
    reason: item.reason.trim() || "Operational review required.",
  };
}
