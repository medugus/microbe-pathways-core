# Benchmark Baseline Template — Beaker vs Medugu

Capture one row per named scenario in **both** systems. Time-on-task target:
≥30% reduction in Medugu vs the local Beaker baseline.

## How to use

1. Pick an observer (single observer per scenario for inter-rater consistency).
2. Run the scenario in **Beaker** first using its standard workflow. Record
   each metric without any tool assistance.
3. Reset, then run the **same** scenario in Medugu using the seeded accession.
4. Read live counters from the Benchmark section after completion.
5. Compute `% reduction = (beaker - medugu) / beaker * 100` for time-on-task
   and click count.
6. Mark `pass = true` when both clicks and time-on-task achieve ≥30% reduction
   AND rule explanation, blockers, and export readiness behave as specified
   in `scenario-matrix.md`.

## Template (copy per scenario)

```
Scenario:               <e.g. MRSA bloodstream infection>
Accession (Medugu):     <e.g. MB25-EF34GH>
Date / observer:        <YYYY-MM-DD / name>

                         | Beaker baseline | Medugu observed | Δ        | Target met?
-------------------------+-----------------+-----------------+----------+------------
Clicks                   |                 |                 |          |
Screen transitions       |                 |                 |          |
Time on task (mm:ss)     |                 |                 |          | ≥30% ↓
Rule explanation visible | n/a             | yes / no        |          | must be yes
Release blockers visible | n/a             | yes / no        |          | must be yes
Export ready             | n/a             | yes / no        |          | must be yes

Notes:
Pass / Fail:
```

## Aggregate summary table (fill after all six runs)

| Scenario | Beaker time | Medugu time | Δ time | Beaker clicks | Medugu clicks | Δ clicks | Pass |
|---|---|---|---|---|---|---|---|
| MRSA BSI |  |  |  |  |  |  | ☐ |
| ESBL UTI |  |  |  |  |  |  | ☐ |
| CRE sterile site |  |  |  |  |  |  | ☐ |
| Sputum Bartlett reject |  |  |  |  |  |  | ☐ |
| CSF consultant release |  |  |  |  |  |  | ☐ |
| Screen / clearance |  |  |  |  |  |  | ☐ |

## Source-of-truth notes

- Live Medugu metrics are read from `benchmark.get()` in
  `src/medugu/logic/benchmarkHarness.ts`. UI surfaces them in the Benchmark
  section.
- Time-on-task starts on `benchmark.bind(scenarioId, accessionId)` and is
  computed on demand by `benchmark.elapsedMs()` — no polling.
- Blockers and export availability reflect governed engine state, not UI
  state, so they are reproducible across observers.
