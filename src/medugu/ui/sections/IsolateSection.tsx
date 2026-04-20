// IsolateSection — working editor for isolates per accession.
// All business logic lives in logic/isolateHelpers.ts and config/organisms.ts.

import { useState } from "react";
import { meduguActions, useActiveAccession } from "../../store/useAccessionStore";
import {
  ORGANISMS,
  GROWTH_QUANTIFIERS,
  SIGNIFICANCE_OPTIONS,
} from "../../config/organisms";
import {
  buildIsolate,
  describeGrowth,
  suggestSignificance,
} from "../../logic/isolateHelpers";
import type { IsolateSignificance } from "../../domain/types";

export function IsolateSection() {
  const accession = useActiveAccession();
  const [organismCode, setOrganismCode] = useState<string>(ORGANISMS[0].code);
  const [growthCode, setGrowthCode] = useState<string>("");
  const [colonyCount, setColonyCount] = useState<string>("");
  const [purity, setPurity] = useState(false);
  const [mixed, setMixed] = useState(false);

  if (!accession) {
    return (
      <div className="rounded-lg border border-border bg-card p-8 text-center text-sm text-muted-foreground">
        No active accession.
      </div>
    );
  }

  function onAdd() {
    if (!accession) return;
    const cfu = colonyCount.trim() === "" ? undefined : Number(colonyCount);
    const iso = buildIsolate(accession, organismCode, {
      growthQuantifierCode: growthCode || undefined,
      colonyCountCfuPerMl: Number.isFinite(cfu) ? cfu : undefined,
      purityFlag: purity || undefined,
      mixedGrowth: mixed || undefined,
      significance: suggestSignificance(accession, organismCode),
    });
    meduguActions.addIsolate(accession.id, iso);
    setColonyCount("");
    setPurity(false);
    setMixed(false);
  }

  return (
    <div className="space-y-5">
      {/* Entry row */}
      <div className="grid grid-cols-1 gap-3 rounded-md border border-border bg-background p-3 md:grid-cols-6">
        <label className="md:col-span-2 text-xs">
          <span className="block text-[10px] uppercase tracking-wide text-muted-foreground">Organism</span>
           <select
            value={organismCode}
            onChange={(e) => {
              const code = e.target.value;
              setOrganismCode(code);
              // Clear "No growth" selection when switching to a real organism
              const nonGrowthOrganisms = ["NOGRO", "MIXED", "NORML"];
              if (!nonGrowthOrganisms.includes(code) && growthCode === "NO_GROWTH") {
                setGrowthCode("");
              }
            }}
            className="mt-1 w-full rounded border border-border bg-card px-2 py-1.5 text-sm"
          >
            {ORGANISMS.map((o) => (
              <option key={o.code} value={o.code}>
                {o.display} ({o.code})
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs">
          <span className="block text-[10px] uppercase tracking-wide text-muted-foreground">Growth</span>
          <select
            value={growthCode}
            onChange={(e) => setGrowthCode(e.target.value)}
            className="mt-1 w-full rounded border border-border bg-card px-2 py-1.5 text-sm"
          >
            <option value="">—</option>
            {GROWTH_QUANTIFIERS
              .filter((g) => {
                // Hide "No growth" when a real organism is selected
                const nonGrowthOrganisms = ["NOGRO", "MIXED", "NORML"];
                if (g.code === "NO_GROWTH" && !nonGrowthOrganisms.includes(organismCode)) {
                  return false;
                }
                return true;
              })
              .map((g) => (
                <option key={g.code} value={g.code}>{g.display}</option>
              ))}
          </select>
        </label>
        <label className="text-xs">
          <span className="block text-[10px] uppercase tracking-wide text-muted-foreground">CFU/mL</span>
          <input
            value={colonyCount}
            onChange={(e) => setColonyCount(e.target.value)}
            inputMode="numeric"
            placeholder="e.g. 100000"
            className="mt-1 w-full rounded border border-border bg-card px-2 py-1.5 text-sm"
          />
        </label>
        <label className="flex items-end gap-2 text-xs">
          <input type="checkbox" checked={purity} onChange={(e) => setPurity(e.target.checked)} />
          <span>Pure</span>
        </label>
        <label className="flex items-end gap-2 text-xs">
          <input type="checkbox" checked={mixed} onChange={(e) => setMixed(e.target.checked)} />
          <span>Mixed</span>
        </label>
        <div className="md:col-span-6">
          <button
            type="button"
            onClick={onAdd}
            className="rounded bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90"
          >
            Add isolate
          </button>
        </div>
      </div>

      {/* Existing isolates */}
      {accession.isolates.length === 0 ? (
        <p className="text-xs text-muted-foreground">No isolates yet. Add one above (use "No growth" organism for explicit no-growth rows).</p>
      ) : (
        <ul className="space-y-2">
          {accession.isolates.map((i) => (
            <li
              key={i.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border bg-card p-3 text-sm"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">#{i.isolateNo}</span>
                  <span className="font-medium text-foreground">{i.organismDisplay}</span>
                  {i.purityFlag && <span className="rounded bg-secondary px-1.5 py-0.5 text-[10px] text-secondary-foreground">pure</span>}
                  {i.mixedGrowth && <span className="rounded bg-secondary px-1.5 py-0.5 text-[10px] text-secondary-foreground">mixed</span>}
                </div>
                <div className="mt-0.5 text-xs text-muted-foreground">
                  growth: {describeGrowth(i)}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <select
                  value={i.significance ?? "indeterminate"}
                  onChange={(e) =>
                    meduguActions.updateIsolate(accession.id, i.id, {
                      significance: e.target.value as IsolateSignificance,
                    })
                  }
                  className="rounded border border-border bg-background px-2 py-1 text-xs"
                >
                  {SIGNIFICANCE_OPTIONS.map((s) => (
                    <option key={s.code} value={s.code}>{s.display}</option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => meduguActions.removeIsolate(accession.id, i.id)}
                  className="rounded border border-border px-2 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  Remove
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
