# Full codebase readiness audit — Medugu Microbiology Platform

Date: 2026-04-27  
Branch: `audit/full-codebase-readiness-review`  
Scope: audit-only (no product code changes)

## 1) Executive summary

- The codebase shows a **strong domain-first structure** (`domain`, `logic`, `config`, `store`, `ui`) and many logic modules are intentionally framework-agnostic.
- However, readiness is currently blocked by **lint failure at very high volume** (1,776 issues), **no test script in `package.json`**, and several **large God-object-style files** in logic/store/UI that should be split before high-confidence release.
- Clinical engines are mostly separated from UI, but **UI components call engines directly** in many places, so policy/decision rendering is still tightly coupled at integration points.
- Validation/release/export coherence is conceptually present, but there are version/governance sharp edges (for example version pin metadata and scattered release/dispatch checks) that should be consolidated.

## 2) Architecture assessment

### Strengths

- Layering exists and is discoverable:
  - `src/medugu/domain` (types, enums, ids, versions)
  - `src/medugu/config` (organisms, breakpoints, stewardship, IPC rules)
  - `src/medugu/logic` (pure engines)
  - `src/medugu/store` (state, hydration, persistence, server functions)
  - `src/medugu/ui` + `src/routes` (React view layer)
- Domain file states framework-agnostic contract intent explicitly.
- Core engines (`astEngine`, `amsEngine`, `validationEngine`, `reportPreview`, `exportEngine`, `analyticsEngine`) are written as pure TS functions.

### Weaknesses

- The store layer is doing multiple responsibilities (state, persistence, cloud sync, audit writes, mutation orchestration, debounced push).
- Several very large files indicate low internal modularity and high change blast radius.
- No CI workflow was found in repo root (`.github` missing), so build/typecheck/lint/test gates are not visibly automated in-repo.

## 3) Modularity score

**Overall score: 6.5 / 10**

Breakdown:
- Layer separation design: **8/10**
- Clinical logic purity: **8/10**
- UI/engine decoupling at call sites: **6/10**
- File size / cohesion: **4/10**
- Testability wiring and automation: **5/10**

## 4) Largest files and refactor targets

Top high-priority split candidates (line counts):
1. `src/medugu/logic/exportEngine.ts` (~793)
2. `src/medugu/store/accessionStore.ts` (~614)
3. `src/medugu/ui/sections/SpecimenFieldsForm.tsx` (~612)
4. `src/routes/admin.config.tsx` (~579)
5. `src/medugu/logic/operationalDashboard.ts` (~574)
6. `src/medugu/ui/NewAccessionDialog.tsx` (~511)
7. `src/medugu/logic/specimenResolver.ts` (~483)
8. `src/medugu/config/breakpointRegistry/eucast2026/enterobacterales.ts` (~452)
9. `src/medugu/domain/types.ts` (~436)
10. `src/routes/analytics.tsx` (~394)

Refactor strategy:
- Split by **bounded responsibility**, not just size:
  - Export format builders (`fhir.ts`, `hl7.ts`, `json.ts`) + gate evaluator + filename helpers.
  - Accessions store commands by domain (AST, isolate, release, AMS, IPC) with shared mutation utilities.
  - `admin.config` route: extract tabs/panels and config-diff presenters.

## 5) Clinical logic boundary risks (logic vs React UI)

### What is good
- Store React-binding is explicitly isolated in `useAccessionStore.ts`.
- Many logic files declare no React/network assumptions.

### Boundary risks
- UI sections and routes directly import and execute engines (`runValidation`, `evaluateIPC`, `computeAnalytics`, `buildReportPreview`, `evaluateExportGate`, stewardship/AMS engines).
- This is acceptable for browser-phase, but increases risk of duplicated orchestration and inconsistent decision timing across screens.
- Recommendation: add an **application service layer** (`src/medugu/app/*`) to provide canonical view-models that UI consumes, keeping engine calls in one orchestration place.

## 6) Validation/release coherence risks

- Validation/release/export governance exists, but checks are spread across multiple modules (`validationEngine`, release server functions, export/dispatch functions, UI release panels), increasing drift risk.
- Version pin definitions include dated constants (`BREAKPOINT_VERSION = "EUCAST-2024"`) while breakpoint registry appears centered on EUCAST 2026 content; this can cause audit confusion if not intentional.
- Some comments indicate browser-phase placeholder governance and free-text actor identity; those are correctly disclosed but represent release-readiness risk for regulated/clinical production.

