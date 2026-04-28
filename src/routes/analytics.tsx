// Browser-phase analytics dashboard.
// All compute lives in logic/analyticsEngine.ts. This file is just UI glue.

import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { RequireAuth } from "@/auth/RequireAuth";
import { SessionBar } from "@/auth/SessionBar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useMeduguState } from "@/medugu/store/useAccessionStore";
import { loadAnalyticsInputs } from "@/medugu/store/analyticsSource";
import {
  computeAnalytics,
  deriveScenario,
  formatMinutes,
  formatPct,
  type AnalyticsFilters,
  type AnalyticsInputs,
  type AnalyticsMetrics,
} from "@/medugu/logic/analyticsEngine";
import { SPECIMEN_FAMILIES } from "@/medugu/config/specimenFamilies";

export const Route = createFileRoute("/analytics")({
  head: () => ({
    meta: [
      { title: "Analytics — Medugu" },
      { name: "description", content: "Browser-phase analytics over locally available workflow data." },
    ],
  }),
  component: AnalyticsPage,
});

function AnalyticsPage() {
  return (
    <RequireAuth>
      <div className="min-h-screen bg-background">
        <SessionBar />
        <AnalyticsDashboard />
      </div>
    </RequireAuth>
  );
}

function AnalyticsDashboard() {
  // Re-render on accession changes too, so adding a case updates KPIs live.
  useMeduguState();

  const [inputs, setInputs] = useState<AnalyticsInputs | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<AnalyticsFilters>({ family: "all", scenario: "all" });
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    loadAnalyticsInputs()
      .then((next) => {
        if (!cancelled) setInputs(next);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  const metrics: AnalyticsMetrics | null = useMemo(
    () => (inputs ? computeAnalytics(inputs, filters) : null),
    [inputs, filters],
  );

  const scenarios = useMemo(() => {
    if (!inputs) return [] as string[];
    const set = new Set<string>();
    for (const a of inputs.accessions) set.add(deriveScenario(a));
    return Array.from(set).sort();
  }, [inputs]);

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Analytics</h1>
          <p className="text-xs text-muted-foreground">
            Browser-phase only — computed from data available in this session.
            No warehouse, no historical backfill.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setReloadKey((k) => k + 1)}>
            Refresh
          </Button>
          <Link
            to="/"
            className="rounded-md border border-border px-3 py-1.5 text-xs hover:bg-muted"
          >
            ← Back to lab
          </Link>
        </div>
      </div>

      <FilterBar
        filters={filters}
        onChange={setFilters}
        scenarios={scenarios}
        disabled={loading}
      />

      {loading && <div className="text-sm text-muted-foreground">Loading…</div>}
      {error && <div className="text-sm text-destructive">Error: {error}</div>}

      {metrics && (
        <>
          <KpiGrid m={metrics} />
          <div className="grid gap-4 md:grid-cols-2">
            <DistroCard
              title="Accessions by specimen family"
              rows={metrics.byFamily.map((r) => ({ label: r.family, value: r.count }))}
              total={metrics.totalAccessions}
            />
            <DistroCard
              title="Accessions by scenario"
              rows={metrics.byScenario.map((r) => ({ label: r.scenario, value: r.count }))}
              total={metrics.totalAccessions}
            />
            <DistroCard
              title="Exports by format"
              rows={metrics.exportsByFormat.map((r) => ({ label: r.format, value: r.count }))}
              total={metrics.exportsByFormat.reduce((s, r) => s + r.count, 0)}
            />
            <DispatchCard m={metrics} />
          </div>
          <ScopeNote />
        </>
      )}
    </div>
  );
}

