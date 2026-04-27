# Report → Release → Export integration regression

## Purpose

These integration tests verify the end-to-end microbiology result chain remains stable across recent refactors:

1. AST state and governance interpretation can still produce a clinician report preview.
2. Released-state exports are still sourced from immutable frozen release-package content.
3. Export gating still enforces release-state constraints.
4. AMS/IPC internal governance signals remain non-clinician-facing by default.

The scope is regression safety for **AST → report preview → release package/frozen source → export**.

## Pre-implementation inspection summary

1. Existing logic tests under `src/medugu/logic/__tests__` already covered export, governance, and dashboard modules, but did not include one integrated AST→report→release-source→export regression file with all target scenarios together.
2. Existing demo/fixture accessions include released and unreleased candidates (`MB25-COL003P`, `MB25-AB12CD`) plus blood culture (`MB25-EF34GH`) in `src/medugu/seed/demoAccessions.ts`.
3. Release package creation is handled by `attemptRelease()` in `src/medugu/logic/releaseEngine.ts`, which builds report preview then deep-clones to immutable `releasePackage.body` and pins versions.
4. `reportPreview` is built by `buildReportPreview()` in `src/medugu/logic/reportPreview.ts` from specimen resolution, AST engine outputs, stewardship, IPC visibility rules, and accession state.
5. Post-refactor `buildExport()` in `src/medugu/logic/exportEngine.ts` routes to format-specific builders and resolves source through `sourceDoc()` so released exports use frozen package content.
6. Released demo accessions suitable for export tests already exist (`MB25-COL003P`, plus other released colonisation follow-ups).
7. Urine M/C/S and blood culture fixtures exist (urine `MB25-AB12CD`, blood `MB25-EF34GH`) and can be enriched in-test without changing clinical logic.

## Fixtures used

- Seeded demo accessions from `src/medugu/seed/demoAccessions.ts`:
  - `MB25-COL003P` (released colonisation case for export-chain assertions)
  - `MB25-AB12CD` (unreleased urine case for gate-block assertions)
  - `MB25-EF34GH` (blood culture case, enriched in-test with set/bottle details)
- AMS acceptance fixture from `src/medugu/fixtures/amsAcceptanceCases.ts`:
  - `restrictedMeropenemPendingApprovalCase` (`AMS-ACC-001`) for pending→approved restricted-drug regression
- In-test synthetic variants only (no persistent fixture changes):
  - Urine M/C/S regression shape (MSU, _E. coli_, AMP=R, CIP=S, microscopy present, blank placeholders)
  - Restricted-drug approved variant (same MEM row with documented AMS approval)

## Scenarios covered

### A) Released accession export chain

- Report preview builds.
- Frozen release-package source is present.
- FHIR/HL7/JSON exports are non-empty.
- Accession number and patient MRN appear in all export formats.
- Version metadata appears in expected format-specific locations.
- Export gate is available and marked as sourced from release package.

### B) Unreleased accession export gate

- Export gate is unavailable.
- Block reason is present.
- Export remains blocked before release according to current gate contract.

### C) Urine M/C/S regression

- Report preview builds for urine MSU with _E. coli_ isolate.
- Blank AST placeholders do not generate `AST_INCOMPLETE` blockers.
- Unentered restricted drugs do not generate AMS approval-required blockers.
- Clinician-facing report preview does not include internal notes by default.

### D) Restricted-drug approval regression

- MEM restricted case blocks release before approval.
- Blocker clears after approval.
- AMS release context clears after approval.
- Operational dashboard does not show approved item as pending AMS approval.

### E) Blood culture regression (fixture exists)

- Report preview includes blood set details when present.
- Export payload includes blood set/bottle linkage details.
- Released-state export remains tied to frozen release package source.

## What remains manual

- Visual UI checks for report, release, and export panels.
- End-to-end Supabase/server-side dispatch and external receiver integration.
- Clinical sign-off workflows in real operator sessions.

## Safety boundaries checked

The integration test intentionally does **not** modify or reimplement:

- AST interpretation logic
- Breakpoint lookup logic
- AMS rule logic
- IPC rule logic
- Validation/release rules
- Report/export builders
- Auth and server calls

It validates behavior only through existing public logic APIs.
