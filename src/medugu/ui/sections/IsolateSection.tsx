// IsolateSection — working editor for isolates per accession.
// All business logic lives in logic/isolateHelpers.ts, logic/bloodIsolateRules.ts,
// and config/organisms.ts. Component stays thin.

import { useMemo, useState } from "react";
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
import {
    BC_MAX_ISOLATES,
    canAddBloodIsolate,
    countRealIsolates,
    isAtUnusualIsolateCount,
    isBloodCulture,
    listPositiveBottles,
    significanceTag,
    sourceLinkKey,
    toggleSourceLink,
} from "../../logic/bloodIsolateRules";
import { runValidation } from "../../logic/validationEngine";
import type { Isolate, IsolateSignificance } from "../../domain/types";
import { BottleResultsEditor } from "./BottleResultsEditor";

export function IsolateSection() {
    const accession = useActiveAccession();
    const [organismCode, setOrganismCode] = useState<string>(ORGANISMS[0].code);
    const [growthCode, setGrowthCode] = useState<string>("");
    const [colonyCount, setColonyCount] = useState<string>("");
    const [purity, setPurity] = useState(false);
    const [mixed, setMixed] = useState(false);

  const isoBlockers = useMemo(() => {
        if (!accession) return new Set<string>();
        const v = runValidation(accession);
        return new Set(v.blockers.filter((b) => b.section === "isolate").map((b) => b.code));
  }, [accession]);

  if (!accession) {
        return (
                <div className="rounded-lg border border-border bg-card p-8 text-center text-sm text-muted-foreground">
                        No active accession.
                </div>div>
              );
  }
  
    const isBlood = isBloodCulture(accession);
    const realCount = countRealIsolates(accession);
    const canAdd = canAddBloodIsolate(accession);
    const atUnusual = isAtUnusualIsolateCount(accession);
    const positiveBottles = isBlood ? listPositiveBottles(accession) : [];
    // Blood culture sets must be configured before isolates can be added
    const hasSets = !isBlood || ((accession.specimen.details as { sets?: unknown[] } | null)?.sets?.length ?? 0) > 0;
    const canAddIsolate = canAdd && hasSets;
  
    function onAdd() {
          if (!accession) return;
          if (!canAddIsolate) return;
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
            {isBlood && (
                    <div className="rounded-md border border-border bg-muted/30 p-3 text-xs">
                              <div className="flex items-center justify-between">
                                          <span className="font-medium text-foreground">
                                                        Blood culture isolates: {realCount} / {BC_MAX_ISOLATES}
                                          </span>span>
                                          <span className="text-muted-foreground">
                                                        Cap is {BC_MAX_ISOLATES}. 3 is unusual and contamination-prone.
                                          </span>span>
                              </div>div>
                      {atUnusual && (
                                  <p className="mt-2 rounded border border-amber-500/40 bg-amber-500/10 p-2 text-amber-700 dark:text-amber-300">
                                                Three blood-culture isolates are unusual and often represent contamination or mixed growth.
                                                Review clinical significance for each isolate before release.
                                  </p>p>
                              )}
                      {isoBlockers.has("BC_ISO_MISSING_FOR_POSITIVE") && (
                                  <p className="mt-2 rounded border border-destructive/40 bg-destructive/10 p-2 text-destructive">
                                                Positive bottles recorded but no isolate has been added. Add at least one isolate.
                                  </p>p>
                              )}
                    </div>div>
                )}
          
            {/* Blood culture sets required warning */}
            {isBlood && !hasSets && (
                    <div className="rounded-md border border-amber-500/60 bg-amber-500/10 p-3 text-xs text-amber-800 dark:text-amber-200">
                              <span className="font-semibold">Blood culture sets not configured.</span>span>{" "}
                              Go to the <strong>Specimen</strong>strong> section and add at least one blood culture set
                              (draw site + bottle type) before adding isolates.
                    </div>div>
                )}
          
            {/* Entry row */}
                <div className="grid grid-cols-1 gap-3 rounded-md border border-border bg-background p-3 md:grid-cols-6">
                        <label className="md:col-span-2 text-xs">
                                  <span className="block text-[10px] uppercase tracking-wide text-muted-foreground">Organism</span>span>
                                  <select
                                                value={organismCode}
                                                onChange={(e) => {
                                                                const code = e.target.value;
                                                                setOrganismCode(code);
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
                                                              </option>option>
                                                            ))}
                                  </select>select>
                        </label>label>
                        <label className="text-xs">
                                  <span className="block text-[10px] uppercase tracking-wide text-muted-foreground">Growth</span>span>
                                  <select
                                                value={growthCode}
                                                onChange={(e) => setGrowthCode(e.target.value)}
                                                className="mt-1 w-full rounded border border-border bg-card px-2 py-1.5 text-sm"
                                              >
                                              <option value="">—</option>option>
                                    {GROWTH_QUANTIFIERS
                                                    .filter((g) => {
                                                                      const nonGrowthOrganisms = ["NOGRO", "MIXED", "NORML"];
                                                                      if (g.code === "NO_GROWTH" && !nonGrowthOrganisms.includes(organismCode)) {
                                                                                          return false;
                                                                      }
                                                                      return true;
                                                    })
                                                    .map((g) => (
                                                                      <option key={g.code} value={g.code}>{g.display}</option>option>
                                                                    ))}
                                  </select>select>
                        </label>label>
                        <label className="text-xs">
                                  <span className="block text-[10px] uppercase tracking-wide text-muted-foreground">CFU/mL</span>span>
                                  <input
                                                value={colonyCount}
                                                onChange={(e) => setColonyCount(e.target.value)}
                                                inputMode="numeric"
                                                placeholder="e.g. 100000"
                                                className="mt-1 w-full rounded border border-border bg-card px-2 py-1.5 text-sm"
                                              />
                        </label>label>
                        <label className="flex items-end gap-2 text-xs">
                                  <input type="checkbox" checked={purity} onChange={(e) => setPurity(e.target.checked)} />
                                  <span>Pure</span>span>
                        </label>label>
                        <label className="flex items-end gap-2 text-xs">
                                  <input type="checkbox" checked={mixed} onChange={(e) => setMixed(e.target.checked)} />
                                  <span>Mixed</span>span>
                        </label>label>
                        <div className="md:col-span-6 flex items-center gap-3">
                                  <button
                                                type="button"
                                                onClick={onAdd}
                                                disabled={!canAddIsolate}
                                                className="rounded bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                                              >
                                              Add isolate
                                  </button>button>
                          {isBlood && !hasSets && (
                        <span className="text-[11px] text-amber-700 dark:text-amber-300">
                                      Configure blood culture sets in Specimen section first.
                        </span>span>
                                  )}
                          {isBlood && hasSets && !canAdd && (
                        <span className="text-[11px] text-muted-foreground">
                                      Maximum {BC_MAX_ISOLATES} blood-culture isolates reached.
                        </span>span>
                                  )}
                        </div>div>
                </div>div>
          
            {/* Existing isolates */}
            {accession.isolates.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No isolates yet. Add one above (use "No growth" organism for explicit no-growth rows).</p>p>
                  ) : (
                    <ul className="space-y-2">
                      {accession.isolates.map((i) => {
                                  const sigCode = `BC_ISO_${i.isolateNo}_SIGNIFICANCE_MISSING`;
                                  const srcCode = `BC_ISO_${i.isolateNo}_SOURCE_MISSING`;
                                  const sigMissing = isoBlockers.has(sigCode);
                                  const srcMissing = isoBlockers.has(srcCode);
                                  const showBcLinkage = isBlood && i.organismCode !== "NOGRO";
                                  return (
                                                  <li
                                                                    key={i.id}
                                                                    className={`rounded-md border bg-card p-3 text-sm ${
                                                                                        sigMissing || srcMissing ? "border-destructive" : "border-border"
                                                                    }`}
                                                                  >
                                                                  <div className="flex flex-wrap items-center justify-between gap-3">
                                                                                    <div className="min-w-0">
                                                                                                        <div className="flex items-center gap-2">
                                                                                                                              <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">#{i.isolateNo}</span>span>
                                                                                                                              <span className="font-medium text-foreground">{i.organismDisplay}</span>span>
                                                                                                          {i.purityFlag && <span className="rounded bg-secondary px-1.5 py-0.5 text-[10px] text-secondary-foreground">pure</span>span>}
                                                                                                          {i.mixedGrowth && <span className="rounded bg-secondary px-1.5 py-0.5 text-[10px] text-secondary-foreground">mixed</span>span>}
                                                                                                          {showBcLinkage && (
                                                                                            <SignificanceChip iso={i} />
                                                                                          )}
                                                                                                          </div>div>
                                                                                                        <div className="mt-0.5 text-xs text-muted-foreground">
                                                                                                                              growth: {describeGrowth(i)}
                                                                                                          </div>div>
                                                                                      </div>div>
                                                                                    <div className="flex items-center gap-2">
                                                                                                        <select
                                                                                                                                value={i.significance ?? "indeterminate"}
                                                                                                                                onChange={(e) =>
                                                                                                                                                          meduguActions.updateIsolate(accession.id, i.id, {
                                                                                                                                                                                      significance: e.target.value as IsolateSignificance,
                                                                                                                                                            })
                                                                                                                                  }
                                                                                                                                className={`rounded border bg-background px-2 py-1 text-xs ${
                                                                                                                                                          sigMissing ? "border-destructive" : "border-border"
                                                                                                                                  }`}
                                                                                                                              >
                                                                                                          {SIGNIFICANCE_OPTIONS.map((s) => (
                                                                                                                                                        <option key={s.code} value={s.code}>{s.display}</option>option>
                                                                                                                                                      ))}
                                                                                                          </select>select>
                                                                                                        <button
                                                                                                                                type="button"
                                                                                                                                onClick={() => meduguActions.removeIsolate(accession.id, i.id)}
                                                                                                                                className="rounded border border-border px-2 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
                                                                                                                              >
                                                                                                                              Remove
                                                                                                          </button>button>
                                                                                      </div>div>
                                                                  </div>div>
                                                  
                                                    {sigMissing && (
                                                                                      <p className="mt-2 text-[11px] text-destructive">
                                                                                                          Classify clinical significance (true pathogen / probable contaminant / mixed growth / uncertain)
                                                                                                          before release.
                                                                                        </p>p>
                                                                  )}
                                                  
                                                    {showBcLinkage && (
                                                                                      <div className={`mt-3 rounded border p-2 ${srcMissing ? "border-destructive bg-destructive/5" : "border-border bg-background/40"}`}>
                                                                                                          <div className="mb-1.5 flex items-center justify-between">
                                                                                                                                <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                                                                                                                                                        Source linkage (positive set / bottle)
                                                                                                                                  </span>span>
                                                                                                            {srcMissing && (
                                                                                                                <span className="text-[11px] text-destructive">link at least one positive bottle</span>span>
                                                                                                                                )}
                                                                                                            </div>div>
                                                                                        {positiveBottles.length === 0 ? (
                                                                                                              <p className="text-[11px] text-muted-foreground">
                                                                                                                                      No positive bottles recorded yet. Mark at least one bottle as "growth" in per-bottle tracking
                                                                                                                                      below to link this isolate to its source.
                                                                                                                </p>p>
                                                                                                            ) : (
                                                                                                              <SourceLinkPicker accession={accession.id} isolate={i} positives={positiveBottles} />
                                                                                                            )}
                                                                                        </div>div>
                                                                  )}
                                                  
                                                    {showBcLinkage && (
                                                                                      <details className="mt-3 rounded border border-border bg-background/50 p-2 text-xs" open>
                                                                                                          <summary className="cursor-pointer select-none text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                                                                                                                                Per-set / per-bottle growth
                                                                                                            </summary>summary>
                                                                                                          <div className="mt-2">
                                                                                                                                <BottleResultsEditor accession={accession} isolate={i} />
                                                                                                            </div>div>
                                                                                        </details>details>
                                                                  )}
                                                  </li>li>
                                                );
                    })}
                    </ul>ul>
                )}
          </div>div>
        );
}

