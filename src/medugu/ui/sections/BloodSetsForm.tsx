// BloodSetsForm — per-set blood culture composer (Epic Beaker–style).
//
// Each blood culture *set* is one labelled draw with:
//   - its own draw site (peripheral L/R, central line, arterial, etc.)
//   - optional lumen label (for multi-lumen central / portacath workups)
//   - its own bottle types (aerobic, anaerobic, paeds, mycology, mycobacterial, isolator)
//   - its own draw time (for differential time-to-positivity)
//
// Pure UI. Persists to accession.specimen.details:
//   - sets:      BloodSet[]   (authoritative per-set rows)
//   - setCount:  number       (mirror of sets.length, for back-compat readers)
//   - bottleType: string[]    (union of all bottle types across sets, back-compat)
//   - drawSite / drawTime:   first set's values, back-compat for readers that
//                             only know the legacy flat shape
//
// No clinical rule logic lives here.

import { useMemo } from "react";
import { meduguActions } from "../../store/useAccessionStore";
import type { Accession } from "../../domain/types";
import { getPresetsForSubtype, type BloodWorkupPreset } from "../../config/bloodCulturePresets";
import { runValidation } from "../../logic/validationEngine";

// ---- coded option lists (display-only labels) ----
const BOTTLE_TYPES = [
  { code: "AEROBIC", display: "Aerobic" },
  { code: "ANAEROBIC", display: "Anaerobic" },
  { code: "PAEDIATRIC", display: "Paediatric" },
  { code: "MYCOLOGY", display: "Mycology / fungal" },
  { code: "MYCOBACTERIAL", display: "Mycobacterial (AFB)" },
  { code: "ISOLATOR", display: "Isolator / lysis-centrifugation" },
];

const DRAW_SITES = [
  { code: "PERIPHERAL_LEFT", display: "Peripheral — left arm" },
  { code: "PERIPHERAL_RIGHT", display: "Peripheral — right arm" },
  { code: "PERIPHERAL_OTHER", display: "Peripheral — other" },
  { code: "CENTRAL_LINE", display: "Central line" },
  { code: "ARTERIAL_LINE", display: "Arterial line" },
  { code: "PERIPHERAL_CANNULA", display: "Peripheral cannula" },
  { code: "PORTACATH", display: "Portacath" },
  { code: "FEMORAL", display: "Femoral" },
];

export interface BloodSet {
  id: string;
  drawSite: string;
  /** For multi-lumen lines / portacath. Free-text. */
  lumenLabel?: string;
  bottleTypes: string[];
  drawTime?: string; // ISO-ish (datetime-local)
}

interface Props {
  accession: Accession;
}

