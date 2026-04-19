// BenchmarkSection — non-intrusive instrumentation panel.
// Surfaces scenario acceptance: expected vs observed rules, phenotypes,
// blockers, warnings, visibility outcome, and export availability, plus
// live click / screen-transition / time-on-task metrics.

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { useActiveAccession } from "../../store/useAccessionStore";
import {
  benchmark,
  observeScenario,
  SCENARIO_ACCESSION_MAP,
  SCENARIO_CATALOGUE,
  type ScenarioId,
} from "../../logic/benchmarkHarness";

export function BenchmarkSection() {
  const accession = useActiveAccession();

  const snap = useSyncExternalStore(
    (l) => benchmark.subscribe(l),
    () => benchmark.get(),
    () => benchmark.get(),
  );

  // Derive scenarioId from the active accession.
  const scenarioId = useMemo<ScenarioId | null>(() => {
    if (!accession) return null;
    const entry = (Object.entries(SCENARIO_ACCESSION_MAP) as [ScenarioId, string][]).find(
      ([, id]) => id === accession.id,
    );
    return entry ? entry[0] : null;
  }, [accession]);

  // Bind harness to the active scenario.
  useEffect(() => {
    benchmark.bind(scenarioId, accession?.id ?? null);
  }, [scenarioId, accession?.id]);

  // Tick to refresh elapsed time.
  const [, setNow] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setNow((x) => x + 1), 1000);
    return () => clearInterval(t);
  }, []);

  if (!accession) {
    return (
      <div className="rounded-lg border border-border bg-card p-8 text-center text-sm text-muted-foreground">
        No active accession.
      </div>
    );
  }

  const expected = scenarioId
    ? SCENARIO_CATALOGUE.find((s) => s.id === scenarioId)
    : undefined;
  const observed = observeScenario(accession);

  const cmp = (e: string[], o: string[]) => {
    const has = (x: string) => o.includes(x);
    return e.map((x) => ({ code: x, ok: has(x) }));
  };

  return (
    <div className="space-y-4">
      <section className="rounded-md border border-border bg-background p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Active scenario</div>
            <div className="text-sm font-medium text-foreground">
              {expected?.title ?? "Unmapped accession"}
            </div>
            {scenarioId && (
              <div className="text-[10px] text-muted-foreground">
                <span className="font-mono">{scenarioId}</span> · accession{" "}
                <span className="font-mono">{accession.accessionNumber}</span>
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={() => benchmark.reset()}
            className="rounded border border-border px-2 py-1 text-xs hover:bg-muted"
          >
            Reset metrics
          </button>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Metric label="Clicks" value={snap.clicks} />
        <Metric label="Screen transitions" value={snap.screenTransitions} />
        <Metric label="Time on task" value={`${Math.round(benchmark.elapsedMs() / 1000)}s`} />
        <Metric
          label="Rule explanation visible"
          value={snap.ruleExplanationVisible ? "yes" : "no"}
        />
      </section>

      {expected ? (
        <section className="rounded-md border border-border bg-card p-3">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Acceptance check
          </h4>
          <div className="mt-2 grid gap-3 md:grid-cols-2">
            <Check title="Expected rules fired" items={cmp(expected.expected.rules, observed.rules)} />
            <Check title="Expected phenotypes" items={cmp(expected.expected.phenotypes, observed.phenotypes)} />
            <Check title="Expected blockers" items={cmp(expected.expected.blockers, observed.blockers)} />
            <Check title="Expected warnings" items={cmp(expected.expected.warnings, observed.warnings)} />
          </div>
          <div className="mt-3 grid gap-3 text-xs md:grid-cols-2">
            <div className="rounded border border-border bg-background p-2">
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Export availability</div>
              <div className={`mt-0.5 ${observed.exportAvailable ? "text-foreground" : "text-destructive"}`}>
                {observed.exportAvailable ? "available ✓" : `blocked — ${observed.exportReason ?? "see Release"}`}
              </div>
              <div className="mt-1 text-[10px] text-muted-foreground">
                expected after release: {expected.expected.export.availableAfterRelease ? "yes" : "no"}
              </div>
            </div>
            <div className="rounded border border-border bg-background p-2">
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Visibility expectations</div>
              <div className="mt-0.5 text-[11px]">
                must suppress:{" "}
                <span className="font-mono">
                  {expected.expected.visibility.mustSuppress.join(", ") || "—"}
                </span>
              </div>
              <div className="text-[11px]">
                must show:{" "}
                <span className="font-mono">
                  {expected.expected.visibility.mustShow.join(", ") || "—"}
                </span>
              </div>
            </div>
          </div>
        </section>
      ) : (
        <p className="rounded-md border border-dashed border-border bg-card p-3 text-xs text-muted-foreground">
          This accession is not part of the seeded benchmark catalogue.
        </p>
      )}

      <section className="rounded-md border border-border bg-card p-3">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          All seeded scenarios
        </h4>
        <ul className="mt-2 grid gap-1 text-xs md:grid-cols-2">
          {SCENARIO_CATALOGUE.map((s) => (
            <li key={s.id} className="flex items-center justify-between rounded border border-border bg-background px-2 py-1">
              <div>
                <div className="font-medium text-foreground">{s.title}</div>
                <div className="text-[10px] text-muted-foreground">
                  <span className="font-mono">{s.id}</span> · accession{" "}
                  <span className="font-mono">{SCENARIO_ACCESSION_MAP[s.id]}</span>
                </div>
              </div>
              {scenarioId === s.id && (
                <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] text-primary">active</span>
              )}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-md border border-border bg-card p-3">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-semibold text-foreground">{value}</div>
    </div>
  );
}

function Check({ title, items }: { title: string; items: { code: string; ok: boolean }[] }) {
  return (
    <div className="rounded border border-border bg-background p-2">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{title}</div>
      {items.length === 0 ? (
        <div className="mt-0.5 text-[11px] text-muted-foreground">—</div>
      ) : (
        <ul className="mt-0.5 space-y-0.5 text-[11px]">
          {items.map((i) => (
            <li key={i.code} className={i.ok ? "text-foreground" : "text-destructive"}>
              {i.ok ? "✓" : "✗"} <span className="font-mono">{i.code}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
