// BottleResultsEditor — per-set / per-bottle growth tracker for blood cultures.
//
// Renders the (setNo × bottleType) matrix from accession.specimen.details.sets
// and lets the user mark each bottle as growth / no-growth / pending. When
// "growth" is selected, a positivity datetime can be captured; the time-to-
// positivity (hours) is then computed against the set's drawTime and stored
// alongside the row so downstream engines (differential TTP for line vs
// peripheral, sepsis flags, etc.) can read it without re-deriving.
//
// Pure UI. No clinical rule logic; merely persists Isolate.bottleResults via
// meduguActions.updateIsolate.

import { useMemo } from "react";
import { meduguActions } from "../../store/useAccessionStore";
import type { Accession, BloodBottleResult, BottleGrowthState, Isolate } from "../../domain/types";
import { BottleIncubationBoard } from "./BottleIncubationBoard";

const BOTTLE_LABEL: Record<string, string> = {
  AEROBIC: "Aerobic",
  ANAEROBIC: "Anaerobic",
  PAEDIATRIC: "Paediatric",
  MYCOLOGY: "Mycology",
  MYCOBACTERIAL: "Mycobacterial",
  ISOLATOR: "Isolator",
};

// Bench-conventional ordering: anaerobic → aerobic → paeds → specialty.
// Mirrors BottleIncubationBoard so rows align across views.
const BOTTLE_SORT_RANK: Record<string, number> = {
  ANAEROBIC: 0,
  AEROBIC: 1,
  PAEDIATRIC: 2,
  MYCOLOGY: 3,
  MYCOBACTERIAL: 4,
  ISOLATOR: 5,
};

function bottleSortKey(bottle: string): number {
  return BOTTLE_SORT_RANK[bottle] ?? 99;
}

interface SetRow {
  setNo: number;
  drawSite: string;
  lumenLabel?: string;
  bottleTypes: string[];
  drawTime?: string;
}

interface Props {
  accession: Accession;
  isolate: Isolate;
}

function readSets(accession: Accession): SetRow[] {
  const details = (accession.specimen.details ?? {}) as Record<string, unknown>;
  const raw = Array.isArray(details.sets) ? (details.sets as Array<Record<string, unknown>>) : [];
  return raw.map((s, idx) => ({
    setNo: idx + 1,
    drawSite: typeof s.drawSite === "string" ? s.drawSite : "",
    lumenLabel: typeof s.lumenLabel === "string" && s.lumenLabel ? s.lumenLabel : undefined,
    bottleTypes: Array.isArray(s.bottleTypes) ? (s.bottleTypes as string[]) : [],
    drawTime: typeof s.drawTime === "string" ? s.drawTime : undefined,
  }));
}

function computeTtp(drawTime?: string, positiveAt?: string): number | undefined {
  if (!drawTime || !positiveAt) return undefined;
  const t0 = new Date(drawTime).getTime();
  const t1 = new Date(positiveAt).getTime();
  if (!Number.isFinite(t0) || !Number.isFinite(t1) || t1 < t0) return undefined;
  return Math.round(((t1 - t0) / 36e5) * 10) / 10; // 1-decimal hours
}

