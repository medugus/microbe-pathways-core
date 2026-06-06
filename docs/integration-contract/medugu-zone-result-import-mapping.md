# Medugu Zone Result Manual Import — Contract Mapping

Scope: Manual (file or paste) import of Zone Reader `ZoneResult` JSON into
Medugu's AST workflow. **No live API, webhook, polling, or socket path.**

Authority boundary:
- The Zone Reader is the source of **raw zone measurements only**.
- Medugu remains the authority for S/I/R interpretation, expert rules,
  cascade / selective reporting, stewardship (AMS), IPC, validation and
  release.

## 1. Schema version

Imported JSON MUST declare:

```
contractVersion: "1.0.0"   // == ZONE_READER_CONTRACT_VERSION
method:          "disk_diffusion"
```

Any other `contractVersion` or `method` value is rejected at parse time
with finding code `SCHEMA_PARSE_FAILED`. **No AST rows are touched.**

## 2. Identity match (all required)

Before any AST write the following identity tuple MUST match the active
accession exactly:

| Field             | Source on payload          | Compared against                  | Blocker code              |
|-------------------|----------------------------|-----------------------------------|---------------------------|
| accessionId       | `payload.accessionId`      | `accession.id`                    | `ACCESSION_MISMATCH`      |
| accessionNumber   | `payload.accessionNumber`  | `accession.accessionNumber`*      | `ACCESSION_NUMBER_MISMATCH` |
| isolateId         | `payload.isolateId`        | `accession.isolates[].id`         | `ISOLATE_NOT_FOUND`       |
| astPanelId        | `payload.astPanelId`       | AST panel registry                | `PANEL_NOT_FOUND`         |

\* `accessionNumber` is checked only when present and non-empty on the
payload — preserves back-compat with readers that omit it.

If a source worklist envelope is also supplied, identity is additionally
cross-checked (`WORKLIST_ACCESSION_MISMATCH`, `WORKLIST_ISOLATE_MISMATCH`,
`WORKLIST_PANEL_MISMATCH`).

Any blocker finding aborts the import: no rows are mapped, no AST setter
is invoked, the UI surfaces the readable finding list, and an audit event
`ZONE_READER_RESULT_IMPORT_REJECTED` is emitted.

## 3. Per-row fields mapped INTO AST

When the user explicitly accepts a `MatchedRow`, the UI calls
`meduguActions.updateAST(accessionId, astRowId, patch)` with a patch that
contains ONLY raw measurement + method fields:

| Inbound (`ZoneResult`)            | AST patch field            | Notes                                  |
|-----------------------------------|----------------------------|----------------------------------------|
| `zoneDiameterMm` (or alias `zoneMm`) | `rawValue`               | zone diameter in millimetres           |
| (constant)                        | `rawUnit = "mm"`           | unit guard                             |
| `zoneDiameterMm`                  | `zoneMm`                   | denormalised mirror for legacy readers |
| (constant)                        | `method = DiskDiffusion`   | enforces disc-diffusion lane           |

Provenance / review hints (`readerConfidence`, `confidenceNumeric`,
`notes`, `imageReference`, `manualEdited`, `overrideReason`,
`reviewReasons`) are surfaced in the review table and the audit detail —
they do **not** flow into interpreted AST fields.

## 4. Fields the importer MUST NEVER write directly

The importer is forbidden from setting any of these on `ASTResult` or on
the accession:

- interpreted `sir` / categorical interpretation
- `phenotype` markers
- `cascade` decision / `cascadeOverride`
- stewardship recommendations / AMS approvals
- IPC episode state
- validation state
- release / report state

These are produced by Medugu's local engines downstream of the raw AST
write. A regression test asserts that the `MatchedRow` shape exposes only
the allowed raw / provenance keys.

## 5. Post-import engine re-run

`meduguActions.updateAST` is the canonical AST mutation entry point. On
every patch it:

1. merges the patch onto the AST row,
2. re-runs `evaluateCascadeForAccession(...)` for live cascade /
   selective-reporting recompute,
3. appends an `ast.updated` audit row.

Downstream engines (AST interpretation, expert rules, stewardship, IPC,
validation/release gating) read from accession state on render, so a raw
zone update automatically re-derives:

- interpretation (`astEngine` / breakpoint registry)
- expert rules
- cascade / selective reporting
- AMS recommendations
- IPC episode evaluation
- validation + release gating

No bespoke "post-import recompute" path exists, by design — the manual
import re-uses the same path that manual benchtop entry uses.

## 6. Audit trail

| Event code                              | Emitted when                                   |
|-----------------------------------------|------------------------------------------------|
| `ZONE_READER_WORKLIST_EXPORTED`         | Worklist JSON downloaded                       |
| `ZONE_READER_RESULT_IMPORT_PARSED`      | Result JSON parsed without blockers            |
| `ZONE_READER_RESULT_IMPORT_REJECTED`    | Result JSON parsed with blockers (no writes)   |
| `ZONE_READER_ROW_ACCEPTED`              | Scientist accepted a matched row               |
| `ZONE_READER_ROW_REJECTED`              | Scientist rejected a matched row               |
