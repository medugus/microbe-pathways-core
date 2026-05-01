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

import { Fragment, useMemo } from "react";
import { meduguActions } from "../../store/useAccessionStore";
import type {
  Accession,
  BloodBottleResult,
  BottleCriticalCall,
  BottleGramStain,
  BottleGrowthState,
  BottleLifecycleStatus,
  BottleTerminationReason,
  Isolate,
} from "../../domain/types";

const GRAM_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "—" },
  { value: "GPC_CLUSTERS", label: "GPC in clusters" },
  { value: "GPC_PAIRS_CHAINS", label: "GPC in pairs/chains" },
  { value: "GPC_OTHER", label: "GPC other" },
  { value: "GPR", label: "Gram-positive rods" },
  { value: "GNR", label: "Gram-negative rods" },
  { value: "GNC", label: "Gram-negative cocci" },
  { value: "YEAST", label: "Yeast" },
  { value: "MIXED", label: "Mixed morphology" },
  { value: "NO_ORGANISMS", label: "No organisms seen" },
];
import { BottleIncubationBoard } from "./BottleIncubationBoard";

const STATUS_LABEL: Record<BottleLifecycleStatus, string> = {
  received: "Received",
  loaded: "Loaded",
  incubating: "Incubating",
  flagged_positive: "Flagged +",
  removed: "Removed",
  terminal_negative: "No growth",
  discontinued: "Discontinued",
};

const STATUS_OPTIONS: BottleLifecycleStatus[] = [
  "received",
  "loaded",
  "incubating",
  "flagged_positive",
  "removed",
  "terminal_negative",
  "discontinued",
];

const TERMINATION_OPTIONS: { value: BottleTerminationReason; label: string }[] = [
  { value: "no_growth_complete", label: "No growth — full window" },
  { value: "clinician_request", label: "Clinician request" },
  { value: "contaminated", label: "Contaminated / discard" },
  { value: "lab_error", label: "Lab error" },
  { value: "broken_bottle", label: "Broken bottle" },
  { value: "other", label: "Other" },
];

/** Map lifecycle status → legacy growth field so downstream engines keep working. */
function deriveGrowth(status: BottleLifecycleStatus | undefined, fallback: BottleGrowthState): BottleGrowthState {
  if (!status) return fallback;
  if (status === "flagged_positive" || status === "removed") return "growth";
  if (status === "terminal_negative") return "no_growth";
  if (status === "discontinued") return "no_growth";
  return "pending";
}

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
  /**
   * Optional. When provided, the editor reads/writes only that isolate's
   * `bottleResults` (legacy per-isolate mode). When omitted, the editor
   * operates in **accession mode**: it aggregates bottle rows across every
   * isolate (deduped by setNo+bottleType, last-write wins) and routes new
   * writes to whichever isolate currently owns the row — falling back to
   * `accession.isolates[0]` for brand-new rows. Bottle facts (status,
   * Gram stain, critical call, TTP, termination) are specimen-level rather
   * than organism-level, so a single accession-level panel avoids the
   * confusing N-times duplication you otherwise see when multiple isolates
   * are present.
   */
  isolate?: Isolate;
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

function hoursBetween(start?: string, end?: string): number | undefined {
  if (!start || !end) return undefined;
  const t0 = new Date(start).getTime();
  const t1 = new Date(end).getTime();
  if (!Number.isFinite(t0) || !Number.isFinite(t1) || t1 < t0) return undefined;
  return Math.round(((t1 - t0) / 36e5) * 10) / 10;
}

