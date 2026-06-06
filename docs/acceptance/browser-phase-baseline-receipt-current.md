# Browser-Phase Baseline Receipt — Current

Inventory-only snapshot of the Medugu codebase as a freeze candidate. No
runtime behaviour was changed while producing this receipt.

## A. Current file/module map

```
src/medugu/
├── domain/           types.ts, enums.ts, ids.ts, versions.ts
├── config/           specimenFamilies, organisms, antibiotics, breakpoints,
│                     breakpointRegistry/eucast2026/{enterobacterales,
│                     pseudomonas, staphylococcus, streptococcus,
│                     enterococcus, acinetobacter, haemophilusMoraxella,
│                     notes}, cascadeRules, ipcRules, stewardshipRules,
│                     amsConfig, amsDenialReasons, bloodCulturePresets,
│                     paediatricBloodVolume
├── logic/            (see §C — 30 engines, framework-agnostic)
├── store/            accessionStore (core), useAccessionStore (React binding),
│                     persistence, configStore/configPersistence,
│                     cloudSync, cloudAMS, cloudAudit, CloudHydrationGate,
│                     analyticsSource, receiverPrefs, soundPrefs,
│                     useAMSActor, useAccessionRowId,
│                     useAuthoritativeValidation,
│                     dispatch.functions, engines.functions,
│                     export.functions, release.functions
├── integrations/
│   └── zoneReader/   types, schemas, settings, exportWorklist,
│                     importMapper, validateImport, auditEvents,
│                     __tests__/roundTrip.test.ts
├── ai/               aiAssist.functions, triageWorklist.functions
├── seed/             demoAccessions
├── fixtures/         ipcAcceptanceCases
├── utils/            canonicalJson, exportHelpers
└── ui/               AppShell, CaseManager, CommandPalette, ContextBar,
                      NewAccessionDialog, PolishButton, SectionPanel,
                      SectionRail, SoundAckChip, SoundTriggerGate,
                      sections/* (Patient, Specimen, Microscopy, Isolate,
                      AST, AMS, IPC, Validation, Release, Report,
                      Export, Benchmark, OperationalDashboard, …)
```

Layering boundary observed: `domain/`, `config/`, `logic/`, `utils/`,
core `store/` files contain zero React imports. `store/useAccessionStore.ts`
is the only React binding. `ui/` consumes store + logic.

## B. Current domain/state model summary

Single root aggregate `Accession` (see `src/medugu/domain/types.ts`)
holding: `patient`, `specimen`, `specimenAssessments[]`, `microscopy[]`,
`isolates[]`, `ast[]`, `interpretiveComments[]`, `phoneOuts[]`,
`stewardship[]`, `ipc[]`, `validation[]`, `release`, optional
`releasePackage`, `amsApprovals[]`, `audit[]`, plus version pins
(`ruleVersion`, `breakpointVersion`, `exportVersion`, `buildVersion`)
and `workflowStatus`.

Persisted store shape `MeduguState`: `schemaVersion`,
`accessions` (record), `accessionOrder`, `activeAccessionId`,
`ruleVersion`, `breakpointVersion`, `exportVersion`, `buildVersion`.
Persistence via `store/persistence.ts` (localStorage key
`medugu.v3.state`), swappable adapter. Optional cloud hydration via
`CloudHydrationGate` + `cloudSync` / `cloudAMS` / `cloudAudit`.

`ASTResult` carries `governance` (`draft | interpreted | approved |
released`) and `cascade` (`primary | cascade_pending | cascaded |
suppressed`) plus phenotype flags, expert-rule firings with override
audit, breakpoint key/source/flags, and consultant-override audit.

`ReleaseRecord` carries `state`, `reportVersion`, optional
`consultantApproval`, optional `sealHash`. `ReleasePackage` snapshots
the rendered body plus rule/breakpoint/export/build versions and is
intended to be immutable after release.

## C. Current engines and what each owns

- `specimenResolver` — coded specimen → workflow profile + captured fields
- `specimenCompatibility` — specimen/test compatibility checks
- `astEngine` — raw MIC/zone → S/I/R using breakpoint registry
- `astDrafting`, `astPanelSelection` — panel draft + selection logic
- `cascadeEngine` — selective reporting / cascade decisions
- `stewardshipEngine` — AMS hint generation against AST rows
- `amsEngine`, `amsRuleGovernance` — restricted-drug approval lifecycle + rule governance
- `ipcEngine`, `ipcColonisation`, `ipcEpisodeDetail`, `ipcLocalWatch`,
  `ipcQueue`, `ipcReportGovernance`, `ipcRuleGovernance` — IPC signals,
  episodes, watchlist, queue, governance
