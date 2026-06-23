// MicroscopySection — driven by the resolver's MicroscopyConfig.
// Required microscopy items are clickable: clicking opens an inline numeric
// input + unit selector so the value can be recorded against the accession.
// Recorded values are mirrored on the pill, and the recorded count updates.

import { useState } from "react";
import { useActiveAccession } from "../../store/useAccessionStore";
import { meduguActions } from "../../store/useAccessionStore";
import { resolveSpecimen } from "../../logic/specimenResolver";
import type { Accession, Microscopy } from "../../domain/types";
import { Input } from "@/components/ui/input";
import {
  BV_SCREEN_DETAIL_KEY,
  BV_SCREEN_MICROSCOPY_CODE,
  evaluateBacterialVaginosisScreen,
  isBacterialVaginosisScreenSpecimen,
  normaliseBvScreenInput,
  type BacterialVaginosisScreenInput,
} from "../../logic/bacterialVaginosis";

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
  bacterialVaginosisScreen: "Bacterial vaginosis screen",
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

function booleanSelectValue(value: boolean | undefined) {
  if (value === undefined) return "";
  return value ? "true" : "false";
}

function selectBoolean(value: string): boolean | undefined {
  if (value === "true") return true;
  if (value === "false") return false;
  return undefined;
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
  const requiredMicroscopy = m.required.filter((k) => k !== BV_SCREEN_MICROSCOPY_CODE);
  const optionalMicroscopy = m.optional.filter((k) => k !== BV_SCREEN_MICROSCOPY_CODE);
  const showBvScreen = isBacterialVaginosisScreenSpecimen(
    accession.specimen.familyCode,
    accession.specimen.subtypeCode,
  );

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
        {requiredMicroscopy.length === 0 ? (
          <p className="text-xs text-muted-foreground">No required microscopy for this specimen.</p>
        ) : (
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {requiredMicroscopy.map((k) => {
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

      {showBvScreen && <BacterialVaginosisScreenPanel accession={accession} />}

      {optionalMicroscopy.length > 0 && (
        <section>
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Optional microscopy
          </h4>
          <ul className="flex flex-wrap gap-1.5">
            {optionalMicroscopy.map((k) => (
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

function BacterialVaginosisScreenPanel({ accession }: { accession: Accession }) {
  const details = accession.specimen.details ?? {};
  const input = normaliseBvScreenInput(details[BV_SCREEN_DETAIL_KEY]);
  const result = evaluateBacterialVaginosisScreen(input);
  const finding = findFinding(accession.microscopy, BV_SCREEN_MICROSCOPY_CODE);
  const completeNugent = result.nugentScore !== null;

  function saveScreen(nextInput: BacterialVaginosisScreenInput) {
    const nextDetails = {
      ...details,
      [BV_SCREEN_DETAIL_KEY]: nextInput,
    };
    meduguActions.upsertAccession({
      ...accession,
      specimen: { ...accession.specimen, details: nextDetails },
    });
  }

  function updateScore(
    field: "lactobacillusScore" | "gardnerellaBacteroidesScore" | "mobiluncusScore",
    value: string,
  ) {
    saveScreen({
      ...input,
      [field]: value === "" ? undefined : Number(value),
    });
  }

  function updateBoolean(
    field: "clueCells" | "whiffTestPositive" | "homogeneousDischarge",
    value: string,
  ) {
    saveScreen({
      ...input,
      [field]: selectBoolean(value),
    });
  }

  function updatePh(value: string) {
    const numeric = Number(value);
    saveScreen({
      ...input,
      vaginalPh: value === "" || !Number.isFinite(numeric) ? undefined : numeric,
    });
  }

  function commitMicroscopyFinding() {
    if (!completeNugent) return;
    const microscopyFinding: Microscopy = {
      id: finding?.id ?? `m_bv_${Date.now().toString(36)}`,
      stainCode: BV_SCREEN_MICROSCOPY_CODE,
      result: result.reportText,
      notes: `Nugent morphotypes: Lactobacillus ${input.lactobacillusScore}, Gardnerella/Bacteroides ${input.gardnerellaBacteroidesScore}, Mobiluncus ${input.mobiluncusScore}.`,
    };
    const microscopy = finding
      ? accession.microscopy.map((item) => (item.id === finding.id ? microscopyFinding : item))
      : [...accession.microscopy, microscopyFinding];

    meduguActions.upsertAccession({
      ...accession,
      specimen: {
        ...accession.specimen,
        details: {
          ...details,
          [BV_SCREEN_DETAIL_KEY]: input,
        },
      },
      microscopy,
    });
  }

  function clearScreen() {
    const nextDetails = { ...details };
    delete nextDetails[BV_SCREEN_DETAIL_KEY];
    meduguActions.upsertAccession({
      ...accession,
      specimen: { ...accession.specimen, details: nextDetails },
      microscopy: accession.microscopy.filter(
        (item) => item.stainCode !== BV_SCREEN_MICROSCOPY_CODE,
      ),
    });
  }

  const statusClass =
    result.nugentInterpretation === "positive"
      ? "border-rose-300 bg-rose-50 text-rose-900 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-100"
      : result.nugentInterpretation === "intermediate"
        ? "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100"
        : result.nugentInterpretation === "negative"
          ? "border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-100"
          : "border-border bg-card text-foreground";

  return (
    <section className={`rounded-lg border p-4 ${statusClass}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h4 className="text-sm font-semibold">Bacterial vaginosis screen</h4>
          <p className="mt-1 max-w-3xl text-xs opacity-80">
            Vaginal specimens use Gram-film Nugent scoring as the microscopy standard. Amsel
            findings are captured as supporting clinical/lab criteria when available.
          </p>
        </div>
        <span className="rounded bg-white/70 px-2 py-1 text-xs font-medium text-slate-900 dark:bg-slate-900/50 dark:text-white">
          {result.nugentScore === null ? "Nugent incomplete" : `Nugent ${result.nugentScore}/10`}
        </span>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-3">
        <BvScoreSelect
          label="Lactobacillus morphotypes"
          value={input.lactobacillusScore}
          max={4}
          help="0 = abundant; 4 = absent."
          onChange={(value) => updateScore("lactobacillusScore", value)}
        />
        <BvScoreSelect
          label="Gardnerella/Bacteroides morphotypes"
          value={input.gardnerellaBacteroidesScore}
          max={4}
          help="Small Gram-variable rods; 0 = absent, 4 = heavy."
          onChange={(value) => updateScore("gardnerellaBacteroidesScore", value)}
        />
        <BvScoreSelect
          label="Mobiluncus / curved rods"
          value={input.mobiluncusScore}
          max={2}
          help="0 = absent; 2 = moderate/heavy."
          onChange={(value) => updateScore("mobiluncusScore", value)}
        />
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-4">
        <BvBooleanSelect
          label="Clue cells"
          value={input.clueCells}
          onChange={(value) => updateBoolean("clueCells", value)}
        />
        <label className="space-y-1 text-xs">
          <span className="font-medium">Vaginal pH</span>
          <Input
            value={input.vaginalPh === undefined ? "" : String(input.vaginalPh)}
            inputMode="decimal"
            placeholder="e.g. 5.0"
            onChange={(event) => updatePh(event.target.value)}
            className="h-8 bg-white/70 dark:bg-slate-950/40"
          />
          <span className="block opacity-70">Amsel pH criterion is positive when pH &gt; 4.5.</span>
        </label>
        <BvBooleanSelect
          label="Whiff/amine test"
          value={input.whiffTestPositive}
          onChange={(value) => updateBoolean("whiffTestPositive", value)}
        />
        <BvBooleanSelect
          label="Thin homogeneous discharge"
          value={input.homogeneousDischarge}
          onChange={(value) => updateBoolean("homogeneousDischarge", value)}
        />
      </div>

      <div className="mt-4 rounded border border-current/20 bg-white/60 p-3 text-sm dark:bg-slate-950/30">
        <p className="font-medium">{result.summary}</p>
        <p className="mt-1 text-xs opacity-80">
          Nugent 0-3 = BV not supported; 4-6 = intermediate flora; 7-10 = BV pattern. Amsel is
          supportive when 3 of 4 criteria are positive.
        </p>
        {finding && (
          <p className="mt-1 text-xs opacity-80">Saved result: {String(finding.result)}</p>
        )}
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={commitMicroscopyFinding}
          disabled={!completeNugent}
          className="rounded bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50"
        >
          Save BV screen to microscopy
        </button>
        {(finding || completeNugent) && (
          <button
            type="button"
            onClick={clearScreen}
            className="rounded border border-current/30 bg-transparent px-3 py-1.5 text-xs"
          >
            Clear BV screen
          </button>
        )}
      </div>
    </section>
  );
}

function BvScoreSelect({
  label,
  value,
  max,
  help,
  onChange,
}: {
  label: string;
  value: number | undefined;
  max: 2 | 4;
  help: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="space-y-1 text-xs">
      <span className="font-medium">{label}</span>
      <select
        value={value === undefined ? "" : String(value)}
        onChange={(event) => onChange(event.target.value)}
        className="h-8 w-full rounded-md border border-input bg-white/70 px-2 text-xs text-foreground dark:bg-slate-950/40"
      >
        <option value="">Select score</option>
        {Array.from({ length: max + 1 }, (_, score) => (
          <option key={score} value={score}>
            {score}
          </option>
        ))}
      </select>
      <span className="block opacity-70">{help}</span>
    </label>
  );
}

function BvBooleanSelect({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean | undefined;
  onChange: (value: string) => void;
}) {
  return (
    <label className="space-y-1 text-xs">
      <span className="font-medium">{label}</span>
      <select
        value={booleanSelectValue(value)}
        onChange={(event) => onChange(event.target.value)}
        className="h-8 w-full rounded-md border border-input bg-white/70 px-2 text-xs text-foreground dark:bg-slate-950/40"
      >
        <option value="">Not recorded</option>
        <option value="true">Positive / present</option>
        <option value="false">Negative / absent</option>
      </select>
    </label>
  );
}