export function BloodSetsForm({ accession }: Props) {
  const details = accession.specimen.details ?? {};
  const sets: BloodSet[] = Array.isArray(details.sets) ? (details.sets as BloodSet[]) : [];
  const subtypeCode = accession.specimen.subtypeCode;
  const presets = useMemo(() => getPresetsForSubtype(subtypeCode), [subtypeCode]);

  function persist(nextSets: BloodSet[]) {
    const nextDetails: Record<string, unknown> = { ...details };
    nextDetails.sets = nextSets;
    nextDetails.setCount = nextSets.length;
    // Back-compat mirrors for readers that still consume the flat shape.
    const allBottles = Array.from(new Set(nextSets.flatMap((s) => s.bottleTypes)));
    nextDetails.bottleType = allBottles;
    if (nextSets.length > 0) {
      nextDetails.drawSite = nextSets[0].drawSite;
      if (nextSets[0].drawTime) nextDetails.drawTime = nextSets[0].drawTime;
    } else {
      delete nextDetails.drawSite;
      delete nextDetails.drawTime;
    }
    meduguActions.upsertAccession({
      ...accession,
      specimen: { ...accession.specimen, details: nextDetails },
    });
  }

  function newSetId() {
    return `set_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  }

  function addSet() {
    if (sets.length >= 6) return;
    persist([
      ...sets,
      {
        id: newSetId(),
        drawSite: "",
        bottleTypes: ["AEROBIC", "ANAEROBIC"],
      },
    ]);
  }

  function removeSet(id: string) {
    persist(sets.filter((s) => s.id !== id));
  }

  function updateSet(id: string, patch: Partial<BloodSet>) {
    persist(sets.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  }

  function applyPreset(preset: BloodWorkupPreset) {
    const nextSets: BloodSet[] = preset.sets.map((t) => ({
      id: newSetId(),
      drawSite: t.drawSite,
      lumenLabel: t.lumenLabel,
      bottleTypes: [...t.bottleTypes],
    }));
    persist(nextSets);
  }

  // ---- structural hints (display-only, not clinical rules) ----
  const hints: string[] = [];
  if (sets.length === 0) {
    hints.push("No sets defined — add at least one set or apply a preset.");
  } else {
    const sites = sets.map((s) => `${s.drawSite}${s.lumenLabel ? `|${s.lumenLabel}` : ""}`);
    const dupSites = sites.filter((s, i) => s && sites.indexOf(s) !== i);
    if (dupSites.length > 0) {
      hints.push("Two or more sets share the same draw site/lumen — each set should normally come from a distinct site.");
    }
    if (sets.some((s) => !s.drawSite)) {
      hints.push("One or more sets have no draw site selected.");
    }
    if (sets.some((s) => s.bottleTypes.length === 0)) {
      hints.push("One or more sets have no bottle types selected.");
    }
  }

  return (
    <div className="space-y-3">
      {/* Presets row */}
      <div className="rounded-lg border border-border bg-muted/30 p-3">
        <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Workup presets
        </div>
        <div className="flex flex-wrap gap-1.5">
          {presets.map((p) => (
            <button
              key={p.code}
              type="button"
              onClick={() => applyPreset(p)}
              title={p.rationale}
              className="rounded border border-border bg-background px-2 py-1 text-xs text-foreground transition hover:bg-accent hover:text-accent-foreground"
            >
              {p.display}
            </button>
          ))}
        </div>
        <p className="mt-1.5 text-[10px] leading-snug text-muted-foreground">
          Applying a preset replaces the current sets. You can edit any set after applying.
        </p>
      </div>

      {/* Sets list */}
      <div className="space-y-2">
        {sets.length === 0 && (
          <p className="rounded border border-dashed border-border p-3 text-xs text-muted-foreground">
            No sets yet. Add a set manually, or apply a preset above.
          </p>
        )}

        {sets.map((s, idx) => {
          const isLine =
            s.drawSite === "CENTRAL_LINE" || s.drawSite === "PORTACATH" || s.drawSite === "ARTERIAL_LINE";
          return (
            <div
              key={s.id}
              className="rounded-lg border border-border bg-card p-3"
            >
              <div className="mb-2 flex items-center justify-between">
                <span className="rounded bg-primary/10 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-primary">
                  Set {idx + 1}
                </span>
                <button
                  type="button"
                  onClick={() => removeSet(s.id)}
                  className="text-[11px] text-destructive hover:underline"
                >
                  Remove
                </button>
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {/* Draw site */}
                <div>
                  <label className="mb-1 block text-[10px] uppercase tracking-wide text-muted-foreground">
                    Draw site
                  </label>
                  <select
                    value={s.drawSite}
                    onChange={(e) => updateSet(s.id, { drawSite: e.target.value })}
                    className="w-full rounded border border-border bg-background px-2 py-1.5 text-sm"
                  >
                    <option value="">— select —</option>
                    {DRAW_SITES.map((o) => (
                      <option key={o.code} value={o.code}>
                        {o.display}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Lumen label (only for line draws) */}
                {isLine && (
                  <div>
                    <label className="mb-1 block text-[10px] uppercase tracking-wide text-muted-foreground">
                      Lumen / port label
                    </label>
                    <input
                      value={s.lumenLabel ?? ""}
                      onChange={(e) => updateSet(s.id, { lumenLabel: e.target.value })}
                      placeholder="e.g. Lumen 1 (proximal)"
                      className="w-full rounded border border-border bg-background px-2 py-1.5 text-sm"
                    />
                  </div>
                )}

                {/* Draw time */}
                <div className={isLine ? "" : "md:col-span-1"}>
                  <label className="mb-1 block text-[10px] uppercase tracking-wide text-muted-foreground">
                    Draw time
                  </label>
                  <input
                    type="datetime-local"
                    value={s.drawTime && s.drawTime.length >= 16 ? s.drawTime.slice(0, 16) : s.drawTime ?? ""}
                    onChange={(e) => updateSet(s.id, { drawTime: e.target.value })}
                    className="w-full rounded border border-border bg-background px-2 py-1.5 text-sm"
                  />
                </div>

                {/* Bottle types */}
                <div className="md:col-span-2">
                  <label className="mb-1 block text-[10px] uppercase tracking-wide text-muted-foreground">
                    Bottle types
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {BOTTLE_TYPES.map((b) => {
                      const active = s.bottleTypes.includes(b.code);
                      return (
                        <button
                          key={b.code}
                          type="button"
                          onClick={() => {
                            const next = active
                              ? s.bottleTypes.filter((c) => c !== b.code)
                              : [...s.bottleTypes, b.code];
                            updateSet(s.id, { bottleTypes: next });
                          }}
                          className={`rounded border px-2 py-1 text-xs transition ${
                            active
                              ? "border-primary bg-primary text-primary-foreground"
                              : "border-border bg-background text-foreground hover:bg-muted"
                          }`}
                        >
                          {active ? "✓ " : ""}
                          {b.display}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          );
        })}

        <button
          type="button"
          onClick={addSet}
          disabled={sets.length >= 6}
          className="w-full rounded border border-dashed border-border bg-background px-3 py-2 text-sm text-foreground transition hover:bg-muted disabled:opacity-50"
        >
          + Add set {sets.length > 0 ? `(${sets.length}/6)` : ""}
        </button>
      </div>

      {/* Structural hints */}
      {hints.length > 0 && (
        <ul className="space-y-1 rounded-md border border-amber-500/30 bg-amber-500/5 p-2 text-[11px] text-amber-700 dark:text-amber-300">
          {hints.map((h, i) => (
            <li key={i}>• {h}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
