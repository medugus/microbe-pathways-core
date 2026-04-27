# Export engine refactor acceptance note

## Purpose of refactor

Reduce change risk in `src/medugu/logic/exportEngine.ts` by splitting format builders and gate logic into focused modules while preserving current export behaviour.

## Files split

- `src/medugu/logic/exportEngine.ts` (public façade preserved)
- `src/medugu/logic/export/exportGate.ts`
- `src/medugu/logic/export/fhirExport.ts`
- `src/medugu/logic/export/hl7Export.ts`
- `src/medugu/logic/export/jsonExport.ts`
- `src/medugu/logic/export/exportUtils.ts`
- `src/medugu/logic/export/exportTypes.ts`
- `src/medugu/logic/__tests__/exportEngine.test.ts`

## Public API preserved

`src/medugu/logic/exportEngine.ts` remains the single public entry point and continues to export:

- `buildExport`
- `evaluateExportGate`
- `ExportFormat`
- Existing export-related types and format builder functions

## Behaviour intentionally unchanged

This is a refactor-only split. No intentional changes were made to:

1. FHIR output shape/content
2. HL7 segment/message shape/content
3. Normalised JSON shape/content
4. Release-gated export behaviour
5. Frozen release-package behaviour
6. Report-preview dependency used for exports
7. Suppressed/restricted/lab-only AST visibility
8. Internal AMS/IPC note handling and visibility
9. Export filenames or export metadata

## Manual validation checklist

1. Open released accession.
2. Confirm FHIR export still works.
3. Confirm HL7 export still works.
4. Confirm normalised JSON export still works.
5. Confirm unreleased accession export is blocked or handled according to current app rule.
6. Confirm internal AMS/IPC notes do not leak into clinician-facing export fields.
7. Confirm suppressed/restricted AST rows obey current reportability rules.

## Risk areas for future export hardening

- Add canonical fixture-based integration tests for AST/preview/export end-to-end parity.
- Expand explicit contract tests for release-package fallback and amendment payload variants.
- Consider deterministic timestamp injection in tests to support stable snapshot comparisons.
