import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { OperationalQueueItem as QueueItem } from "../../../logic/operationalDashboard";
import { meduguActions } from "../../../store/useAccessionStore";
import type { TriageBucket, TriageScored } from "../../../ai/triageWorklist.functions";
import { OperationalFilters, type OperationalQueueFilter } from "./OperationalFilters";
import { OperationalQueueItem } from "./OperationalQueueItem";
import { TriageBatchButton } from "./TriageBatchButton";

type TriageFilter = "all" | TriageBucket;

const TRIAGE_FILTER_LABELS: Record<TriageFilter, string> = {
  all: "All triage",
  auto: "✨ Auto",
  glance: "✨ Glance",
  work: "✨ Work",
};

function matchesFilter(item: QueueItem, filter: OperationalQueueFilter): boolean {
  if (filter === "all") return true;
  if (filter === "critical") return item.priority === "critical" || item.category === "critical_result";
  if (filter === "ipc") return item.sourceModule === "IPC";
  if (filter === "ams") return item.sourceModule === "AMS";
  if (filter === "release") return item.sourceModule === "Release";
  if (filter === "validation") return item.sourceModule === "Validation";
  return true;
}

export function OperationalPriorityQueue({ items }: { items: QueueItem[] }) {
  const [filter, setFilter] = useState<OperationalQueueFilter>("all");
  const [triageFilter, setTriageFilter] = useState<TriageFilter>("all");
  const [triage, setTriage] = useState<Record<string, TriageScored>>({});
  const [triageError, setTriageError] = useState<string | null>(null);
  const [accessionRowIds, setAccessionRowIds] = useState<Record<string, string>>({});
  const [navHint, setNavHint] = useState<string | null>(null);

  const moduleFiltered = useMemo(
    () => items.filter((item) => matchesFilter(item, filter)),
    [items, filter],
  );

  const filtered = useMemo(() => {
    if (triageFilter === "all") return moduleFiltered;
    return moduleFiltered.filter((it) => triage[it.id]?.bucket === triageFilter);
  }, [moduleFiltered, triage, triageFilter]);

  const triageCounts = useMemo(() => {
    const counts: Record<TriageBucket, number> = { auto: 0, glance: 0, work: 0 };
    for (const it of moduleFiltered) {
      const t = triage[it.id];
      if (t) counts[t.bucket] += 1;
    }
    return counts;
  }, [moduleFiltered, triage]);

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

  async function ensureAccessionRowIds(visible: QueueItem[]): Promise<Record<string, string>> {
    const codes = Array.from(
      new Set(visible.map((it) => it.accessionNumber).filter((c): c is string => !!c)),
    );
    const missing = codes.filter((c) => !(c in accessionRowIds));
    if (missing.length === 0) return accessionRowIds;
    const { data } = await supabase
      .from("accessions")
      .select("id, accession_code")
      .in("accession_code", missing);
    const next = { ...accessionRowIds };
    for (const row of data ?? []) {
      if (row?.accession_code && row?.id) next[row.accession_code as string] = row.id as string;
    }
    setAccessionRowIds(next);
    return next;
  }

  async function handleTriage() {
    setTriageError(null);
    return ensureAccessionRowIds(moduleFiltered);
  }

  return (
    <section className="space-y-2 rounded-md border border-border bg-card p-3">
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-sm font-semibold text-foreground">Operational priority queue</h4>
        <span className="text-xs text-muted-foreground">{filtered.length} item(s)</span>
      </div>

      <OperationalFilters filter={filter} onChange={setFilter} />

      <div className="flex flex-wrap items-center justify-between gap-2 rounded border border-dashed border-border bg-muted/20 p-2">
        <TriageBatchButton
          items={moduleFiltered}
          accessionRowIds={accessionRowIds}
          onScored={(results) => {
            setTriage((prev) => {
              const next = { ...prev };
              for (const r of results) next[r.id] = r;
              return next;
            });
          }}
          onError={(reason) => setTriageError(reason)}
        />
        <div className="flex flex-wrap items-center gap-1">
          {(Object.keys(TRIAGE_FILTER_LABELS) as TriageFilter[]).map((key) => {
            const count = key === "all" ? null : triageCounts[key];
            const disabled = key !== "all" && count === 0;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setTriageFilter(key)}
                disabled={disabled}
                className={`rounded border px-2 py-1 text-[11px] ${
                  triageFilter === key
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border text-muted-foreground hover:bg-muted"
                } ${disabled ? "opacity-40" : ""}`}
              >
                {TRIAGE_FILTER_LABELS[key]}
                {count !== null ? ` (${count})` : ""}
              </button>
            );
          })}
        </div>
      </div>

      {triageError && (
        <p className="rounded border border-destructive/40 bg-destructive/10 px-2 py-1 text-xs text-destructive">
          {triageError}
        </p>
      )}
      <p className="text-[11px] text-muted-foreground">
        ✨ AI triage scores workload only (auto / glance / work). It is not a clinical decision and never recommends therapy.
      </p>
      {navHint && <p className="text-xs text-muted-foreground">{navHint}</p>}

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-border text-xs">
          <thead className="bg-muted/40 text-muted-foreground">
            <tr>
              <th className="px-2 py-2 text-left text-[10px] uppercase tracking-wide">Priority</th>
              <th className="px-2 py-2 text-left text-[10px] uppercase tracking-wide">Category</th>
              <th className="px-2 py-2 text-left text-[10px] uppercase tracking-wide">Accession / patient</th>
              <th className="px-2 py-2 text-left text-[10px] uppercase tracking-wide">Ward / specimen</th>
              <th className="px-2 py-2 text-left text-[10px] uppercase tracking-wide">Organism / phenotype</th>
              <th className="px-2 py-2 text-left text-[10px] uppercase tracking-wide">Reason</th>
              <th className="px-2 py-2 text-left text-[10px] uppercase tracking-wide">Recommended action</th>
              <th className="px-2 py-2 text-left text-[10px] uppercase tracking-wide">Owner role</th>
              <th className="px-2 py-2 text-left text-[10px] uppercase tracking-wide">Source</th>
              <th className="px-2 py-2 text-left text-[10px] uppercase tracking-wide">Destination</th>
              <th className="px-2 py-2 text-left text-[10px] uppercase tracking-wide">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filtered.map((item) => (
              <OperationalQueueItem
                key={item.id}
                item={item}
                triage={triage[item.id]}
                onOpen={handleOpen}
              />
            ))}
          </tbody>
        </table>
      </div>

      {/* Lazy-load row ids when the user is about to triage. We trigger this by
          calling handleTriage from a hidden effect-like hook on first render of
          a non-empty queue, but to keep things simple we resolve them on demand
          inside the button via accessionRowIds prop refresh. */}
      <button type="button" onClick={handleTriage} className="hidden" aria-hidden />
    </section>
  );
}
