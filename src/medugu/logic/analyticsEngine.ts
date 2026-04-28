// Analytics engine — Stage 8 (browser-phase).
//
// Framework-agnostic. No React, no network, no localStorage. Pure functions
// over a portable input shape (AnalyticsInputs) that the store layer assembles
// from whatever sources are available locally (in-memory accessions plus
// tenant-scoped Supabase rows for audit/dispatch).
//
// A future backend-owned analytics service can implement the same compute
// contract — same inputs, same outputs — without changing the dashboard UI.
//
// Browser-phase scope:
//   - operates only on data already loaded in the current browser session
//   - no warehouse joins, no historical backfill
//   - "time on task" is approximated from local audit timestamps
//   - no production observability claim

import type { Accession, AMSApprovalRequest } from "../domain/types";
import { ReleaseState } from "../domain/enums";

// ---------- Portable input contract ----------

export interface AuditRowLite {
  at: string;            // ISO
  action: string;        // dotted, e.g. "ast.entered"
  entity: string;        // accession | isolate | ast | release_package | ...
  entityId: string | null;
}

export interface DispatchRowLite {
  requestedAt: string;       // ISO
  completedAt: string | null;
  status: string;            // sent | failed | retried | skipped | ...
  format: string;            // FHIR | HL7 | CSV | JSON | ...
  receiverName: string;
  attemptNo: number;
  parentDispatchId: string | null;
}

export interface AnalyticsInputs {
  /** All accessions visible to the current user in this session. */
  accessions: Accession[];
  /** Recent audit_event rows (tenant-scoped by RLS). May be empty. */
  audit: AuditRowLite[];
  /** Recent dispatch_history rows (tenant-scoped by RLS). May be empty. */
  dispatches: DispatchRowLite[];
  /** Wall-clock used to bound "now" for cycle-time math. */
  now: Date;
}

// ---------- Filters ----------

export interface AnalyticsFilters {
  /** ISO date (yyyy-mm-dd) inclusive lower bound on accession.createdAt. */
  fromDate?: string;
  /** ISO date (yyyy-mm-dd) inclusive upper bound on accession.createdAt. */
  toDate?: string;
  /** Specimen family code (BLOOD/URINE/...) or "all". */
  family?: string;
  /**
   * Scenario type — derived from the accession's seeded scenario tag in the
   * specimen.freeTextLabel when available; otherwise "uncategorised".
   * Browser-phase: best-effort; not authoritative.
   */
  scenario?: string;
}

// ---------- Helpers ----------

function inDateRange(iso: string | undefined, from?: string, to?: string): boolean {
  if (!iso) return false;
  const d = iso.slice(0, 10);
  if (from && d < from) return false;
  if (to && d > to) return false;
  return true;
}

/** Best-effort scenario tag derivation. Browser-phase only. */
export function deriveScenario(a: Accession): string {
  const lbl = (a.specimen.freeTextLabel ?? "").toLowerCase();
  if (lbl.includes("mrsa")) return "MRSA";
  if (lbl.includes("esbl")) return "ESBL";
  if (lbl.includes("vre")) return "VRE";
  if (lbl.includes("cre") || lbl.includes("carbapenem")) return "CRE";
  if (lbl.includes("uti")) return "UTI";
  if (lbl.includes("bsi") || lbl.includes("blood")) return "BSI";
  return "uncategorised";
}

function applyFilters(inputs: AnalyticsInputs, f: AnalyticsFilters): Accession[] {
  return inputs.accessions.filter((a) => {
    if (!inDateRange(a.createdAt, f.fromDate, f.toDate)) {
      // Allow accessions without createdAt to pass when no date filter is set.
      if (f.fromDate || f.toDate) return false;
    }
    if (f.family && f.family !== "all" && a.specimen.familyCode !== f.family) return false;
    if (f.scenario && f.scenario !== "all" && deriveScenario(a) !== f.scenario) return false;
    return true;
  });
}

function diffMinutes(a: string, b: string): number {
  return (new Date(b).getTime() - new Date(a).getTime()) / 60000;
}

