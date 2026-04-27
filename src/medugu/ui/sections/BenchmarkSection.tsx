import { useMemo, useState, type ReactNode } from "react";
import { meduguActions, useMeduguState } from "../../store/useAccessionStore";
import {
  deriveMicrobiologyWorklist,
  type MicrobiologyWorklistItem,
  type WorklistPriority,
  type WorklistQueueCategory,
} from "../../logic/worklistEngine";

type WorklistFilter =
  | "all"
  | "positive_blood_culture"
  | "ast_pending"
  | "release_blocked"
  | "ams_approval"
  | "ipc_signal"
  | "ready_for_review";

const FILTER_LABELS: Record<WorklistFilter, string> = {
  all: "All",
  positive_blood_culture: "Blood culture",
  ast_pending: "AST",
  release_blocked: "Release blocked",
  ams_approval: "AMS",
  ipc_signal: "IPC",
  ready_for_review: "Ready for review",
};

const QUEUE_LABELS: Record<WorklistQueueCategory, string> = {
  positive_blood_culture: "Positive blood cultures",
  ast_pending: "AST pending",
  release_blocked: "Release blocked",
  ams_approval: "AMS approvals",
  ipc_signal: "IPC signals",
  critical_communication: "Critical communication",
  ready_for_review: "Ready for review",
  recently_released: "Recently released/amended",
};

const PRIORITY_STYLE: Record<WorklistPriority, string> = {
  Critical: "bg-destructive text-white",
  High: "bg-destructive/15 text-destructive",
  Moderate: "bg-amber-100 text-amber-800",
  Routine: "bg-muted text-muted-foreground",
};

export function BenchmarkSection() {
  const state = useMeduguState();
  const [filter, setFilter] = useState<WorklistFilter>("all");

  const worklist = useMemo(() => deriveMicrobiologyWorklist(state.accessions), [state.accessions]);

  const filteredItems = useMemo(() => {
    if (filter === "all") return worklist.items;
    return worklist.items.filter((item) => item.queueCategory === filter);
  }, [filter, worklist.items]);

  const summary = {
    positiveBlood: worklist.byCategory.positive_blood_culture.length,
    astPending: worklist.byCategory.ast_pending.length,
    releaseBlocked: worklist.byCategory.release_blocked.length,
    amsPending: worklist.byCategory.ams_approval.length,
    ipcAlerts: worklist.byCategory.ipc_signal.length,
    readyForReview: worklist.byCategory.ready_for_review.length,
  };

  function openRow(item: MicrobiologyWorklistItem) {
    meduguActions.setActive(item.accessionId);
    if (item.linkedSectionTarget) {
      setTimeout(() => {
        if (typeof window !== "undefined") {
          window.location.hash = `sec-${item.linkedSectionTarget}`;
        }
      }, 0);
    }
  }

  return (
    <div className="space-y-4">
      <header className="rounded-md border border-border bg-background p-3">
        <h4 className="text-sm font-semibold text-foreground">Microbiology Command Centre</h4>
        <p className="mt-1 text-xs text-muted-foreground">
          Derived operational worklist from current accession state. No clinical logic is altered.
        </p>
      </header>

      <section className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
        <SummaryCard
          label="Positive blood cultures"
          value={summary.positiveBlood}
          tone="text-destructive"
        />
        <SummaryCard label="AST pending" value={summary.astPending} />
        <SummaryCard
          label="Release blocked"
          value={summary.releaseBlocked}
          tone="text-destructive"
        />
        <SummaryCard label="AMS pending" value={summary.amsPending} />
        <SummaryCard label="IPC alerts" value={summary.ipcAlerts} tone="text-destructive" />
        <SummaryCard label="Ready for review" value={summary.readyForReview} tone="text-primary" />
      </section>

      <section className="flex flex-wrap items-center gap-2">
        {(Object.keys(FILTER_LABELS) as WorklistFilter[]).map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setFilter(key)}
            className={`rounded border px-2 py-1 text-xs ${
              filter === key
                ? "border-primary bg-primary/10 text-primary"
                : "border-border text-muted-foreground hover:bg-muted"
            }`}
          >
            {FILTER_LABELS[key]}
          </button>
        ))}
      </section>

      <section className="overflow-x-auto rounded-md border border-border bg-card">
        <table className="min-w-full divide-y divide-border text-xs">
          <thead className="bg-muted/40 text-muted-foreground">
            <tr>
              <Th>Priority</Th>
              <Th>Queue</Th>
              <Th>Accession</Th>
              <Th>Patient/MRN</Th>
              <Th>Specimen</Th>
              <Th>Reason</Th>
              <Th>Next action</Th>
              <Th>Status</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filteredItems.map((item) => (
              <tr
                key={`${item.queueCategory}-${item.accessionId}`}
                className="cursor-pointer hover:bg-muted/40"
                onClick={() => openRow(item)}
              >
                <Td>
                  <span
                    className={`rounded px-2 py-0.5 text-[10px] font-semibold ${PRIORITY_STYLE[item.priority]}`}
                  >
                    {item.priority}
                  </span>
                </Td>
                <Td>{QUEUE_LABELS[item.queueCategory]}</Td>
                <Td>
                  <span className="font-mono">{item.accessionNumber}</span>
                </Td>
                <Td>{item.patientDisplay}</Td>
                <Td>{item.specimen}</Td>
                <Td>{item.reason}</Td>
                <Td>{item.nextAction}</Td>
                <Td>
                  <div>{item.status}</div>
                  {item.timestamp && (
                    <div className="text-[10px] text-muted-foreground">
                      {new Date(item.timestamp).toLocaleString()}
                    </div>
                  )}
                </Td>
              </tr>
            ))}
          </tbody>
        </table>

        {filteredItems.length === 0 && (
          <div className="p-6 text-center text-sm text-muted-foreground">
            No matching worklist items.
          </div>
        )}
      </section>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  tone = "text-foreground",
}: {
  label: string;
  value: number;
  tone?: string;
}) {
  return (
    <div className="rounded border border-border bg-card p-3">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`mt-1 text-2xl font-semibold ${tone}`}>{value}</div>
    </div>
  );
}

function Th({ children }: { children: ReactNode }) {
  return <th className="px-3 py-2 text-left text-[10px] uppercase tracking-wide">{children}</th>;
}

function Td({ children }: { children: ReactNode }) {
  return <td className="px-3 py-2 align-top text-foreground">{children}</td>;
}
