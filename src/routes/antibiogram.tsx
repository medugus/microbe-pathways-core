import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
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
import { CloudHydrationGate } from "@/medugu/store/CloudHydrationGate";
import { useMeduguState } from "@/medugu/store/useAccessionStore";
import { SPECIMEN_FAMILIES } from "@/medugu/config/specimenFamilies";
import { ORGANISMS } from "@/medugu/config/organisms";
import {
  computeLiveAntibiogram,
  type AntibiogramCell,
  type AntibiogramFilters,
  type LiveAntibiogram,
} from "@/medugu/logic/antibiogramEngine";

export const Route = createFileRoute("/antibiogram")({
  head: () => ({
    meta: [
      { title: "Live antibiogram — Medugu" },
      {
        name: "description",
        content: "Live cumulative antibiogram dashboard generated from LIMS AST entries.",
      },
    ],
  }),
  component: AntibiogramPage,
});

const ORGANISM_GROUPS = Array.from(
  new Set(ORGANISMS.map((organism) => organism.group ?? "other")),
).sort();

function AntibiogramPage() {
  return (
    <RequireAuth>
      <CloudHydrationGate>
        <div className="min-h-screen bg-background">
          <SessionBar />
          <AntibiogramDashboard />
        </div>
      </CloudHydrationGate>
    </RequireAuth>
  );
}

function AntibiogramDashboard() {
  const state = useMeduguState();
  const [filters, setFilters] = useState<AntibiogramFilters>({
    specimenFamily: "all",
    organismGroup: "all",
    minCount: 30,
    includeDraft: true,
  });

  const data = useMemo(() => computeLiveAntibiogram(state, filters), [state, filters]);

  return (
    <main className="mx-auto max-w-[1500px] space-y-5 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-primary">
            Live cumulative AST
          </p>
          <h1 className="text-2xl font-semibold">Live antibiogram dashboard</h1>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            Updates automatically as new AST rows are added in the LIMS. M39-style calculation:
            first patient-isolate per organism and drug, shown as percent susceptible with denominator.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link to="/workspace">Open workspace</Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link to="/">Back to hub</Link>
          </Button>
        </div>
      </div>

      <FilterBar filters={filters} onChange={setFilters} />
      <KpiStrip data={data} />
      <AntibiogramTable data={data} />
      <InterpretationNote data={data} />
    </main>
  );
}

