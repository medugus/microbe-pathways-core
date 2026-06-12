import { deriveOperationalDashboard } from "../../logic/operationalDashboard";
import { useMeduguState } from "../../store/useAccessionStore";
import { OperationalMetricsPanel } from "./dashboard/OperationalMetricsPanel";
import { OperationalPriorityQueue } from "./dashboard/OperationalPriorityQueue";
import { OperationalDashboardEmptyState } from "./dashboard/OperationalDashboardEmptyState";
import {
  representativeAccessionMap,
} from "../../logic/representativeAccessions";

export function OperationalDashboardSection() {
  const state = useMeduguState();
  const representativeAccessions = representativeAccessionMap(state);
  const representedCount = Object.keys(representativeAccessions).length;
  const totalCount = Object.keys(state.accessions).length;
  const dashboard = deriveOperationalDashboard(representativeAccessions);

  return (
    <div className="space-y-4">
      <header className="rounded-md border border-border bg-background p-3">
        <h4 className="text-sm font-semibold text-foreground">Operational dashboard</h4>
        <p className="mt-1 text-xs text-muted-foreground">
          {totalCount > representedCount
            ? `Showing a representative ${representedCount} of ${totalCount} loaded cases, balanced across workflow stages and capabilities. All records remain stored.`
            : "Metrics use all cases currently loaded in this browser."}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          This view requires backend persistence for hospital-wide operations and durable task management.
        </p>
      </header>

      <OperationalMetricsPanel summary={dashboard.summary} />

      {dashboard.items.length === 0 ? (
        <OperationalDashboardEmptyState />
      ) : (
        <OperationalPriorityQueue items={dashboard.items} />
      )}
    </div>
  );
}