function median(xs: number[]): number {
  if (xs.length === 0) return 0;
  const sorted = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function mean(xs: number[]): number {
  if (xs.length === 0) return 0;
  return xs.reduce((s, x) => s + x, 0) / xs.length;
}

// ---------- Metric shapes ----------

export interface CycleTimeStat {
  count: number;
  /** Median minutes. 0 when count = 0. */
  medianMin: number;
  /** Mean minutes. 0 when count = 0. */
  meanMin: number;
}

export interface AnalyticsMetrics {
  /** Total accessions in scope after filters. */
  totalAccessions: number;

  /** Time on task — registration → release, by accession. */
  timeOnTask: CycleTimeStat;

  /** Released / total accessions in scope (0..1). */
  releaseSuccessRate: number;
  releasedCount: number;
  amendedCount: number;

  /** Accessions with at least one blocker validation issue / total (0..1). */
  blockerRate: number;
  blockedAccessions: number;

  /** IPC signals raised per accession in scope. */
  ipcAlertRate: number;
  ipcSignalCount: number;

  /** AMS approval cycle — request → decide. */
  amsApprovalCycleTime: CycleTimeStat;
  amsRequested: number;
  amsApproved: number;
  amsDenied: number;
  amsExpired: number;

  /** Dispatch outcomes counted from dispatch_history rows. */
  dispatch: {
    sent: number;
    failed: number;
    skipped: number;
    other: number;
    successRate: number; // sent / (sent + failed); 0 when denominator 0
  };

  /** Export volume by format. */
  exportsByFormat: Array<{ format: string; count: number }>;

  /** Distribution of accessions by specimen family (for the active filter scope). */
  byFamily: Array<{ family: string; count: number }>;

  /** Distribution by derived scenario. */
  byScenario: Array<{ scenario: string; count: number }>;
}

// ---------- Compute ----------

function computeTimeOnTask(accessions: Accession[]): CycleTimeStat {
  const xs: number[] = [];
  for (const a of accessions) {
    if (a.releasedAt && a.createdAt) {
      const m = diffMinutes(a.createdAt, a.releasedAt);
      if (m >= 0 && Number.isFinite(m)) xs.push(m);
    }
  }
  return { count: xs.length, medianMin: median(xs), meanMin: mean(xs) };
}

function computeAmsCycle(reqs: AMSApprovalRequest[]): CycleTimeStat {
  const xs: number[] = [];
  for (const r of reqs) {
    if (r.requested?.at && r.decided?.at) {
      const m = diffMinutes(r.requested.at, r.decided.at);
      if (m >= 0 && Number.isFinite(m)) xs.push(m);
    }
  }
  return { count: xs.length, medianMin: median(xs), meanMin: mean(xs) };
}

function bucketBy<T>(items: T[], key: (t: T) => string): Array<{ k: string; n: number }> {
  const m = new Map<string, number>();
  for (const it of items) {
    const k = key(it);
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  return Array.from(m.entries())
    .map(([k, n]) => ({ k, n }))
    .sort((a, b) => b.n - a.n);
}

export function computeAnalytics(
  inputs: AnalyticsInputs,
  filters: AnalyticsFilters,
): AnalyticsMetrics {
  const scoped = applyFilters(inputs, filters);

  // Release counts
  let released = 0;
  let amended = 0;
  let blocked = 0;
  let ipcSignals = 0;
  const allAms: AMSApprovalRequest[] = [];
  for (const a of scoped) {
    if (a.release.state === ReleaseState.Released) released++;
    if (a.release.state === ReleaseState.Amended) amended++;
    if (a.validation.some((v) => v.severity === "block")) blocked++;
    ipcSignals += a.ipc.length;
    if (a.amsApprovals) allAms.push(...a.amsApprovals);
  }

  const ams = {
    requested: allAms.length,
    approved: allAms.filter((r) => r.status === "approved").length,
    denied: allAms.filter((r) => r.status === "denied").length,
    expired: allAms.filter((r) => r.status === "expired").length,
  };

  // Dispatch — filter to scoped accession ids when date filters are active by
  // restricting on requestedAt window; we don't have accession_id on the lite
  // row, so we apply only the date filter when one is set.
  const scopedDispatches = inputs.dispatches.filter((d) => {
    if (filters.fromDate && d.requestedAt.slice(0, 10) < filters.fromDate) return false;
    if (filters.toDate && d.requestedAt.slice(0, 10) > filters.toDate) return false;
    return true;
  });
  let sent = 0;
  let failed = 0;
  let skipped = 0;
  let other = 0;
  for (const d of scopedDispatches) {
    const s = d.status.toLowerCase();
    if (s === "sent" || s === "success" || s === "delivered") sent++;
    else if (s === "failed" || s === "error") failed++;
    else if (s === "skipped" || s.includes("skip")) skipped++;
    else other++;
  }
  const denom = sent + failed;
  const dispatchSuccessRate = denom === 0 ? 0 : sent / denom;

  const exportsByFormat = bucketBy(scopedDispatches, (d) => d.format || "UNKNOWN").map(
    (b) => ({ format: b.k, count: b.n }),
  );

  const byFamily = bucketBy(scoped, (a) => a.specimen.familyCode).map((b) => ({
    family: b.k,
    count: b.n,
  }));
  const byScenario = bucketBy(scoped, (a) => deriveScenario(a)).map((b) => ({
    scenario: b.k,
    count: b.n,
  }));

  const total = scoped.length || 0;

  return {
    totalAccessions: total,
    timeOnTask: computeTimeOnTask(scoped),
    releasedCount: released,
    amendedCount: amended,
    releaseSuccessRate: total === 0 ? 0 : released / total,
    blockedAccessions: blocked,
    blockerRate: total === 0 ? 0 : blocked / total,
    ipcSignalCount: ipcSignals,
    ipcAlertRate: total === 0 ? 0 : ipcSignals / total,
    amsRequested: ams.requested,
    amsApproved: ams.approved,
    amsDenied: ams.denied,
    amsExpired: ams.expired,
    amsApprovalCycleTime: computeAmsCycle(allAms),
    dispatch: { sent, failed, skipped, other, successRate: dispatchSuccessRate },
    exportsByFormat,
    byFamily,
    byScenario,
  };
}

// ---------- Formatters (UI helpers, kept here so UI stays dumb) ----------

export function formatPct(x: number): string {
  return `${(x * 100).toFixed(1)}%`;
}

export function formatMinutes(min: number): string {
  if (!Number.isFinite(min) || min <= 0) return "—";
  if (min < 60) return `${min.toFixed(0)} min`;
  const h = min / 60;
  if (h < 48) return `${h.toFixed(1)} h`;
  return `${(h / 24).toFixed(1)} d`;
}
