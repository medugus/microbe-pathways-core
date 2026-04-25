# Modularity and Boundary Audit — 2026-04-25

Repository: `medugus/microbe-pathways-core`  
Branch: `audit/modularity-boundary-check`

## Overall status

**Green** — architecture remains layered, with core clinical logic in `logic/` and coded dictionaries in `config/`. The main modularity risk is file-size growth in a small number of UI sections.

## A) UI-section modularity

### Section files scanned

- `src/medugu/ui/sections/PatientSection.tsx`
- `src/medugu/ui/sections/SpecimenSection.tsx`
- `src/medugu/ui/sections/MicroscopySection.tsx`
- `src/medugu/ui/sections/IsolateSection.tsx`
- `src/medugu/ui/sections/ASTSection.tsx`
- `src/medugu/ui/sections/StewardshipSection.tsx`
- `src/medugu/ui/sections/AMSSection.tsx`
- `src/medugu/ui/sections/IPCSection.tsx`
- `src/medugu/ui/sections/ValidationSection.tsx`
- `src/medugu/ui/sections/ReleaseSection.tsx`
- `src/medugu/ui/sections/ReportSection.tsx`
- `src/medugu/ui/sections/ExportSection.tsx`
- plus helper subcomponents under the same folder.

### Large files

- **Over 400 lines:**
  - `ASTSection.tsx` (606)
  - `ReleaseSection.tsx` (532)
  - `SpecimenFieldsForm.tsx` (535)
- **Over 600 lines:**
  - `ASTSection.tsx` (606)

### Complex logic inside UI to watch

- `ASTReportabilityBoard.tsx` contains `evaluateVisibility(...)` with governance/cascade interpretation logic that overlaps domain semantics and should be centralized in `logic/` (or a shared selector).
- `IPCSection.tsx` builds a local `windowDaysByRule` map by invoking `rulesFor(...)` with empty phenotype context. It is small and acceptable now, but this projection logic could move into `logic/ipcEpisodeDetail.ts` to avoid drift.

### Major section separation

Confirmed present and separately exported:
- PatientSection
- SpecimenSection
- MicroscopySection
- IsolateSection
- ASTSection
- StewardshipSection
- AMSSection
- IPCSection
- ValidationSection
- ReleaseSection
- ReportSection
- ExportSection

## B) Logic-layer boundaries

- AST interpretation and expert rule patching are in `logic/astDrafting.ts` and `logic/astEngine.ts` (UI consumes results).
- AMS approval state logic is in `logic/amsEngine.ts` (UI calls helper functions/actions).
- IPC signal derivation is in `logic/ipcEngine.ts`.
- Validation logic is in `logic/validationEngine.ts`.
- Report/export generation is in `logic/reportPreview.ts` and `logic/exportEngine.ts`.

### Duplicated business logic found

- **Candidate duplication:** AST visibility/governance interpretation appears in UI (`ASTReportabilityBoard.tsx`) and also effectively in report/stewardship pipelines. Recommend extracting a shared `logic/reportability.ts` helper.

## C) Config/dictionary boundaries

- Antibiotics + AST panels are in `config/antibiotics.ts`.
- Breakpoint tables are in `config/breakpoints.ts`.
- Organisms are in `config/organisms.ts`.
- Stewardship rules are in `config/stewardshipRules.ts`.
- IPC rules are in `config/ipcRules.ts`.
- Specimen behavior dictionaries are in `config/specimenFamilies.ts`.

### Hard-coded clinical rules in UI

- No hard-coded breakpoint threshold values found in UI sections.
- No hard-coded IPC advice strings overriding rule engine outputs; UI displays engine/config messages.
- UI includes presentation mappings (chip colors, labels), which is acceptable.

## D) Store/domain boundaries

- Domain model (`domain/types.ts`) remains clinical/data-centric and not React/UI-coupled.
- Store (`store/accessionStore.ts`) remains the mutation and audit layer; rule engines are invoked from logic/server functions rather than duplicated inside reducers.
- Accession remains the central state aggregate (patient, specimen, isolates, AST, AMS, IPC, release/report/export metadata).

## E) Cross-feature contamination check

- AST panel entry appears scoped to AST/config/logic + required blood-link guard behavior.
- AMS scaffold is isolated to AMS config/engine/UI/store actions.
- IPC signal generation remains in IPC engine/config and server-authoritative engine wrappers.
- Blood culture source linkage intentionally appears in report/export projections (expected by requirement).
- Staphylococcus breakpoint scaffold is contained to breakpoint config and AST interpretation paths.

No unrelated cross-feature contamination was identified in this audit.

## F) Build/static checks

- `npm run build` ✅ passed (with existing chunk-size warning from Vite output).
- `npx tsc --noEmit` ✅ passed.
- `git diff --check` ✅ passed.

## Recommended follow-up refactor PRs

1. Extract AST reportability evaluation from `ASTReportabilityBoard.tsx` into a pure helper module under `logic/` and reuse in report/export surfaces.
2. Split `ASTSection.tsx` into smaller child components (`AstEntryForm`, `AstMatrixTable`, `AstServerActions`) to bring file below ~400 lines.
3. Split `ReleaseSection.tsx` into panels (`ReleaseGate`, `ReleaseSealPanel`, `AmendmentPanel`, `ReleaseHistoryEmbed`) for maintainability.
4. Consider centralizing UI-only tone/status constants shared across AST/AMS widgets.