function SignificanceChip({ iso }: { iso: Isolate }) {
    const t = significanceTag(iso);
    const tone =
          t.tone === "danger"
            ? "bg-destructive/15 text-destructive"
            : t.tone === "warn"
            ? "bg-amber-500/15 text-amber-700 dark:text-amber-300"
            : t.tone === "info"
            ? "bg-muted text-muted-foreground"
            : "bg-secondary text-secondary-foreground";
    return <span className={`rounded px-1.5 py-0.5 text-[10px] ${tone}`}>{t.label}</span>span>;
}

function SourceLinkPicker({
    accession,
    isolate,
    positives,
}: {
    accession: string;
    isolate: Isolate;
    positives: { setNo: number; bottleType: string }[];
}) {
    const links = isolate.bloodSourceLinks ?? [];
    const linkedSet = new Set(links.map((l) => sourceLinkKey(l.setNo, l.bottleType)));
    return (
          <div className="flex flex-wrap gap-1.5">
            {positives.map((p) => {
                    const key = sourceLinkKey(p.setNo, p.bottleType);
                    const active = linkedSet.has(key);
                    return (
                                <button
                                              key={key}
                                              type="button"
                                              onClick={() =>
                                                              meduguActions.updateIsolate(accession, isolate.id, {
                                                                                bloodSourceLinks: toggleSourceLink(isolate.bloodSourceLinks, p.setNo, p.bottleType),
                                                              })
                                              }
                                              className={`rounded border px-2 py-1 text-[11px] ${
                                                              active
                                                                ? "border-primary bg-primary/10 text-primary"
                                                                : "border-border bg-background text-muted-foreground hover:border-primary/40"
                                              }`}
                                            >
                                            Set {p.setNo} · {p.bottleType.toLowerCase()}
                                </button>button>
                              );
          })}
          </div>div>
        );
}</div>
