# Comparative Benchmark Pack — Medugu vs Beaker

**Artifact:** `Medugu_vs_Beaker_Benchmark_Pack.xlsx` (delivered alongside this
doc). Generated against the current acceptance docs on 2026-04-20.

## Sheets

- **README** — colour conventions, source of truth, what still needs real-world
  Beaker measurement.
- **Scoring Guide** — per-metric thresholds for pass / borderline / fail.
- **Interpretation Guide** — how to combine the per-metric verdicts into a
  single scenario verdict.
- **Worksheet Template** — copy this sheet for any new scenario.
- **S1 … S6** — one comparison worksheet per named benchmark scenario,
  pre-filled with Medugu observations from `scenario-matrix.json` and
  `final-receipt.md`. Beaker columns are blank inputs (blue text).
- **Aggregate** — formula-driven roll-up of all six scenarios.

## Worksheet template (also in `benchmark-baseline-template.md`)

Each scenario sheet captures:

| Block | Fields |
|---|---|
| Header | Scenario, accession, observer / date / site |
| Efficiency metrics | Clicks, screen transitions, time on task (sec) — Beaker input, Medugu input, Δ, % reduction, target, verdict |
| Clinical visibility | Rule explanation visible, release blockers visible, export readiness — expected (from acceptance docs), observed, verdict |
| Notes & combined verdict | Free-text notes + final pass/borderline/fail/engine-defect label |

## Scoring guide

| Metric | Pass | Borderline | Fail |
|---|---|---|---|
| Time-on-task reduction | ≥ 30% lower than Beaker | 10–29% lower | < 10% lower or worse |
| Click reduction | ≥ 30% lower | 10–29% lower | < 10% lower or worse |
| Screen-transition reduction | ≥ 30% lower | 10–29% lower | < 10% lower or worse |
| Rule explanation visible | Yes | Partial | No |
| Release blockers visible | Matches expected | Partial | Diverges |
| Export readiness | Matches expected gate | Matches with caveats | Diverges |

The 30% target is taken from the existing
`benchmark-baseline-template.md` and is unchanged.

## Interpretation guide

- **Pass** — all three efficiency metrics ≥ 30% reduction AND all clinical
  visibility / export items match expected behaviour.
- **Borderline** — at least one efficiency metric in 10–29%, OR one clinical
  item is Partial. No item is in Fail.
- **Fail** — any efficiency metric below 10% reduction (or worse than Beaker),
  OR any clinical visibility / export-gate item diverges from expectation.
- **Engine defect** — use this label when the failure is caused by a known
  engine defect (e.g. DEF-001 on `MB25-CRE001`) rather than a UX timing issue.

## What the user still needs to measure

The Medugu side of every worksheet is pre-filled from the acceptance docs.
The Beaker side requires real-world capture by the user:

1. Beaker **clicks** per scenario.
2. Beaker **screen transitions** per scenario.
3. Beaker **time on task** per scenario (record mm:ss, enter as seconds).
4. **Observer / date / site** for each run.

Until those Beaker columns are filled in, the % reduction and pass/fail
verdicts in the workbook show "Awaiting Beaker" rather than a numeric verdict.
This is by design — the pack must not produce a green pass when the baseline
side is empty.
