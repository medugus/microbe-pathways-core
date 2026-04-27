# Accession store refactor acceptance

## Why the store was split

`src/medugu/store/accessionStore.ts` mixed state container plumbing, domain mutations, audit write behavior, tenant hydration, and cloud/local persistence side effects in one file. The refactor splits mutation domains into focused modules to reduce merge risk and improve reviewability while keeping the same outward API and runtime behavior.

## Files created

- `src/medugu/store/accessionMutations.ts`
- `src/medugu/store/isolateMutations.ts`
- `src/medugu/store/astMutations.ts`
- `src/medugu/store/amsMutations.ts`
- `src/medugu/store/releaseMutations.ts`
- `src/medugu/store/audit.ts`
- `docs/acceptance/accession-store-refactor.md`

## Public API preserved

`accessionStore` export remains in `src/medugu/store/accessionStore.ts` and preserves existing action names consumed by `meduguActions` in `useAccessionStore.ts`. No call sites required changes.

## Behaviour intentionally unchanged

This is a move-only/refactor-only split. No new clinical or product rules were introduced. Existing AST interpretation, breakpoint behavior, AMS workflow rules, IPC behavior, validation/release paths, and persistence/sync side effects remain functionally equivalent.

## Manual validation checklist

- [ ] Create new urine accession.
- [ ] Select cases from sidebar.
- [ ] Add isolate.
- [ ] Add AST row.
- [ ] Add AST panel and remove unresulted rows.
- [ ] Request and approve AMS item.
- [ ] Confirm IPC panel still renders.
- [ ] Run validation.
- [ ] Release accession.
- [ ] Confirm dashboard updates.
- [ ] Refresh app and confirm state persists.

## Known future work

- Add targeted unit tests per mutation module to lock behavior at finer granularity.
- Consider extracting cloud push debounce lifecycle into a dedicated side-effect coordinator once broader store ownership is clarified.
- If/when explicit IPC store actions are introduced, place them in `ipcMutations.ts` and compose from the existing store facade.
