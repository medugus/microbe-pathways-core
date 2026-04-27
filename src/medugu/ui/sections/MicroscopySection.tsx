// MicroscopySection — driven by the resolver's MicroscopyConfig.
// Required microscopy items are clickable: clicking opens an inline numeric
// input + unit selector so the value can be recorded against the accession.
// Recorded values are mirrored on the pill, and the recorded count updates.

import { useState } from "react";
import { useActiveAccession } from "../../store/useAccessionStore";
import { meduguActions } from "../../store/useAccessionStore";
import { resolveSpecimen } from "../../logic/specimenResolver";
import type { Microscopy } from "../../domain/types";
import { Input } from "@/components/ui/input";

const MICRO_LABELS: Record<string, string> = {
  gram: "Gram stain",
  cellCountWBC: "WBC count",
  cellCountRBC: "RBC count",
  differential: "Differential",
  afbStain: "AFB stain",
  indiaInk: "India ink",
  wetMount: "Wet mount",
  qualityScore_Bartlett: "Bartlett quality score",
  epithelialCells: "Squamous epithelial cells",
  leukocytes: "Leukocytes",
};

// Per-key default units for the inline editor.
const MICRO_UNITS: Record<string, string[]> = {
  cellCountWBC: ["cells/µL", "cells/hpf"],
  cellCountRBC: ["cells/µL", "cells/hpf"],
  leukocytes: ["cells/hpf", "cells/lpf"],
  epithelialCells: ["cells/hpf", "cells/lpf"],
  qualityScore_Bartlett: ["score"],
};

function unitsFor(key: string): string[] {
  return MICRO_UNITS[key] ?? ["cells/hpf", "cells/lpf", "cells/µL", "score"];
}

function findFinding(list: Microscopy[], key: string): Microscopy | undefined {
  return list.find((m) => m.stainCode === key);
}

export function MicroscopySection() {
  const accession = useActiveAccession();
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [draftValue, setDraftValue] = useState<string>("");
  const [draftUnit, setDraftUnit] = useState<string>("");

  if (!accession) {
    return (
      <div className="rounded-lg border border-border bg-card p-8 text-center text-sm text-muted-foreground">
        No active accession.
      </div>
    );
  }

  const result = resolveSpecimen(accession.specimen.familyCode, accession.specimen.subtypeCode);
  if (!result.ok) {
    return (
      <p className="text-sm text-destructive">
        Cannot configure microscopy — specimen unresolved ({result.reason}).
      </p>
    );
  }

  const m = result.profile.microscopy;
  const recorded = accession.microscopy.length;

  function openEditor(key: string) {
    if (!accession) return;
    const existing = findFinding(accession.microscopy, key);
    const units = unitsFor(key);
    setOpenKey(key);
    setDraftValue(existing?.cellsPerHpf !== undefined ? String(existing.cellsPerHpf) : "");
    // Try to parse unit from existing.result ("12 cells/hpf"), else default.
    const fromResult =
      typeof existing?.result === "string" ? existing.result.split(" ").slice(1).join(" ") : "";
    setDraftUnit(fromResult && units.includes(fromResult) ? fromResult : units[0]);
  }

  function saveEditor() {
    if (!accession || !openKey) return;
    const num = Number(draftValue);
    if (!Number.isFinite(num)) {
      setOpenKey(null);
      return;
    }
    const existing = findFinding(accession.microscopy, openKey);
    const finding: Microscopy = {
      id: existing?.id ?? `m_${openKey}_${Date.now().toString(36)}`,
      stainCode: openKey,
      result: `${num} ${draftUnit}`.trim(),
      cellsPerHpf: num,
    };
    const nextList = existing
      ? accession.microscopy.map((x) => (x.id === existing.id ? finding : x))
      : [...accession.microscopy, finding];
    meduguActions.upsertAccession({ ...accession, microscopy: nextList });
    setOpenKey(null);
  }

  function clearFinding(key: string) {
    if (!accession) return;
    meduguActions.upsertAccession({
      ...accession,
      microscopy: accession.microscopy.filter((x) => x.stainCode !== key),
    });
    if (openKey === key) setOpenKey(null);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="rounded bg-muted px-2 py-1 text-muted-foreground">
          {recorded} finding(s) recorded
        </span>
        {m.structured && (
          <span className="rounded bg-secondary px-2 py-1 text-secondary-foreground">
            structured entry
          </span>
        )}
        {m.gatesCulture && (
          <span className="rounded bg-destructive/15 px-2 py-1 text-destructive">
            quality gates culture
          </span>
        )}
      </div>

      <section>
        <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Required microscopy
        </h4>
        {m.required.length === 0 ? (
          <p className="text-xs text-muted-foreground">No required microscopy for this specimen.</p>
        ) : (
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {m.required.map((k) => {
              const finding = findFinding(accession.microscopy, k);
              const isOpen = openKey === k;
              const units = unitsFor(k);
              return (
                <li
                  key={k}
                  className="rounded border border-border bg-background px-3 py-2 text-sm"
                >
                  <button
                    type="button"
                    onClick={() => (isOpen ? setOpenKey(null) : openEditor(k))}
                    className="flex w-full items-center justify-between text-left"
                    aria-expanded={isOpen}
                  >
                    <span className="text-foreground">{MICRO_LABELS[k] ?? k}</span>
                    <span className="flex items-center gap-2">
                      {finding ? (
                        <span className="rounded bg-primary/10 px-2 py-0.5 text-xs font-mono text-primary">
                          {typeof finding.result === "string"
                            ? finding.result
                            : String(finding.result)}
                        </span>
                      ) : (
                        <span className="rounded bg-muted px-2 py-0.5 text-[10px] uppercase text-muted-foreground">
                          tap to record
                        </span>
                      )}
                      <code className="text-[10px] text-muted-foreground">{k}</code>
                    </span>
                  </button>

                  {isOpen && (
                    <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-border pt-2">
                      <Input
                        type="number"
                        inputMode="decimal"
                        value={draftValue}
                        onChange={(e) => setDraftValue(e.target.value)}
                        placeholder="value"
                        className="h-8 w-28"
                        autoFocus
                      />
                      <select
                        value={draftUnit}
                        onChange={(e) => setDraftUnit(e.target.value)}
                        className="h-8 rounded-md border border-input bg-transparent px-2 text-xs"
                      >
                        {units.map((u) => (
                          <option key={u} value={u}>
                            {u}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={saveEditor}
                        className="h-8 rounded bg-primary px-3 text-xs font-medium text-primary-foreground"
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        onClick={() => setOpenKey(null)}
                        className="h-8 rounded border border-border bg-background px-3 text-xs text-muted-foreground"
                      >
                        Cancel
                      </button>
                      {finding && (
                        <button
                          type="button"
                          onClick={() => clearFinding(k)}
                          className="h-8 rounded text-xs text-destructive hover:underline"
                        >
                          Clear
                        </button>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {m.optional.length > 0 && (
        <section>
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Optional microscopy
          </h4>
          <ul className="flex flex-wrap gap-1.5">
            {m.optional.map((k) => (
              <li key={k} className="rounded bg-muted px-2 py-1 text-xs text-foreground">
                {MICRO_LABELS[k] ?? k}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
