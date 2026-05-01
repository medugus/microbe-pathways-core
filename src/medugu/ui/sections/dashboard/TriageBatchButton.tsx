// TriageBatchButton — one-click AI triage for all currently visible cases.
//
// Posture: workload-only triage, never clinical advice. The server-side
// prompt enforces this; this component just orchestrates the batch call,
// surfaces progress + errors, and hands results back to the queue.

import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import type { OperationalQueueItem } from "../../../logic/operationalDashboard";
import { triageWorklist, type TriageScored } from "../../../ai/triageWorklist.functions";

function summariseCase(item: OperationalQueueItem): string {
  // Compact, deterministic, de-identified summary (no patient name, no MRN).
  // Mirrors what the technician already sees on the row.
  const parts: string[] = [
    `priority=${item.priority}`,
    `category=${item.category}`,
    `source=${item.sourceModule}`,
    `dest=${item.targetSection}`,
  ];
  if (item.specimenLabel) parts.push(`specimen=${item.specimenLabel}`);
  if (item.organismOrPhenotype) parts.push(`org=${item.organismOrPhenotype}`);
  if (item.ward) parts.push(`ward=${item.ward}`);
  if (item.dueLabel) parts.push(`due=${item.dueLabel}`);
  if (typeof item.ageHours === "number") parts.push(`ageH=${Math.round(item.ageHours)}`);
  parts.push(`reason=${item.reason}`);
  parts.push(`recommended=${item.recommendedAction}`);
  return parts.join(" | ").slice(0, 780);
}

export interface TriageBatchButtonProps {
  items: OperationalQueueItem[];
  /** Map of accession code -> DB row id, for tenant-scoped audit. */
  accessionRowIds?: Record<string, string>;
  onScored: (results: TriageScored[]) => void;
  onError?: (reason: string) => void;
}

export function TriageBatchButton({ items, accessionRowIds, onScored, onError }: TriageBatchButtonProps) {
  const triageFn = useServerFn(triageWorklist);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  async function handleClick() {
    if (busy || items.length === 0) return;
    setBusy(true);
    setStatus(null);
    try {
      // Cap per call; chunk if very large worklist. Server also caps at 40.
      const CHUNK = 30;
      const chunks: OperationalQueueItem[][] = [];
      for (let i = 0; i < items.length; i += CHUNK) chunks.push(items.slice(i, i + CHUNK));

      const all: TriageScored[] = [];
      for (let i = 0; i < chunks.length; i++) {
        const batch = chunks[i];
        setStatus(`Scoring ${i * CHUNK + 1}–${i * CHUNK + batch.length} of ${items.length}…`);
        const cases = batch.map((it) => ({ id: it.id, summary: summariseCase(it) }));
        // Map AI-side ids (queue item id) back to accession row ids for audit.
        const rowIds: Record<string, string> = {};
        if (accessionRowIds) {
          for (const it of batch) {
            const code = it.accessionNumber;
            if (code && accessionRowIds[code]) rowIds[it.id] = accessionRowIds[code];
          }
        }
        const res = await triageFn({ data: { cases, accessionRowIds: rowIds } });
        if (!res.ok) {
          setStatus(null);
          setBusy(false);
          onError?.(res.reason ?? "AI triage failed.");
          return;
        }
        all.push(...res.scored);
      }
      onScored(all);
      setStatus(`Scored ${all.length} case(s).`);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("[TriageBatchButton] failed", err);
      onError?.("AI triage request failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={handleClick}
        disabled={busy || items.length === 0}
        className="inline-flex items-center gap-1 rounded-md border border-primary/40 bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary hover:bg-primary/15 disabled:opacity-50"
        title="AI scores each visible case as auto / glance / work. Workload triage only — not clinical advice."
      >
        <span aria-hidden>✨</span>
        {busy ? "Triaging…" : `Triage ${items.length} case${items.length === 1 ? "" : "s"} with AI`}
      </button>
      {status && <span className="text-[11px] text-muted-foreground">{status}</span>}
    </div>
  );
}
