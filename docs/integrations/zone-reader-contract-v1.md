# Zone Reader Integration — Contract v1

Skeleton-only contract for exchanging disk-diffusion zone measurements between
MEDUGU LIMS and an external zone-reader device or app. **No live API** is
implemented in this version — the round-trip happens via JSON file
export/import inside the AST section.

## Round-trip key

Every row in both directions is keyed on:

```
(accessionId, isolateId, astPanelId, antibioticCode)
```

`method` is fixed to `disk_diffusion`. The Zone Reader does not measure MICs.

## Engines NOT bypassed

Imported zones are written to the existing `ASTResult` row via the standard
`meduguActions.updateAST(...)` setter. Every downstream engine still runs
unchanged on the resulting state:

- breakpoint interpretation (`astEngine.ts`)
- expert rules / phenotype (`applyExpertRulesServer`)
- cascade / selective reporting (`cascadeEngine.ts`)
- AMS approval workflow (`amsEngine.ts`)
- IPC signals (`ipcEngine.ts`)
- validation governance (`validationEngine.ts`)
- release seal (`releaseEngine.ts`)

The integration does not write `interpretedSIR`, governance, or cascade fields
directly — it only stages `rawValue`/`zoneMm` and lets the engines do their job.

## Settings (placeholder)

See `src/medugu/integrations/zoneReader/settings.ts`. Defaults:

- `enabled: true`
- `lowConfidenceThreshold: 0.75`
- `enforceReaderWhitelist: false`
- `maxImportAgeMinutes: 0`

## Audit events (placeholder)

Currently routed through `console.debug`. Promote to `cloudAudit` once the
codes below are added to the audit-event registry:

- `ZONE_READER_WORKLIST_EXPORTED`
- `ZONE_READER_RESULT_IMPORT_PARSED`
- `ZONE_READER_RESULT_IMPORT_REJECTED`
- `ZONE_READER_ROW_ACCEPTED`
- `ZONE_READER_ROW_REJECTED`
- `ZONE_READER_ROW_OVERRIDDEN`

## Sample exported worklist JSON

```json
{
  "contractVersion": "1.0.0",
  "sourceSystem": "MEDUGU_LIMS",
  "generatedAt": "2026-05-12T10:00:00.000Z",
  "accessionId": "acc-1",
  "accessionNumber": "ACC-2026-0001",
  "isolateId": "iso-1",
  "isolateNo": 1,
  "organismDisplay": "Escherichia coli",
  "astPanelId": "enterobacterales",
  "astPanelLabel": "Enterobacterales panel",
  "method": "disk_diffusion",
  "expectedDiscs": [
    { "antibioticCode": "AMP", "plateHint": "Ampicillin" },
    { "antibioticCode": "AMC", "plateHint": "Amoxicillin/clavulanate" },
    { "antibioticCode": "TZP", "plateHint": "Piperacillin/tazobactam" },
    { "antibioticCode": "CRO", "plateHint": "Ceftriaxone" },
    { "antibioticCode": "MEM", "plateHint": "Meropenem" },
    { "antibioticCode": "GEN", "plateHint": "Gentamicin" },
    { "antibioticCode": "CIP", "plateHint": "Ciprofloxacin" }
  ]
}
```

## Sample imported result JSON

```json
{
  "contractVersion": "1.0.0",
  "sourceSystem": "ACME_ZR_1",
  "measuredAt": "2026-05-12T10:42:13.000Z",
  "accessionId": "acc-1",
  "accessionNumber": "ACC-2026-0001",
  "isolateId": "iso-1",
  "astPanelId": "enterobacterales",
  "method": "disk_diffusion",
  "operator": "tech-42",
  "device": "ACME-ZR-SN-00871",
  "results": [
    { "antibioticCode": "AMP", "zoneMm": 8,  "confidence": 0.97 },
    { "antibioticCode": "AMC", "zoneMm": 19, "confidence": 0.94 },
    { "antibioticCode": "TZP", "zoneMm": 22, "confidence": 0.91 },
    { "antibioticCode": "CRO", "zoneMm": 24, "confidence": 0.88 },
    { "antibioticCode": "MEM", "zoneMm": 28, "confidence": 0.96 },
    { "antibioticCode": "GEN", "zoneMm": 18, "confidence": 0.62, "notes": "edge of zone fuzzy" },
    { "antibioticCode": "CIP", "zoneMm": 14, "confidence": 0.93 }
  ]
}
```

The `GEN` row above will be flagged `requiresReview` (`low_confidence` +
`reader_note`) and must be explicitly accepted by the user. All other rows
qualify as "accept all safe rows".

## Validation findings

| Code | Severity | Meaning |
|------|----------|---------|
| `SCHEMA_PARSE_FAILED` | blocker | Payload failed zod parse |
| `ACCESSION_MISMATCH` | blocker | Payload accessionId differs from active accession |
| `ISOLATE_NOT_FOUND` | blocker | Isolate not present on accession |
| `PANEL_NOT_FOUND` | blocker | astPanelId not in registry |
| `WORKLIST_ACCESSION_MISMATCH` | blocker | Round-trip key mismatch |
| `WORKLIST_ISOLATE_MISMATCH` | blocker | Round-trip key mismatch |
| `WORKLIST_PANEL_MISMATCH` | blocker | Round-trip key mismatch |
| `UNSUPPORTED_METHOD` | blocker | Method not `disk_diffusion` |
| `DUPLICATE_ROW` | warning | Same antibiotic appears twice in payload |
| `ANTIBIOTIC_OFF_PANEL` | warning | Reader reported a drug not on the panel |
| `IMPLAUSIBLE_ZONE` | warning | Zone outside 5–50 mm |
| `LOW_CONFIDENCE` | warning | Reader confidence < threshold |
| `OVERWRITE_EXISTING_VALUE` | warning | Existing AST raw value would be overwritten |
| `READER_NOTE` | info | Free-text reader note |
| `WORKLIST_ROW_MISSING_FROM_RESULT` | info | Worklist disc absent from result payload |
