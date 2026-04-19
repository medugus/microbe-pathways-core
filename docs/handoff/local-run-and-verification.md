# Local Run & Export Verification — Handoff

This document describes how to take the current Lovable build and run it as
a normal React/Vite project, plus how to verify the four behaviours that
matter for acceptance: **persistence**, **client-side-only export**, the
**six benchmark scenarios**, and **export reproducibility**.

## 1. Export the code from Lovable

You have two options, both produce the same plain React/Vite codebase:

- **GitHub sync** — connect a GitHub account in the Lovable project settings
  and use *Push to GitHub*. Clone the resulting repository.
- **Direct download** — use *Download project as ZIP* and unpack it.

There is no Lovable-only runtime dependency. Everything under
`src/medugu/` is plain TypeScript; the UI is standard React; routing uses
TanStack Router via Vite.

## 2. Run as a normal React/Vite project

```bash
# any of bun / pnpm / npm works
bun install         # or: npm install
bun run dev         # or: npm run dev
```

Open the printed URL (typically http://localhost:5173). The seeded demo
accessions appear immediately under the Case Manager.

Production build:

```bash
bun run build
bun run preview
```

## 3. Verify browser persistence

1. Load the app, open any seeded accession (e.g. `MB25-EF34GH`).
2. Make a visible change — for example, record a phone-out in the
   Validation/Release section.
3. **Hard reload** the page (Cmd-Shift-R / Ctrl-Shift-R).
4. Re-open the same accession. The phone-out you recorded is still present.

Implementation notes:

- Persistence layer: `src/medugu/store/persistence.ts`.
- Storage key: `medugu.v3.state` (the v3 in the key is historic; the live
  schema version is **5**).
- On a schema mismatch the store discards localStorage and falls back to
  seed; this is intentional for the browser phase.

## 4. Verify exports are client-side only

1. Open browser DevTools → **Network** tab. Filter by `Fetch/XHR` and clear.
2. Open `MB25-AB12CD` (ESBL UTI), release the report.
3. Go to the **Export** section, pick *HL7 v2.5 ORU^R01*, click **Download**.
4. Confirm **zero** new network requests appear. The file should download
   immediately.
5. Repeat with *FHIR R4 Bundle* and *Normalised JSON*.

Implementation notes:

- Export engine: `src/medugu/logic/exportEngine.ts` (no `fetch`).
- Helpers: `src/medugu/utils/exportHelpers.ts` — `downloadText` uses
  `Blob` + `URL.createObjectURL`; `copyText` uses `navigator.clipboard`.

## 5. Verify the six scenarios manually

Use `docs/acceptance/scenario-matrix.md` as the checklist. For each
scenario:

1. Reset to seed (Case Manager → *Reset to demo seed*).
2. Open the listed accession.
3. Read the **Benchmark** section: confirm acceptance ticks for rules,
   phenotypes, blockers, and visibility.
4. Complete the required actions (phone-out / consultant approval) where
   the scenario expects a blocker.
5. Release the report.
6. Open the **Export** section: confirm export is available and that
   suppressed/restricted rows render as `WITHHELD` with a reason.
7. Mark the scenario row pass/fail in `scenario-matrix.md`.

## 6. Verify export reproducibility

1. Release a scenario.
2. Download the FHIR bundle. Save as `run1.fhir.json`.
3. Hard-reload the page.
4. Open the same accession, download the FHIR bundle again as
   `run2.fhir.json`.
5. `diff run1.fhir.json run2.fhir.json` — output must be empty (the
   `ReleasePackage` is frozen and version-pinned).

The only fields permitted to differ are export-time timestamps if your
local config emits them; the current engine reads `release.signedAt` and
`release.versions.*` from the frozen package, so payloads are
byte-identical across re-exports of the same released accession.

## 7. Where to look in the code

| Concern | File |
|---|---|
| Domain types | `src/medugu/domain/types.ts` |
| Schema/version pins | `src/medugu/domain/versions.ts`, `src/medugu/store/persistence.ts` |
| Specimen resolver | `src/medugu/logic/specimenResolver.ts` |
| AST engine | `src/medugu/logic/astEngine.ts` |
| Stewardship engine | `src/medugu/logic/stewardshipEngine.ts` |
| IPC engine | `src/medugu/logic/ipcEngine.ts` |
| Validation | `src/medugu/logic/validationEngine.ts` |
| Workflow | `src/medugu/logic/workflowEngine.ts` |
| Release | `src/medugu/logic/releaseEngine.ts` |
| Report preview | `src/medugu/logic/reportPreview.ts` |
| Export | `src/medugu/logic/exportEngine.ts`, `src/medugu/utils/exportHelpers.ts` |
| Benchmark | `src/medugu/logic/benchmarkHarness.ts` |
| Seeded scenarios | `src/medugu/seed/demoAccessions.ts` |
| Store | `src/medugu/store/accessionStore.ts`, `src/medugu/store/useAccessionStore.ts` |
