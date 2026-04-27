import type { Accession } from "../domain/types";
import { describeOperationalDashboardLimitations } from "./dashboard/dashboardLimitations";
import { deriveOperationalQueueItems } from "./dashboard/dashboardQueue";
import { getOperationalPriority, sortOperationalQueueItems } from "./dashboard/dashboardPriority";
import { getOperationalSummary } from "./dashboard/dashboardSummary";
import type { OperationalDashboardData } from "./dashboard/dashboardTypes";

export type {
  OperationalDashboardData,
  OperationalDashboardSummary,
  OperationalQueueCategory,
  OperationalQueueItem,
  OperationalQueueOwnerRole,
  OperationalQueuePriority,
  OperationalQueueSourceModule,
  OperationalQueueTargetSection,
} from "./dashboard/dashboardTypes";

export {
  deriveOperationalQueueItems,
  describeOperationalDashboardLimitations,
  getOperationalPriority,
  getOperationalSummary,
  sortOperationalQueueItems,
};

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
