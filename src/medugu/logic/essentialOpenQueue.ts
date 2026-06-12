import type { OperationalQueueItem } from "./operationalDashboard";
import { getOperationalPriority } from "./operationalDashboard";

export const SHOWCASE_OPEN_QUEUE_LIMIT = 6;

type ShowcaseGroup =
  | "critical"
  | "release"
  | "ipc"
  | "ams"
  | "validation"
  | "other";

const GROUP_ORDER: ShowcaseGroup[] = [
  "critical",
  "release",
  "ipc",
  "ams",
  "validation",
  "other",
];

function groupForItem(item: OperationalQueueItem): ShowcaseGroup {
  if (item.category === "critical_result") return "critical";
  if (
    item.category === "release_blocker" ||
    item.category === "phone_out" ||
    item.category === "consultant_approval"
  ) {
    return "release";
  }
  if (
    item.category === "ipc_high_priority" ||
    item.category === "ipc_action" ||
    item.category === "ipc_outbreak_watch" ||
    item.category === "colonisation_follow_up"
  ) {
    return "ipc";
  }
  if (
    item.category === "ams_pending_approval" ||
    item.category === "ams_restricted"
  ) {
    return "ams";
  }
  if (item.category === "validation_warning") return "validation";
  return "other";
}

function compareQueueItems(a: OperationalQueueItem, b: OperationalQueueItem) {
  const priority = getOperationalPriority(b) - getOperationalPriority(a);
  if (priority !== 0) return priority;
  return (b.ageHours ?? -1) - (a.ageHours ?? -1);
}

export function selectEssentialOpenQueueItems(
  items: OperationalQueueItem[],
  limit = SHOWCASE_OPEN_QUEUE_LIMIT,
) {
  if (limit <= 0) return [] as OperationalQueueItem[];

  const sorted = [...items].sort(compareQueueItems);
  if (sorted.length <= limit) return sorted;

  const selected: OperationalQueueItem[] = [];
  const selectedIds = new Set<string>();
  const selectedAccessions = new Set<string>();

  const add = (item: OperationalQueueItem | undefined) => {
    if (!item || selectedIds.has(item.id) || selected.length >= limit) return;
    selected.push(item);
    selectedIds.add(item.id);
    selectedAccessions.add(item.accessionId);
  };

  // Keep one clear example from each major operational capability.
  for (const group of GROUP_ORDER) {
    const candidate =
      sorted.find(
        (item) =>
          groupForItem(item) === group &&
          !selectedIds.has(item.id) &&
          !selectedAccessions.has(item.accessionId),
      ) ??
      sorted.find(
        (item) =>
          groupForItem(item) === group && !selectedIds.has(item.id),
      );
    add(candidate);
  }

  // Fill any remaining space by priority while preferring new accessions.
  for (const item of sorted) {
    if (selected.length >= limit) break;
    if (selectedIds.has(item.id) || selectedAccessions.has(item.accessionId)) {
      continue;
    }
    add(item);
  }

  for (const item of sorted) {
    if (selected.length >= limit) break;
    add(item);
  }

  return selected.sort(compareQueueItems);
}