function FilterBar({
  filters,
  onChange,
}: {
  filters: AntibiogramFilters;
  onChange: (filters: AntibiogramFilters) => void;
}) {
  return (
    <div className="grid gap-3 rounded-lg border border-border bg-card p-3 lg:grid-cols-6">
      <div>
        <Label className="text-[11px] uppercase text-muted-foreground">From</Label>
        <Input
          className="mt-1"
          type="date"
          value={filters.fromDate ?? ""}
          onChange={(event) => onChange({ ...filters, fromDate: event.target.value || undefined })}
        />
      </div>
      <div>
        <Label className="text-[11px] uppercase text-muted-foreground">To</Label>
        <Input
          className="mt-1"
          type="date"
          value={filters.toDate ?? ""}
          onChange={(event) => onChange({ ...filters, toDate: event.target.value || undefined })}
        />
      </div>
      <div>
        <Label className="text-[11px] uppercase text-muted-foreground">Specimen</Label>
        <Select
          value={filters.specimenFamily ?? "all"}
          onValueChange={(value) => onChange({ ...filters, specimenFamily: value })}
        >
          <SelectTrigger className="mt-1">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All specimen types</SelectItem>
            {SPECIMEN_FAMILIES.map((family) => (
              <SelectItem key={family.code} value={family.code}>
                {family.display}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label className="text-[11px] uppercase text-muted-foreground">Organism group</Label>
        <Select
          value={filters.organismGroup ?? "all"}
          onValueChange={(value) => onChange({ ...filters, organismGroup: value })}
        >
          <SelectTrigger className="mt-1">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All groups</SelectItem>
            {ORGANISM_GROUPS.map((group) => (
              <SelectItem key={group} value={group}>
                {group.replace(/_/g, " ")}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label className="text-[11px] uppercase text-muted-foreground">Minimum n</Label>
        <Input
          className="mt-1"
          type="number"
          min={1}
          max={500}
          value={filters.minCount ?? 30}
          onChange={(event) =>
            onChange({
              ...filters,
              minCount: Math.max(1, Number(event.target.value || 30)),
            })
          }
        />
      </div>
      <div className="flex items-end gap-2">
        <Button
          type="button"
          variant={filters.includeDraft === false ? "outline" : "default"}
          size="sm"
          onClick={() => onChange({ ...filters, includeDraft: filters.includeDraft === false })}
          title="When on, interpreted/draft AST rows populate the live dashboard immediately."
        >
          {filters.includeDraft === false ? "Reviewed only" : "Live all rows"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() =>
            onChange({
              specimenFamily: "all",
              organismGroup: "all",
              minCount: 30,
              includeDraft: true,
            })
          }
        >
          Reset
        </Button>
      </div>
    </div>
  );
}

function KpiStrip({ data }: { data: LiveAntibiogram }) {
  return (
    <div className="grid gap-3 md:grid-cols-4">
      <Kpi label="Accessions in scope" value={String(data.accessionsInScope)} />
      <Kpi label="AST rows read" value={String(data.astRowsInScope)} />
      <Kpi label="Organisms" value={String(data.organismRows.length)} />
      <Kpi
        label="Low-n cells"
        value={String(data.lowCountCellCount)}
        sub={`Minimum denominator: ${data.filters.minCount}`}
      />
    </div>
  );
}

function Kpi({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums">{value}</div>
      {sub && <div className="mt-1 text-xs text-muted-foreground">{sub}</div>}
    </div>
  );
}

function AntibiogramTable({ data }: { data: LiveAntibiogram }) {
  if (data.organismRows.length === 0 || data.antibioticCodes.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">
        No interpretable S/I/R AST rows match the selected filters yet. Add AST entries in the
        workspace and this dashboard will populate automatically.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-card shadow-sm">
      <table className="w-full border-collapse text-xs">
        <thead>
          <tr className="border-b border-border bg-muted/60">
            <th className="sticky left-0 z-20 min-w-[260px] bg-muted/95 px-3 py-3 text-left text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Organism
            </th>
            {data.antibioticCodes.map((code) => (
              <th
                key={code}
                className="min-w-[92px] border-l border-border px-2 py-3 text-center align-bottom"
                title={data.organismRows.find((row) => row.cells[code])?.cells[code]?.antibioticName ?? code}
              >
                <div className="font-mono text-[11px] font-bold text-foreground">{code}</div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.organismRows.map((row) => (
            <tr key={row.organismCode} className="border-t border-border">
              <th className="sticky left-0 z-10 bg-card px-3 py-2 text-left align-top">
                <div className="font-semibold text-foreground">{row.organismName}</div>
                <div className="mt-0.5 text-[10px] text-muted-foreground">
                  {row.organismCode} · {row.organismGroup.replace(/_/g, " ")}
                </div>
                <div className="mt-1 flex flex-wrap gap-1">
                  <span className="chip chip-square chip-neutral">{row.patientCount} patient(s)</span>
                  <span className="chip chip-square chip-neutral">{row.isolateCount} isolate(s)</span>
                </div>
              </th>
              {data.antibioticCodes.map((code) => (
                <td key={`${row.organismCode}-${code}`} className="border-l border-border p-1.5 align-top">
                  <AntibiogramCellView cell={row.cells[code]} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AntibiogramCellView({ cell }: { cell?: AntibiogramCell }) {
  if (!cell) {
    return (
      <div className="rounded border border-dashed border-border px-2 py-3 text-center text-muted-foreground/60">
        -
      </div>
    );
  }

  const tone = cell.lowCount
    ? "border-slate-300 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-300"
    : cell.susceptiblePercent >= 90
      ? "border-emerald-500/30 bg-emerald-500/15 text-emerald-800 dark:text-emerald-200"
      : cell.susceptiblePercent >= 80
        ? "border-sky-500/30 bg-sky-500/15 text-sky-800 dark:text-sky-200"
        : cell.susceptiblePercent >= 60
          ? "border-amber-500/30 bg-amber-500/15 text-amber-800 dark:text-amber-200"
          : "border-destructive/30 bg-destructive/15 text-destructive";

  return (
    <div className={`rounded border px-2 py-2 text-center ${tone}`}>
      <div className="text-base font-bold tabular-nums">{cell.susceptiblePercent.toFixed(1)}%</div>
      <div className="text-[10px] font-semibold uppercase tracking-wide">%S</div>
      <div className="mt-1 text-[10px] text-current/75">
        n={cell.total} · S {cell.susceptible} / I {cell.increasedExposure} / R {cell.resistant}
      </div>
      {cell.lowCount && <div className="mt-1 text-[9px] font-semibold uppercase">low n</div>}
    </div>
  );
}

function InterpretationNote({ data }: { data: LiveAntibiogram }) {
  return (
    <div className="rounded-lg border border-dashed border-border bg-muted/40 p-3 text-[11px] leading-relaxed text-muted-foreground">
      <strong className="text-foreground">Scope and caution.</strong> This is a live operational
      antibiogram, not a published annual surveillance report. It updates from the hydrated LIMS
      accessions in this tenant/session. It uses S/I/R rows only, deduplicates to the first
      patient-organism-drug result in the selected period, and marks any cell below n=
      {data.filters.minCount}. Use released/reviewed-only mode before exporting numbers for policy
      or stewardship meetings.
    </div>
  );
}
