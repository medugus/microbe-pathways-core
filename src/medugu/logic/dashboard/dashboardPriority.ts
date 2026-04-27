import type {
  OperationalQueueCategory,
  OperationalQueueItem,
  OperationalQueuePriority,
} from "./dashboardTypes";

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