- `bloodBottles`, `bloodIsolateRules` — bottle lifecycle, BC linkage rules
- `isolateHelpers` — isolate utilities
- `workflowEngine` — stage gating + required fields
- `validationEngine` — pre-release validation rules
- `releaseEngine` — release state machine + frozen release package build
- `reportPreview`, `reportability` — structured report assembly + reportability
- `exportEngine` — JSON / HL7-ish / FHIR-ish export shapes
- `worklistEngine` — worklist projection
- `microHistoryEngine` — patient/organism history
- `analyticsEngine`, `operationalDashboard`, `benchmarkHarness` — read-models
- `configEngine` — coded dictionary access
- `soundEngine` — UI sound cues

All under `src/medugu/logic/` and free of React imports.

## D. Current export capability status

- `logic/exportEngine.ts` — shared shape builders
- `store/export.functions.ts` — server-fn export entry points
- `utils/canonicalJson.ts`, `utils/exportHelpers.ts` — canonicalisation + download
- `ui/sections/ExportSection.tsx` — operator-facing export panel
- Verification samples present under
  `docs/acceptance/export-verification/samples/` (HL7, FHIR JSON,
  normalised JSON)
- Release seal hash documented on `ReleaseRecord.sealHash`

Capabilities: structured normalised JSON, HL7-ish, FHIR-ish, plus
Zone Reader worklist export (see §E). Server export entry points
present but the browser-phase invariant (manual download) remains
intact.

## E. Current Zone Reader manual integration boundary

Files:

- `src/medugu/integrations/zoneReader/types.ts`
- `src/medugu/integrations/zoneReader/schemas.ts`
- `src/medugu/integrations/zoneReader/settings.ts`
- `src/medugu/integrations/zoneReader/exportWorklist.ts`
- `src/medugu/integrations/zoneReader/importMapper.ts`
- `src/medugu/integrations/zoneReader/validateImport.ts`
- `src/medugu/integrations/zoneReader/auditEvents.ts`
- `src/medugu/integrations/zoneReader/__tests__/roundTrip.test.ts`
- `src/medugu/ui/sections/ast/ZoneReaderPanel.tsx`
- `src/medugu/ui/sections/ast/ZoneReaderFindingsList.tsx`
- `src/medugu/ui/sections/ast/ZoneReaderImportReviewTable.tsx`
- Contract reference: `docs/integrations/zone-reader-contract-v1.md`

Boundary (verified in `ZoneReaderPanel.tsx`):

- Worklist export uses `buildWorklistExport` → JSON download.
- File import and the paste-textarea path both call the same internal
  `runMap(payload, source)` helper, which invokes `mapImport(...)` —
  single mapper for both sources.
- Row acceptance calls `meduguActions.updateAST(accession.id, astRowId,
  { rawValue, rawUnit: "mm", zoneMm, method: ASTMethod.DiskDiffusion })`
  only. No direct write to `interpretedSIR`, `finalInterpretation`,
  `governance`, `cascade*`, stewardship, IPC, validation, or release
  fields. Downstream interpretation, expert rules, cascade, AMS, IPC,
  validation, and release run through existing engines unchanged.
- No webhook route, no `/api/public/*` handler, no signature
  verification, no `zone_reader_inbound` table, no
  `ZONE_READER_WEBHOOK_SECRET` requirement.

## F. Typecheck/build status

`bunx tsc --noEmit` → exit 0, no diagnostics.

## G. Freeze recommendation

**Yes — recommend freeze.**

Reasons:

1. Browser-phase invariants hold:
   - Continuous case workspace: single `Accession` aggregate, tabbed
     section UI, no multi-page navigation handoff for case work.
   - Coded entities drive behaviour: `familyCode`, `subtypeCode`,
     `organismCode`, `antibioticCode`, `ruleCode`, `breakpointKey`
     are the keys consumed by engines; free-text labels are
     display-only.
   - Logic outside React: `domain/`, `config/`, `logic/`, `utils/`,
     core `store/` files contain no React imports.
   - Single source of truth: every section reads/writes through
     `accessionStore` via `meduguActions`.
   - Governed release: `ReleaseRecord` + `ReleasePackage` with
     version pins and optional `sealHash`; `releaseEngine` owns the
     state machine.
   - Zone Reader manual import touches raw measurement fields only;
     interpretation/cascade/AMS/IPC/validation/release flow through
     existing engines.
2. Typecheck passes clean.
3. No live device, webhook, or API integration code present.

Post-freeze changes already present (factual, not rolled back):

- Zone Reader manual integration UI surfaced as a top-of-AST Card with
  shared file + paste mapper and review table (recent enhancement).
- No other post-freeze functional changes detected in this pass.
