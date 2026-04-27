import { useMemo, useState } from "react";
import type { OperationalQueueItem as QueueItem } from "../../../logic/operationalDashboard";
import { meduguActions } from "../../../store/useAccessionStore";
import { OperationalFilters, type OperationalQueueFilter } from "./OperationalFilters";
import { OperationalQueueItem } from "./OperationalQueueItem";

function matchesFilter(item: QueueItem, filter: OperationalQueueFilter): boolean {
  if (filter === "all") return true;
  if (filter === "critical")
    return item.priority === "critical" || item.category === "critical_result";
  if (filter === "ipc") return item.sourceModule === "IPC";
  if (filter === "ams") return item.sourceModule === "AMS";
  if (filter === "release") return item.sourceModule === "Release";
  if (filter === "validation") return item.sourceModule === "Validation";
  return true;
}

export function OperationalPriorityQueue({ items }: { items: QueueItem[] }) {
  const [filter, setFilter] = useState<OperationalQueueFilter>("all");
  const [navHint, setNavHint] = useState<string | null>(null);

  const filtered = useMemo(
    () => items.filter((item) => matchesFilter(item, filter)),
    [items, filter],
  );

  function targetSectionId(item: QueueItem): string | null {
    if (item.targetSection === "IPC") return "sec-ipc";
    if (item.targetSection === "AMS") return "sec-ams";
    if (item.targetSection === "Validation") return "sec-validation";
    if (item.targetSection === "Release") return "sec-release";
    if (item.targetSection === "AST") return "sec-ast";
    if (item.targetSection === "Specimen") return "sec-specimen";
    if (item.targetSection === "Report") return "sec-report";
    if (item.targetSection === "Dashboard") return "sec-operations";
    return null;
  }

  function handleOpen(item: QueueItem) {
    meduguActions.setActive(item.targetAccessionId);
    setNavHint(null);
    const sectionId = targetSectionId(item);
    if (!sectionId || typeof window === "undefined" || typeof document === "undefined") {
      setNavHint(`Open the ${item.targetSection} panel to continue.`);
      return;
    }
    window.setTimeout(() => {
      const target = document.getElementById(sectionId);
      if (!target) {
        setNavHint(`Open the ${item.targetSection} panel to continue.`);
        return;
      }
      window.location.hash = sectionId;
      target.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 0);
  }

  return (
    <section className="space-y-2 rounded-md border border-border bg-card p-3">
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-sm font-semibold text-foreground">Operational priority queue</h4>
        <span className="text-xs text-muted-foreground">{filtered.length} item(s)</span>
      </div>

      <OperationalFilters filter={filter} onChange={setFilter} />
      {navHint && <p className="text-xs text-muted-foreground">{navHint}</p>}

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-border text-xs">
          <thead className="bg-muted/40 text-muted-foreground">
            <tr>
              <th className="px-2 py-2 text-left text-[10px] uppercase tracking-wide">Priority</th>
              <th className="px-2 py-2 text-left text-[10px] uppercase tracking-wide">Category</th>
              <th className="px-2 py-2 text-left text-[10px] uppercase tracking-wide">
                Accession / patient
              </th>
              <th className="px-2 py-2 text-left text-[10px] uppercase tracking-wide">
                Ward / specimen
              </th>
              <th className="px-2 py-2 text-left text-[10px] uppercase tracking-wide">
                Organism / phenotype
              </th>
              <th className="px-2 py-2 text-left text-[10px] uppercase tracking-wide">Reason</th>
              <th className="px-2 py-2 text-left text-[10px] uppercase tracking-wide">
                Recommended action
              </th>
              <th className="px-2 py-2 text-left text-[10px] uppercase tracking-wide">
                Owner role
              </th>
              <th className="px-2 py-2 text-left text-[10px] uppercase tracking-wide">Source</th>
              <th className="px-2 py-2 text-left text-[10px] uppercase tracking-wide">
                Destination
              </th>
              <th className="px-2 py-2 text-left text-[10px] uppercase tracking-wide">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filtered.map((item) => (
              <OperationalQueueItem key={item.id} item={item} onOpen={handleOpen} />
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
