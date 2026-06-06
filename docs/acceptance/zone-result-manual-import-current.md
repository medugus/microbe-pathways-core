# Acceptance — Zone Result Manual Import (current state)

Step scope: **Manual JSON import only.** No live API, no webhook, no
polling, no sockets, no background jobs.

## Mode

- LIS-connected mode: `measurement_only` (Medugu remains the authority
  for S/I/R, expert rules, cascade, AMS, IPC, validation, release).
- Inbound channel: file upload OR paste in `ZoneReaderPanel`.

## Gating

1. **Strict schema parse** via `zoneReaderResultImportSchema`
   (zod, `contractVersion === "1.0.0"`, `method === "disk_diffusion"`).
   Failures → finding `SCHEMA_PARSE_FAILED`, **no AST writes**.
2. **Identity match** before any write:
   - `accessionId` → `accession.id`
   - `accessionNumber` (when present) → `accession.accessionNumber`
   - `isolateId` → existing isolate on accession
   - `astPanelId` → AST panel registry entry
3. **Worklist cross-check** when a source worklist envelope is supplied.
4. Any blocker → import rejected, readable findings shown, audit event
   `ZONE_READER_RESULT_IMPORT_REJECTED` emitted, no partial writes.

## Allowed direct writes (per accepted row)

`meduguActions.updateAST(accessionId, astRowId, { rawValue, rawUnit: "mm", zoneMm, method: DiskDiffusion })`

## Protected from direct import write

- interpreted S/I/R
- phenotype
- cascade / selective reporting
- stewardship (AMS)
- IPC
- validation state
- release state

Recomputed downstream by Medugu's local engines via the standard
`updateAST` path (cascade re-eval + render-time engines).

## Test coverage (`src/medugu/integrations/zoneReader/__tests__/roundTrip.test.ts`)

| # | Scenario                                              | Assertion                                                |
|---|-------------------------------------------------------|----------------------------------------------------------|
| 1 | Valid import + matched row                            | `ok = true`, matched row mapped to existing `astRowId`   |
| 2 | Low-confidence row                                    | `requiresReview = true`, finding `LOW_CONFIDENCE`        |
| 3 | Off-panel antibiotic                                  | finding `ANTIBIOTIC_OFF_PANEL`, lands in `unmatched`     |
| 4 | Duplicate antibiotic                                  | finding `DUPLICATE_ROW`                                  |
| 5 | Implausible zone (>50 mm)                             | finding `IMPLAUSIBLE_ZONE`                               |
| 6 | Alias normalisation (`zoneMm`, `measuredAt`)          | normalised to canonical fields                           |
| 7 | Confidence band derivation                            | numeric → band mapping                                   |
| 8 | Accession id mismatch                                 | blocker `ACCESSION_MISMATCH`, no matched rows            |
| 8b | Accession number mismatch                            | blocker `ACCESSION_NUMBER_MISMATCH`                      |
| 8c | Isolate mismatch                                     | blocker `ISOLATE_NOT_FOUND`                              |
| 8d | AST panel mismatch                                   | blocker `PANEL_NOT_FOUND`                                |
| 8e | Unsupported schema/contract version                  | blocker `SCHEMA_PARSE_FAILED`, no matched rows           |
| 8f | Worklist identity mismatch                           | blocker `WORKLIST_ISOLATE_MISMATCH`                      |
| 8g | Protected-fields boundary                            | `MatchedRow` exposes only raw / provenance keys; no SIR, phenotype, cascade, stewardship, IPC, validation, release |
| 11 | manualEdited=false + null override fields            | passes; `manualEdited=false` mapped                      |
| 12 | manualEdited=true + complete override quintet        | passes; `overrideReason` mapped                          |
| 13 | manualEdited=true + missing override fields          | blocker `MANUAL_EDIT_AUDIT_INCOMPLETE` + info `SCHEMA_RULE_HINT` |
| 14 | Boundary proof on null-audit accept                  | `MatchedRow` still carries no interpreted state          |

All tests currently pass (`bunx tsx` invocation of
`runZoneReaderRoundTripTests` + `runZoneReaderVreExportFixtureTest` → OK).

## Out of scope for this step

- Server endpoints (`/api/public/zone-reader/*`)
- Webhook signature verification
- Live device sockets / polling
- `zone_reader_inbound` persistence table
- `ZONE_READER_WEBHOOK_SECRET`

## Row alignment (added)

Matching rule: strict 4-tuple `(isolateId, antibioticCode, method=disk_diffusion, standard)`.

- `standard` is taken from `worklist.standard` when present; otherwise from the
  isolate's existing disk-diffusion AST rows.
- MIC rows are **never** auto-converted into disk-diffusion rows.
- Unmatched results are classified into `alignment[]` with one of:
  - `MISSING_AST_ROW` — no AST row at all for `(isolate, antibioticCode)`
  - `METHOD_MISMATCH` — a row exists but uses a non-disk method
  - `STANDARD_MISMATCH` — a disk row exists under a different standard

Pre-import messages surfaced in the ZoneReaderPanel:

- "Missing AST rows for AMP, PEN under disk_diffusion / CLSI"
- "VAN row exists but method mismatch: mic_broth vs disk_diffusion. MIC rows are not auto-converted."
- "VAN disk-diffusion row uses standard CLSI, expected EUCAST."

The panel exposes a **Create N disk-diffusion rows** button for the
`MISSING_AST_ROW` set; it uses `buildASTResult` + `meduguActions.addAST` with
`method=disk_diffusion` and the expected standard (falling back to the
project's `PRIMARY_STANDARD`). Method mismatches are advisory only — the
scientist must add a disk row deliberately.

New tests:

| # | Scenario | Expected |
|---|----------|----------|
| 15 | Antibiotic with no row at all | `MISSING_AST_ROW` finding + alignment entry |
| 16 | Only a MIC row exists for same antibiotic | `METHOD_MISMATCH`; MIC row left untouched |
| 17 | Matches cleanly after a disk row is added | `matched.length === 1`, alignment empty |
| 18 | Disk row exists under a different standard | `STANDARD_MISMATCH` with `existingStandard` + `expectedStandard` |
