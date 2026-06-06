# Acceptance — Zone Reader Manual Round-Trip (current state)

Step scope: **Manual JSON workflow only.** No live API, no webhook, no
polling, no sockets, no background jobs.

## A. Workflow proved end to end

The following round-trip has been executed successfully for matched rows:

1. **Medugu exports** a LIMS Worklist JSON (`buildWorklistExport`).
2. **Zone Reader imports** the worklist and drives its measurement plan.
3. **Zone Reader exports** a ZoneResult JSON after reading.
4. **Medugu parses** the ZoneResult (`zoneReaderResultImportSchema`).
5. **Strict row matching** aligns incoming reader rows with existing AST rows.
6. **Accepted rows** are written via `meduguActions.updateAST` using ONLY raw
   measurement + method fields.
7. **Downstream engines** (interpretation, cascade, AMS, IPC, validation,
   release) recompute automatically because `updateAST` triggers the same
   cascade re-eval path used for manual benchtop entry.

## B. Exact row-matching rule

A reader row matches an AST row only when **all four** of the following
conditions hold:

```
(isolateId, antibioticCode, method = disk_diffusion, standard)
```

- `isolateId` — must match the payload's `isolateId`.
- `antibioticCode` — exact code match (no aliases).
- `method` — the existing AST row **must** already be `DiskDiffusion`.
  MIC / broth / automated rows are **never** auto-converted.
- `standard` — taken from the worklist envelope when present; otherwise from
  the isolate's existing disk-diffusion AST rows. A disk row under a
  different standard produces `STANDARD_MISMATCH`.

Unmatched results are classified in the `alignment[]` array:

| Reason | Meaning |
|--------|---------|
| `MISSING_AST_ROW` | No row at all for `(isolate, antibioticCode)` |
| `METHOD_MISMATCH` | A row exists but uses a non-disk method |
| `STANDARD_MISMATCH` | A disk row exists under a different breakpoint standard |

## C. Accepted matched rows in the current demonstration

In the demonstrated case the following antibiotics were **accepted** after
review because a disk-diffusion AST row already existed under the correct
standard:

- **AMP** — matched, accepted
- **PEN** — matched, accepted
- **TEC** — matched, accepted (overwrite warning surfaced because a prior
  `rawValue` existed)

For each accepted row the UI invoked:

```ts
meduguActions.updateAST(accessionId, astRowId, {
  rawValue: zoneDiameterMm,
  rawUnit: "mm",
  zoneMm: zoneDiameterMm,
  method: ASTMethod.DiskDiffusion,
})
```

No interpreted field (S/I/R, phenotype, cascade, stewardship, IPC, validation,
release) was written by the importer.

## D. Expected unmatched scenario — method mismatch

- **VAN** remained **unmatched** in the same demonstration.
- Cause: the existing AST row for VAN on this isolate uses `method: mic_broth`.
- The incoming reader row declares `method: disk_diffusion`.
- Because the matching rule requires `method = disk_diffusion` on the existing
  row, VAN was correctly classified as `METHOD_MISMATCH`.

### Note on the VAN case

This is **not a defect** — it is the intended behaviour. The Zone Reader
round-trip is designed to write raw measurements only into pre-existing
disk-diffusion rows. A MIC broth row and a disk-diffusion row represent
different methodological lanes and must not be conflated. If the laboratory
wants to accept a zone diameter for VAN, a disk-diffusion AST row must be
added to the isolate first (the UI exposes a **Create disk-diffusion rows**
action for this purpose). Until then, the `METHOD_MISMATCH` classification
protects the integrity of the existing MIC data.

## E. Confirmed ownership boundary

| Concern | Owner | Zone Reader may … | Medugu may … |
|---------|-------|-------------------|--------------|
| Raw zone measurement (mm) | Zone Reader | **Capture, export** | Import, display, audit |
| S/I/R interpretation | Medugu | — | Compute via breakpoint registry + local engines |
| Phenotype / resistance markers | Medugu | — | Compute via expert rules |
| Cascade / selective reporting | Medugu | — | Compute via cascade engine |
| Stewardship (AMS) | Medugu | — | Compute via stewardship engine |
| IPC episode evaluation | Medugu | — | Compute via IPC engine |
| Validation state | Medugu | — | Gate and record |
| Release / report state | Medugu | — | Gate and record |

The importer enforces this boundary at two levels:
1. The `MatchedRow` type carries **only** raw / provenance keys.
2. The UI calls the canonical `updateAST` setter, which never accepts
   direct writes to interpreted or governance fields.

## Out of scope for this step

- Server endpoints (`/api/public/zone-reader/*`)
- Webhook signature verification
- Live device sockets / polling
- Automatic creation of missing AST rows (UI button is manual)
- Converting MIC rows to disk-diffusion rows (deliberately unsupported)

## Status

**The manual round-trip is proven for the matched-row path.**

All regression tests in `roundTrip.test.ts` pass (scenarios 1–18 including
identity gating, schema enforcement, boundary protection, null-audit
acceptance, and row-alignment classification).
