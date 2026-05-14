# Zone Reader Integration — Contract v1

Skeleton-only contract for exchanging disk-diffusion zone measurements between
MEDUGU LIMS and an external zone-reader device or app. **No live API** in v1 —
the round-trip happens via JSON file export/import inside the AST section.

## Authority

**MEDUGU LIMS remains the authority** for:

- S/I/R interpretation
- Expert rules / phenotype detection
- Cascade / selective reporting
- AMS approval workflow
- IPC signals
- Validation governance
- Release seal

The Zone Reader contributes raw zone diameters only. Imported zones are
written through the existing `meduguActions.updateAST(...)` setter, so every
downstream engine (`astEngine`, `applyExpertRulesServer`, `cascadeEngine`,
`amsEngine`, `ipcEngine`, `validationEngine`, `releaseEngine`) runs unchanged.
The integration never sets `interpretedSIR`, governance fields, cascade flags,
AMS state, IPC state, validation state, or the release seal directly.

## Round-trip key

```
(accessionId, isolateId, astPanelId, antibioticCode)
```

`method` is fixed to `disk_diffusion`. The Zone Reader does not measure MICs.

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

  "patientDisplayId": "MRN-001",
  "patientName": "Ada Lovelace",
  "ward": "ICU",

  "specimenType": "Blood culture",
  "specimenCode": "BLOOD_CULTURE",

  "organismName": "Escherichia coli",
  "organismCode": "ECOLI",
  "organismGroup": null,

  "astPanelId": "enterobacterales",
  "astPanelLabel": "Enterobacterales panel",
  "astPanelName": "Enterobacterales panel",
  "standard": "EUCAST",

  "method": "disk_diffusion",
  "expectedDiscs": [
    {
      "antibioticCode": "AMP",
      "antibioticName": "Ampicillin",
      "discPotency": null,
      "antibioticClass": "penicillin",
      "awareCategory": null,
      "reportabilityDefault": null,
      "plateHint": "Ampicillin"
    },
    {
      "antibioticCode": "MEM",
      "antibioticName": "Meropenem",
      "discPotency": null,
      "antibioticClass": "carbapenem",
      "awareCategory": null,
      "reportabilityDefault": null,
      "plateHint": "Meropenem"
    }
  ]
}
```

Fields marked `null` are nullable when the LIMS does not yet hold the value
(AWaRe category, disc potency, reportability default, organism group).

## Sample imported result JSON

The Zone Reader app may emit either the canonical field names or the v1.0
aliases listed below — the schema accepts both and normalises on parse.

```json
{
  "contractVersion": "1.0.0",
  "sourceSystem": "ACME_ZR_1",
  "readerDeviceId": "ACME-ZR-SN-00871",
  "readerSoftwareVersion": "3.4.1",
  "operator": "tech-42",
  "readAt": "2026-05-12T10:42:13.000Z",

  "accessionId": "acc-1",
  "accessionNumber": "ACC-2026-0001",
  "isolateId": "iso-1",
  "astPanelId": "enterobacterales",
  "method": "disk_diffusion",

  "results": [
    {
      "antibioticCode": "AMP",
      "zoneDiameterMm": 8,
      "confidenceNumeric": 0.97,
      "readerConfidence": "high",
      "measurementSource": "auto_reader",
      "plateBarcode": "PLT-0091",
      "imageReference": "s3://reader/imgs/0091-AMP.png"
    },
    {
      "antibioticCode": "GEN",
      "zoneDiameterMm": 18,
      "confidenceNumeric": 0.62,
      "readerConfidence": "low",
      "measurementSource": "auto_reader",
      "notes": "edge of zone fuzzy",
      "imageReference": "s3://reader/imgs/0091-GEN.png"
    },
    {
      "antibioticCode": "CIP",
      "zoneDiameterMm": 22,
      "readerConfidence": "manual",
      "measurementSource": "reader_then_manual",
      "manualEdited": true,
      "originalValue": 19,
      "correctedValue": 22,
      "overrideReason": "double zone — measured outer ring",
      "reviewedBy": "tech-42",
      "reviewedAt": "2026-05-12T10:41:55.000Z",
      "imageReference": "s3://reader/imgs/0091-CIP.png"
    }
  ]
}
```

## Accepted alias fields (input → canonical)

| Reader sends | Normalised to |
|---|---|
| `zoneMm` | `zoneDiameterMm` |
| `confidence` (0–1 number) | `confidenceNumeric` (+ `readerConfidence` band derived: ≥0.85 → `high`, ≥0.6 → `medium`, else `low`; manual entries with no numeric → `manual`) |
| `readerConfidence` (`high`/`medium`/`low`/`manual`) | `readerConfidence` (no derivation) |
| `device` | `readerDeviceId` |
| `measuredAt` | `readAt` |
| `comment` | `notes` |
| `imageUrl` / `imageRef` | `imageReference` (mirrored back to `imageUrl`) |
| `measurementSource: "reader"` | `measurementSource: "auto_reader"` |
| `measurementSource: "manual"` | `measurementSource: "manual_entry"` |

## Normalised internal fields (per result row)

`zoneDiameterMm`, `readerConfidence` (`high` / `medium` / `low` / `manual`),
`confidenceNumeric`, `measurementSource` (canonical enum: `auto_reader` /
`manual_entry` / `reader_then_manual` / `imported`), `manualEdited`,
`originalValue`, `correctedValue`, `overrideReason`, `reviewStatus`,
`reviewedBy`, `reviewedAt`, `readerDeviceId`, `readerSoftwareVersion`,
`plateBarcode`, `imageReference`, `imageUrl`, `notes`, `readAt`.

## Validation rules

| Code | Severity | Meaning |
|------|----------|---------|
| `SCHEMA_PARSE_FAILED` | blocker | Payload failed zod parse / alias normalisation |
| `ACCESSION_MISMATCH` | blocker | Payload accessionId differs from active accession |
| `ISOLATE_NOT_FOUND` | blocker | Isolate not present on accession |
| `PANEL_NOT_FOUND` | blocker | astPanelId not in registry |
| `WORKLIST_ACCESSION_MISMATCH` | blocker | Round-trip key mismatch vs originating worklist |
| `WORKLIST_ISOLATE_MISMATCH` | blocker | Round-trip key mismatch vs originating worklist |
| `WORKLIST_PANEL_MISMATCH` | blocker | Round-trip key mismatch vs originating worklist |
| `UNSUPPORTED_METHOD` | blocker | Method not `disk_diffusion` |
| `MISSING_DEVICE_METADATA` | warning | No `readerDeviceId` and no `sourceSystem` declared |
| `DUPLICATE_ROW` | warning | Same antibiotic appears twice in payload |
| `ANTIBIOTIC_OFF_PANEL` | warning | Reader reported a drug not on the panel |
| `IMPLAUSIBLE_ZONE` | warning | Zone outside 6–50 mm |
| `LOW_CONFIDENCE` | warning | Numeric confidence below threshold or band = `low` |
| `MANUAL_EDIT_WITHOUT_REASON` | warning | `manualEdited=true` but no `overrideReason` |
| `MISSING_IMAGE_REFERENCE` | warning | Lab policy requires image reference but none supplied |
| `OVERWRITE_EXISTING_VALUE` | warning | Existing AST raw zone would be overwritten |
| `MISSING_EXPECTED_DISC` | warning | Worklist disc absent from result payload |
| `READER_NOTE` | info | Free-text reader note |

## Per-row review policy

A matched row carries `requiresReview = true` whenever any of these
`reviewReasons` are present: `low_confidence`, `implausible_zone`,
`overwrite_existing`, `reader_note`, `manual_edit`,
`manual_edit_without_reason`, `missing_image_reference`.

The review table will **not** auto-accept any row with `requiresReview = true`.
"Accept all safe rows" only writes rows whose `reviewReasons` array is empty;
risky rows must be explicitly accepted (or rejected) one by one.

## Audit events (placeholder)

Currently routed through `console.debug`; promote to `cloudAudit` once the
codes below are added to the audit-event registry:

- `ZONE_READER_WORKLIST_EXPORTED`
- `ZONE_READER_RESULT_IMPORT_PARSED`
- `ZONE_READER_RESULT_IMPORT_REJECTED`
- `ZONE_READER_ROW_ACCEPTED`
- `ZONE_READER_ROW_REJECTED`
- `ZONE_READER_ROW_OVERRIDDEN`

## Settings (placeholder)

See `src/medugu/integrations/zoneReader/settings.ts`. Defaults:

- `enabled: true`
- `lowConfidenceThreshold: 0.75`
- `enforceReaderWhitelist: false`
- `maxImportAgeMinutes: 0`
- `requireImageReference: false` (passed per call to `mapImport`)
