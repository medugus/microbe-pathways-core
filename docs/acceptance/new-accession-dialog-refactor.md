# New accession dialog refactor acceptance

## Purpose of refactor

Refactor `NewAccessionDialog` into focused UI components and a pure form-logic helper to reduce file size and lower change risk while preserving all existing intake behaviour.

## Files created

- `src/medugu/ui/accession/NewPatientFields.tsx`
- `src/medugu/ui/accession/ExistingPatientSelector.tsx`
- `src/medugu/ui/accession/AccessionMetadataFields.tsx`
- `src/medugu/ui/accession/NewAccessionSpecimenFields.tsx`
- `src/medugu/ui/accession/NewAccessionBloodSetup.tsx`
- `src/medugu/ui/accession/AccessionTimestamps.tsx`
- `src/medugu/ui/accession/SubmitBlockedReason.tsx`
- `src/medugu/ui/accession/newAccessionFormLogic.ts`
- `docs/acceptance/new-accession-dialog-refactor.md`

## Public behaviour preserved

- New patient and existing patient flows are unchanged.
- MRN/identifier required indicators and inline validation messages are unchanged.
- Accession number auto-generation and duplicate check behaviour are unchanged.
- Ward/location, priority, specimen family/subtype, blood quick setup, and timestamps behave as before.
- Blood-culture fields remain visible/required only for blood family.
- Accession aggregate construction, save/reset/close flow, and store actions remain unchanged.

## Submit gating preserved

Submit enablement and blocked-reason messaging were moved to pure helpers in `newAccessionFormLogic.ts` with the same precedence:

1. duplicate accession number
2. MRN/identifier missing
3. missing blood-culture source (for blood family)

## Manual validation checklist

- [ ] Create new patient urine MSU accession.
- [ ] Confirm MRN required behaviour.
- [ ] Confirm existing-patient accession creation.
- [ ] Confirm duplicate accession number warning.
- [ ] Confirm urine does not show blood-source fields.
- [ ] Confirm blood culture shows and requires blood-source fields.
- [ ] Confirm collection/received timestamps persist.
- [ ] Confirm reset works after closing/reopening dialog.
- [ ] Confirm created accession appears in sidebar/dashboard.

## Known future work

- Add focused unit tests for `newAccessionFormLogic.ts` helper functions.
- Consider extracting shared intake field primitives if additional dialogs adopt the same patterns.