export function BottleResultsEditor({ accession, isolate }: Props) {
  const sets = useMemo(() => readSets(accession), [accession]);
  const existing = isolate.bottleResults ?? [];

  if (sets.length === 0) {
    return (
      <p className="text-[11px] text-muted-foreground">
        No blood culture sets defined yet — record sets in the Specimen section to enable per-bottle growth tracking.
      </p>
    );
  }

  function findRow(setNo: number, bottleType: string): BloodBottleResult | undefined {
    return existing.find((r) => r.setNo === setNo && r.bottleType === bottleType);
  }

  function persist(next: BloodBottleResult[]) {
    meduguActions.updateIsolate(accession.id, isolate.id, { bottleResults: next });
  }

  function upsert(setNo: number, bottleType: string, patch: Partial<BloodBottleResult>) {
    const set = sets.find((s) => s.setNo === setNo);
    const current = findRow(setNo, bottleType) ?? { setNo, bottleType, growth: "pending" as BottleGrowthState };
    const merged: BloodBottleResult = { ...current, ...patch };
    if (merged.growth !== "growth") {
      merged.positiveAt = undefined;
      merged.ttpHours = undefined;
    } else {
      merged.ttpHours = computeTtp(set?.drawTime, merged.positiveAt);
    }
    const next = existing.filter((r) => !(r.setNo === setNo && r.bottleType === bottleType));
    next.push(merged);
    next.sort((a, b) => a.setNo - b.setNo || a.bottleType.localeCompare(b.bottleType));
    persist(next);
  }

  function linkedOrganisms(setNo: number, bottleType: string): string[] {
    return accession.isolates
      .filter((iso) =>
        (iso.bloodSourceLinks ?? []).some(
          (link) => link.setNo === setNo && link.bottleType === bottleType,
        ),
      )
      .map((iso) => iso.organismDisplay);
  }

  // Differential TTP hint (display-only, no clinical decision):
  // central-line bottle positive ≥ 2h before paired peripheral bottle in the
  // same isolate suggests CLABSI workup. We expose the gap so downstream rules
  // can act on it later.
  const ttpHint = useMemo(() => {
    const linePositives = existing.filter((r) => r.growth === "growth" && r.ttpHours !== undefined && isLineSet(sets, r.setNo));
    const periphPositives = existing.filter((r) => r.growth === "growth" && r.ttpHours !== undefined && !isLineSet(sets, r.setNo));
    if (linePositives.length === 0 || periphPositives.length === 0) return null;
    const minLine = Math.min(...linePositives.map((r) => r.ttpHours!));
    const minPeriph = Math.min(...periphPositives.map((r) => r.ttpHours!));
    const delta = Math.round((minPeriph - minLine) * 10) / 10;
    return { delta, minLine, minPeriph };
  }, [existing, sets]);

  return (
    <div className="space-y-2">
      <BottleIncubationBoard sets={sets} bottleResults={existing} />
      <div className="overflow-x-auto rounded border border-border">
        <table className="w-full text-xs">
          <thead className="bg-muted/40 text-[10px] uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="p-1.5 text-left">Set</th>
              <th className="p-1.5 text-left">Bottle</th>
              <th className="p-1.5 text-left">Growth</th>
              <th className="p-1.5 text-left">Positive at</th>
              <th className="p-1.5 text-left">TTP (h)</th>
              <th className="p-1.5 text-left">Linked organism(s)</th>
            </tr>
          </thead>
          <tbody>
            {sets.flatMap((set) =>
              set.bottleTypes.map((bottle) => {
                const row = findRow(set.setNo, bottle);
                const growth = row?.growth ?? "pending";
                const linked = linkedOrganisms(set.setNo, bottle);
                return (
                  <tr key={`${set.setNo}-${bottle}`} className="border-t border-border align-middle">
                    <td className="p-1.5 font-mono text-foreground">
                      #{set.setNo}
                      <span className="ml-1 text-[10px] text-muted-foreground">
                        {set.drawSite ? set.drawSite.replace(/_/g, " ").toLowerCase() : "—"}
                        {set.lumenLabel ? ` · ${set.lumenLabel}` : ""}
                      </span>
                    </td>
                    <td className="p-1.5 text-foreground">{BOTTLE_LABEL[bottle] ?? bottle}</td>
                    <td className="p-1.5">
                      <select
                        value={growth}
                        onChange={(e) =>
                          upsert(set.setNo, bottle, { growth: e.target.value as BottleGrowthState })
                        }
                        className={`rounded border bg-background px-1.5 py-1 text-xs ${
                          growth === "growth"
                            ? "border-destructive text-destructive"
                            : growth === "no_growth"
                              ? "border-border text-muted-foreground"
                              : "border-border text-foreground"
                        }`}
                      >
                        <option value="pending">Pending</option>
                        <option value="growth">Growth</option>
                        <option value="no_growth">No growth</option>
                      </select>
                    </td>
                    <td className="p-1.5">
                      <input
                        type="datetime-local"
                        disabled={growth !== "growth"}
                        value={row?.positiveAt && row.positiveAt.length >= 16 ? row.positiveAt.slice(0, 16) : row?.positiveAt ?? ""}
                        onChange={(e) => upsert(set.setNo, bottle, { positiveAt: e.target.value })}
                        className="w-full rounded border border-border bg-background px-1.5 py-1 text-xs disabled:opacity-50"
                      />
                    </td>
                    <td className="p-1.5 font-mono text-muted-foreground">
                      {row?.ttpHours !== undefined ? `${row.ttpHours} h` : "—"}
                    </td>
                    <td className="p-1.5 text-[11px] text-muted-foreground">
                      {linked.length === 0
                        ? "none"
                        : linked.length === 1
                          ? linked[0]
                          : linked.join("; ")}
                    </td>
                  </tr>
                );
              }),
            )}
          </tbody>
        </table>
      </div>

      {ttpHint && (
        <p className="text-[11px] text-muted-foreground">
          Differential TTP: line bottle first positive at {ttpHint.minLine} h, peripheral at {ttpHint.minPeriph} h
          {" "}(Δ {ttpHint.delta} h){ttpHint.delta >= 2 ? " — meets ≥2 h threshold for CLABSI workup." : "."}
        </p>
      )}
    </div>
  );
}

const LINE_DRAW_SITES_BR = new Set([
  "CENTRAL_LINE", "PICC", "HICKMAN", "BROVIAC", "GROSHONG",
  "PORTACATH", "DIALYSIS_CATHETER", "ARTERIAL_LINE", "UMBILICAL",
]);

function isLineSet(sets: SetRow[], setNo: number): boolean {
  const s = sets.find((x) => x.setNo === setNo);
  if (!s) return false;
  return LINE_DRAW_SITES_BR.has(s.drawSite);
}