## 7) AST / AMS / IPC / report / export boundary risks

- Positive: dedicated modules exist for all requested boundaries:
  - AST: `astEngine.ts`, `astDrafting.ts`, `reportability.ts`
  - AMS: `amsEngine.ts`, `amsReleaseGovernance.ts`, AMS rule governance files
  - IPC: `ipcEngine.ts`, `ipcQueue.ts`, `ipcLocalWatch.ts`, `ipcColonisation.ts`, `ipcReportGovernance.ts`
  - Report: `reportPreview.ts`
  - Export: `exportEngine.ts` + dispatch/export server functions in store
- Risk: `reportPreview` composes AST + stewardship + IPC + breakpoint lookups in one build path; `exportEngine` then depends on report preview and validation gating. This chain is coherent but large and brittle without strong integration tests and snapshot fixtures.
- Risk: browser-local IPC/analytics limitations are visible in code comments and UI copy, but production transition will require explicit server-owned cohort and surveillance services.

## 8) Browser-local limitation wording check

- Wording exists and is explicit in both docs and engine/user-facing notes.
- `docs/acceptance/browser-phase-limitations.md` is strong and specific (single-user, local persistence, local IPC cohort, no enterprise governance).
- IPC queue/local watch/colonisation modules also include explicit limitation notes.
- Recommendation: enforce this wording through a central `LIMITATIONS.md` excerpt or shared constant to avoid drift across routes/components/docs.

## 9) Security/configuration issues

- `.env` file exists in repository working tree and currently contains Supabase URL and publishable keys.
  - These are typically non-secret (publishable/anon), but committing environment files is still a config hygiene risk and can normalize unsafe patterns.
- Auth middleware relies on bearer tokens and claims checks (good baseline), but this is only one control plane layer; ensure RLS policies remain canonical enforcement.
- No obvious committed private key material was observed in inspected files, but a full secrets scan (gitleaks/trufflehog) was not run in this audit.

## 10) Build/typecheck/lint and repo checks

Commands executed:

- `npm run build` ✅
  - Passed.
  - Warnings observed:
    - CSS import ordering warning.
    - Large chunk warnings (>500kB) in build artifacts.
- `npx tsc --noEmit` ✅
  - Passed.
- `npm run lint` ❌
  - Failed with **1,776 issues** (`1,747` errors, `29` warnings), mostly Prettier formatting plus some type/hook warnings.
- `git diff --check` ✅
  - Passed (no whitespace/conflict-marker issues in working diff).

## 11) Testing gaps

- `package.json` has no `test` script.
- `src/medugu/logic/__tests__` contains test-like files, but they are not wired to npm scripts or a single runner.
- At least one test (`def001.regression.ts`) is an executable TS script pattern (`bunx tsx ...`) rather than integrated test framework invocation.
- Risk: tests may exist but are non-runnable in standard CI unless bespoke commands are known/documented.

## 12) Top 10 recommended fixes (priority order)

1. **Fix lint baseline** and enforce formatting in CI (blocking quality gate).
2. Add standard `test` script and wire logic tests to a single runner/entrypoint.
3. Introduce CI workflows for build/typecheck/lint/test on PR.
4. Split `exportEngine.ts` into per-format builders + gate module.
5. Split `accessionStore.ts` into domain mutation modules + infra adapters.
6. Add app-service orchestration layer so UI components stop calling engines directly.
7. Align version pin metadata (`domain/versions.ts`) with active breakpoint/rule registries and release docs.
8. Consolidate release/export/dispatch gate checks into a single shared policy module used by UI and server functions.
9. Move environment handling to `.env.example` + docs; keep real env files untracked.
10. Add integration snapshot tests for AST→reportPreview→export chain and IPC/AMS governance edge cases.

## 13) Suggested branch plan for fixes

- `fix/ci-quality-gates`  
  Add test script, CI workflows, lint/typecheck/build gates.
- `refactor/export-engine-split`  
  Decompose `exportEngine` and add snapshot tests.
- `refactor/accession-store-modules`  
  Decompose store commands and isolate infra side-effects.
- `refactor/ui-app-services`  
  Add orchestration/view-model layer; reduce direct UI engine calls.
- `hardening/config-version-coherence`  
  Align version pins, release docs, and governance metadata.
- `hardening/env-and-secrets-hygiene`  
  Introduce `.env.example`, tighten ignore rules, add secrets scan in CI.

## 14) Confirmation of change scope

- This audit did not modify product/runtime code paths.
- Only this audit document was added.