export function BottleResultsEditor({ accession, isolate }: Props) {
  const sets = useMemo(() => readSets(accession), [accession]);

  // Aggregate bottle rows. In per-isolate mode we read just that isolate;
  // in accession mode we union across every isolate so the table renders
  // exactly once per accession instead of once per isolate.
  const existing: BloodBottleResult[] = useMemo(() => {
    if (isolate) return isolate.bottleResults ?? [];
    const seen = new Map<string, BloodBottleResult>();
    for (const iso of accession.isolates) {
      for (const r of iso.bottleResults ?? []) {
        // Last write wins on key collisions — should be rare since rows are
        // typically authored once and live on a single carrier isolate.
        seen.set(`${r.setNo}|${r.bottleType}`, r);
      }
    }
    return Array.from(seen.values());
  }, [isolate, accession.isolates]);

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

  /**
   * Find the isolate that currently owns a given (setNo, bottleType) row.
   * In per-isolate mode this is always the bound isolate. In accession mode
   * we look through every isolate; if none owns the row yet, the first
   * isolate becomes the carrier (or undefined when no isolates exist).
   */
  function ownerIsolateId(setNo: number, bottleType: string): string | undefined {
    if (isolate) return isolate.id;
    for (const iso of accession.isolates) {
      if ((iso.bottleResults ?? []).some((r) => r.setNo === setNo && r.bottleType === bottleType)) {
        return iso.id;
      }
    }
    return accession.isolates[0]?.id;
  }

  function persistFor(isoId: string, next: BloodBottleResult[]) {
    meduguActions.updateIsolate(accession.id, isoId, { bottleResults: next });
  }

  function upsert(setNo: number, bottleType: string, patch: Partial<BloodBottleResult>) {
    const set = sets.find((s) => s.setNo === setNo);
    const current = findRow(setNo, bottleType) ?? {
      setNo,
      bottleType,
      growth: "pending" as BottleGrowthState,
      status: "received" as BottleLifecycleStatus,
    };
    const merged: BloodBottleResult = { ...current, ...patch };

    // Re-derive legacy growth from lifecycle status whenever status is set.
    merged.growth = deriveGrowth(merged.status, merged.growth);

    // TTP semantics: Beaker = positiveAt − loadedAt. Pre-analytic value
    // (positiveAt − drawTime) is preserved separately as drawToPositiveHours.
    if (merged.growth !== "growth") {
      merged.positiveAt = undefined;
      merged.ttpHours = undefined;
      merged.drawToPositiveHours = undefined;
    } else {
      merged.ttpHours = hoursBetween(merged.loadedAt, merged.positiveAt)
        ?? hoursBetween(set?.drawTime, merged.positiveAt);
      merged.drawToPositiveHours = hoursBetween(set?.drawTime, merged.positiveAt);
    }

    // Auto-stamp terminatedAt when entering a terminal state.
    if (
      (merged.status === "terminal_negative" || merged.status === "discontinued") &&
      !merged.terminatedAt
    ) {
      merged.terminatedAt = new Date().toISOString();
    }

    const isoId = ownerIsolateId(setNo, bottleType);
    if (!isoId) {
      // No carrier isolate available (accession mode with zero isolates).
      // Silently no-op rather than crash; the UI gates editing behind an
      // explicit hint when this happens.
      return;
    }
    // Build the next bottleResults array for the OWNING isolate only,
    // so accession-mode writes don't accidentally fan out across isolates.
    const ownerIso = accession.isolates.find((i) => i.id === isoId);
    const ownerExisting = ownerIso?.bottleResults ?? [];
    const next = ownerExisting.filter(
      (r) => !(r.setNo === setNo && r.bottleType === bottleType),
    );
    next.push(merged);
    next.sort(
      (a, b) =>
        a.setNo - b.setNo ||
        bottleSortKey(a.bottleType) - bottleSortKey(b.bottleType) ||
        a.bottleType.localeCompare(b.bottleType),
    );
    persistFor(isoId, next);
  }

  function upsertGram(
    setNo: number,
    bottleType: string,
    row: BloodBottleResult | undefined,
    patch: Partial<BottleGramStain>,
  ) {
    const current: BottleGramStain = row?.gramStain ?? { result: "" };
    const next = { ...current, ...patch };
    upsert(setNo, bottleType, { gramStain: next });
  }

  function upsertCall(
    setNo: number,
    bottleType: string,
    row: BloodBottleResult | undefined,
    patch: Partial<BottleCriticalCall>,
  ) {
    const current: BottleCriticalCall = row?.criticalCall ?? {
      calledBy: "",
      calledTo: "",
      calledAt: "",
      readBack: false,
    };
    const next = { ...current, ...patch };
    upsert(setNo, bottleType, { criticalCall: next });
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
              <th className="p-1.5 text-left">Status</th>
              <th className="p-1.5 text-left">Loaded at</th>
              <th className="p-1.5 text-left">Positive at</th>
              <th className="p-1.5 text-left">TTP (h)</th>
              <th className="p-1.5 text-left">Termination</th>
              <th className="p-1.5 text-left">Linked organism(s)</th>
            </tr>
          </thead>
          <tbody>
            {sets.flatMap((set) =>
              [...set.bottleTypes]
                .sort((a, b) => bottleSortKey(a) - bottleSortKey(b))
                .map((bottle) => {
                const row = findRow(set.setNo, bottle);
                const status: BottleLifecycleStatus =
                  row?.status ??
                  (row?.growth === "growth"
                    ? "flagged_positive"
                    : row?.growth === "no_growth"
                      ? "terminal_negative"
                      : "received");
                const isPositive = status === "flagged_positive" || status === "removed";
                const isTerminal = status === "terminal_negative" || status === "discontinued";
                const linked = linkedOrganisms(set.setNo, bottle);
                return (
                  <Fragment key={`${set.setNo}-${bottle}`}>
                  <tr className="border-t border-border align-middle">
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
                        value={status}
                        onChange={(e) =>
                          upsert(set.setNo, bottle, {
                            status: e.target.value as BottleLifecycleStatus,
                          })
                        }
                        className={`rounded border bg-background px-1.5 py-1 text-xs ${
                          isPositive
                            ? "border-destructive text-destructive"
                            : isTerminal
                              ? "border-border text-muted-foreground"
                              : "border-border text-foreground"
                        }`}
                      >
                        {STATUS_OPTIONS.map((s) => (
                          <option key={s} value={s}>
                            {STATUS_LABEL[s]}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="p-1.5">
                      <input
                        type="datetime-local"
                        value={row?.loadedAt && row.loadedAt.length >= 16 ? row.loadedAt.slice(0, 16) : row?.loadedAt ?? ""}
                        onChange={(e) => upsert(set.setNo, bottle, { loadedAt: e.target.value })}
                        className="w-full rounded border border-border bg-background px-1.5 py-1 text-xs"
                      />
                    </td>
                    <td className="p-1.5">
                      <input
                        type="datetime-local"
                        disabled={!isPositive}
                        value={row?.positiveAt && row.positiveAt.length >= 16 ? row.positiveAt.slice(0, 16) : row?.positiveAt ?? ""}
                        onChange={(e) => upsert(set.setNo, bottle, { positiveAt: e.target.value })}
                        className="w-full rounded border border-border bg-background px-1.5 py-1 text-xs disabled:opacity-50"
                      />
                    </td>
                    <td className="p-1.5 font-mono text-muted-foreground">
                      {row?.ttpHours !== undefined ? (
                        <>
                          {row.ttpHours} h
                          {row.drawToPositiveHours !== undefined &&
                            row.drawToPositiveHours !== row.ttpHours && (
                              <span className="ml-1 text-[10px] opacity-70" title="Draw → positive (pre-analytic inclusive)">
                                (draw {row.drawToPositiveHours} h)
                              </span>
                            )}
                        </>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="p-1.5">
                      <select
                        disabled={!isTerminal}
                        value={row?.terminationReason ?? ""}
                        onChange={(e) =>
                          upsert(set.setNo, bottle, {
                            terminationReason: (e.target.value || undefined) as
                              | BottleTerminationReason
                              | undefined,
                          })
                        }
                        className="rounded border border-border bg-background px-1.5 py-1 text-xs disabled:opacity-50"
                      >
                        <option value="">—</option>
                        {TERMINATION_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="p-1.5 text-[11px] text-muted-foreground">
                      {linked.length === 0
                        ? "none"
                        : linked.length === 1
                          ? linked[0]
                          : linked.join("; ")}
                    </td>
                  </tr>
                  {isPositive && (
                    <tr className="border-t border-dashed border-border bg-muted/20 align-top">
                      <td colSpan={2} className="p-1.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                        Workup
                      </td>
                      <td colSpan={6} className="p-1.5">
                        <div className="grid gap-2 md:grid-cols-2">
                          {/* Gram stain */}
                          <div className="space-y-1 rounded border border-border bg-background p-2">
                            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                              Direct Gram (from bottle)
                            </p>
                            <div className="flex flex-wrap items-center gap-1.5">
                              <select
                                value={row?.gramStain?.result ?? ""}
                                onChange={(e) =>
                                  upsertGram(set.setNo, bottle, row, { result: e.target.value })
                                }
                                className="rounded border border-border bg-background px-1.5 py-1 text-xs"
                              >
                                {GRAM_OPTIONS.map((g) => (
                                  <option key={g.value} value={g.value}>{g.label}</option>
                                ))}
                              </select>
                              <input
                                type="text"
                                placeholder="Tech ID"
                                value={row?.gramStain?.performedBy ?? ""}
                                onChange={(e) =>
                                  upsertGram(set.setNo, bottle, row, { performedBy: e.target.value })
                                }
                                className="w-24 rounded border border-border bg-background px-1.5 py-1 text-xs"
                              />
                              <input
                                type="datetime-local"
                                value={row?.gramStain?.performedAt && row.gramStain.performedAt.length >= 16 ? row.gramStain.performedAt.slice(0, 16) : row?.gramStain?.performedAt ?? ""}
                                onChange={(e) =>
                                  upsertGram(set.setNo, bottle, row, { performedAt: e.target.value })
                                }
                                className="rounded border border-border bg-background px-1.5 py-1 text-xs"
                              />
                            </div>
                            <input
                              type="text"
                              placeholder="Morphology detail (optional)"
                              value={row?.gramStain?.morphology ?? ""}
                              onChange={(e) =>
                                upsertGram(set.setNo, bottle, row, { morphology: e.target.value })
                              }
                              className="w-full rounded border border-border bg-background px-1.5 py-1 text-xs"
                            />
                          </div>

                          {/* Critical call */}
                          <div className="space-y-1 rounded border border-border bg-background p-2">
                            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                              Critical call
                            </p>
                            <div className="flex flex-wrap items-center gap-1.5">
                              <input
                                type="text"
                                placeholder="Called by (tech)"
                                value={row?.criticalCall?.calledBy ?? ""}
                                onChange={(e) =>
                                  upsertCall(set.setNo, bottle, row, { calledBy: e.target.value })
                                }
                                className="w-28 rounded border border-border bg-background px-1.5 py-1 text-xs"
                              />
                              <input
                                type="text"
                                placeholder="Called to (clinician/role)"
                                value={row?.criticalCall?.calledTo ?? ""}
                                onChange={(e) =>
                                  upsertCall(set.setNo, bottle, row, { calledTo: e.target.value })
                                }
                                className="w-48 rounded border border-border bg-background px-1.5 py-1 text-xs"
                              />
                              <input
                                type="datetime-local"
                                value={row?.criticalCall?.calledAt && row.criticalCall.calledAt.length >= 16 ? row.criticalCall.calledAt.slice(0, 16) : row?.criticalCall?.calledAt ?? ""}
                                onChange={(e) =>
                                  upsertCall(set.setNo, bottle, row, { calledAt: e.target.value })
                                }
                                className="rounded border border-border bg-background px-1.5 py-1 text-xs"
                              />
                              <label className="flex items-center gap-1 text-[11px] text-muted-foreground">
                                <input
                                  type="checkbox"
                                  checked={!!row?.criticalCall?.readBack}
                                  onChange={(e) =>
                                    upsertCall(set.setNo, bottle, row, { readBack: e.target.checked })
                                  }
                                />
                                Read-back
                              </label>
                            </div>
                            <input
                              type="text"
                              placeholder="Notes (optional)"
                              value={row?.criticalCall?.notes ?? ""}
                              onChange={(e) =>
                                upsertCall(set.setNo, bottle, row, { notes: e.target.value })
                              }
                              className="w-full rounded border border-border bg-background px-1.5 py-1 text-xs"
                            />
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                  </Fragment>
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