function FilterBar({
  filters,
  onChange,
  scenarios,
  disabled,
}: {
  filters: AnalyticsFilters;
  onChange: (f: AnalyticsFilters) => void;
  scenarios: string[];
  disabled: boolean;
}) {
  return (
    <div className="grid gap-3 rounded-md border border-border bg-card p-3 md:grid-cols-5">
      <div>
        <Label className="text-[11px] uppercase text-muted-foreground">From</Label>
        <Input
          type="date"
          value={filters.fromDate ?? ""}
          onChange={(e) => onChange({ ...filters, fromDate: e.target.value || undefined })}
          disabled={disabled}
          className="mt-1"
        />
      </div>
      <div>
        <Label className="text-[11px] uppercase text-muted-foreground">To</Label>
        <Input
          type="date"
          value={filters.toDate ?? ""}
          onChange={(e) => onChange({ ...filters, toDate: e.target.value || undefined })}
          disabled={disabled}
          className="mt-1"
        />
      </div>
      <div>
        <Label className="text-[11px] uppercase text-muted-foreground">Specimen family</Label>
        <Select
          value={filters.family ?? "all"}
          onValueChange={(v) => onChange({ ...filters, family: v })}
          disabled={disabled}
        >
          <SelectTrigger className="mt-1">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All families</SelectItem>
            {SPECIMEN_FAMILIES.map((f) => (
              <SelectItem key={f.code} value={f.code}>
                {f.display}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label className="text-[11px] uppercase text-muted-foreground">Scenario</Label>
        <Select
          value={filters.scenario ?? "all"}
          onValueChange={(v) => onChange({ ...filters, scenario: v })}
          disabled={disabled}
        >
          <SelectTrigger className="mt-1">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All scenarios</SelectItem>
            {scenarios.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex items-end">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onChange({ family: "all", scenario: "all" })}
          disabled={disabled}
        >
          Reset filters
        </Button>
      </div>
    </div>
  );
}

function Kpi({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="rounded-md border border-border bg-card p-4">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums">{value}</div>
      {sub && <div className="mt-1 text-xs text-muted-foreground">{sub}</div>}
    </div>
  );
}

function KpiGrid({ m }: { m: AnalyticsMetrics }) {
  return (
    <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-4">
      <Kpi label="Accessions in scope" value={String(m.totalAccessions)} />
      <Kpi
        label="Time on task (median)"
        value={formatMinutes(m.timeOnTask.medianMin)}
        sub={`mean ${formatMinutes(m.timeOnTask.meanMin)} · n=${m.timeOnTask.count}`}
      />
      <Kpi
        label="Release success rate"
        value={formatPct(m.releaseSuccessRate)}
        sub={`${m.releasedCount} released · ${m.amendedCount} amended`}
      />
      <Kpi
        label="Blocker rate"
        value={formatPct(m.blockerRate)}
        sub={`${m.blockedAccessions} accession(s) blocked`}
      />
      <Kpi
        label="IPC alert rate"
        value={`${m.ipcAlertRate.toFixed(2)} / case`}
        sub={`${m.ipcSignalCount} total signals`}
      />
      <Kpi
        label="AMS approval cycle (median)"
        value={formatMinutes(m.amsApprovalCycleTime.medianMin)}
        sub={`${m.amsRequested} requested · ${m.amsApproved} approved · ${m.amsDenied} denied · ${m.amsExpired} expired`}
      />
      <Kpi
        label="Dispatch success"
        value={formatPct(m.dispatch.successRate)}
        sub={`${m.dispatch.sent} sent · ${m.dispatch.failed} failed · ${m.dispatch.skipped} skipped`}
      />
      <Kpi
        label="Exports total"
        value={String(m.exportsByFormat.reduce((s, r) => s + r.count, 0))}
        sub="grouped by format below"
      />
    </div>
  );
}

function DistroCard({
  title,
  rows,
  total,
}: {
  title: string;
  rows: Array<{ label: string; value: number }>;
  total: number;
}) {
  return (
    <div className="rounded-md border border-border bg-card p-4">
      <div className="mb-2 text-sm font-medium">{title}</div>
      {rows.length === 0 ? (
        <div className="text-xs text-muted-foreground">No data.</div>
      ) : (
        <ul className="space-y-1.5">
          {rows.map((r) => {
            const pct = total > 0 ? r.value / total : 0;
            return (
              <li key={r.label} className="text-xs">
                <div className="mb-0.5 flex justify-between">
                  <span className="font-mono">{r.label}</span>
                  <span className="text-muted-foreground tabular-nums">
                    {r.value} · {formatPct(pct)}
                  </span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded bg-muted">
                  <div
                    className="h-full bg-primary"
                    style={{ width: `${Math.max(2, pct * 100).toFixed(1)}%` }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function DispatchCard({ m }: { m: AnalyticsMetrics }) {
  const items = [
    { label: "Sent", value: m.dispatch.sent, tone: "bg-primary" },
    { label: "Failed", value: m.dispatch.failed, tone: "bg-destructive" },
    { label: "Skipped", value: m.dispatch.skipped, tone: "bg-muted-foreground/60" },
    { label: "Other", value: m.dispatch.other, tone: "bg-secondary-foreground/40" },
  ];
  const total = items.reduce((s, i) => s + i.value, 0);
  return (
    <div className="rounded-md border border-border bg-card p-4">
      <div className="mb-2 text-sm font-medium">Dispatch outcomes</div>
      {total === 0 ? (
        <div className="text-xs text-muted-foreground">No dispatches in scope.</div>
      ) : (
        <ul className="space-y-1.5">
          {items.map((i) => {
            const pct = total > 0 ? i.value / total : 0;
            return (
              <li key={i.label} className="text-xs">
                <div className="mb-0.5 flex justify-between">
                  <span>{i.label}</span>
                  <span className="text-muted-foreground tabular-nums">
                    {i.value} · {formatPct(pct)}
                  </span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded bg-muted">
                  <div
                    className={`h-full ${i.tone}`}
                    style={{ width: `${Math.max(2, pct * 100).toFixed(1)}%` }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function ScopeNote() {
  return (
    <div className="rounded-md border border-dashed border-border bg-muted/30 p-3 text-[11px] text-muted-foreground">
      <strong className="text-foreground">Browser-phase scope.</strong>{" "}
      Metrics are computed in this browser tab over the accessions hydrated for
      the current tenant plus the most recent audit and dispatch rows visible
      under RLS. There is no warehouse pipeline, no historical backfill, and
      no production observability claim. A future backend-owned analytics
      service can replace the source adapter without changing the dashboard.
    </div>
  );
}
