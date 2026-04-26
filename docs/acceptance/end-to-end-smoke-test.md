# End-to-End Smoke Test — Medugu Platform v3

## 1) Purpose

This checklist defines a safe, browser-phase end-to-end smoke workflow for a urine M/C/S case and related AMS/IPC/validation/release/report/export navigation. It is designed for QA verification only and must not change production clinical logic.

## 2) Browser-local limitation

- Medugu v3 in this repository is browser-phase and persists to local storage (`medugu.v3.state`, schema version 5).
- Operational queue/outbreak/approval dashboards are derived from currently loaded cases and are not hospital-wide surveillance.
- Use only demo/test entries in local/dev environments.

## 3) Urine M/C/S full workflow checklist

> Run in a fresh browser context (new incognito/private session, or clear storage before starting).

### Setup

- [ ] Start local app (`npm run dev`) and open local URL.
- [ ] Confirm dashboard/case workspace renders.
- [ ] Optionally click **Reset** in Case Manager and confirm reset to demo seed.

### New demo accession and specimen

- [ ] Create new accession with demo patient only:
  - Name: `QA Urine Test`
  - MRN: `QA-MRN-URINE-001`
  - Sex: any demo value
  - Ward: demo medical ward value
- [ ] Set specimen family to **URINE**.
- [ ] Set subtype to **midstream urine / MSU** (or closest available equivalent).
- [ ] Ensure collection method is compatible with selected specimen options.

### Organism + AST entry

- [ ] Add isolate: **Escherichia coli**.
- [ ] Mark clinically significant if the UI requires explicit significance.
- [ ] Add AST results:
  - [ ] `AMP` = `R`
  - [ ] `CIP` = `S`
- [ ] Do not enter restricted agents (`CRO/CAZ/FEP/TZP/ETP/MEM/AMK`) in this baseline workflow.
- [ ] Confirm blank AST panel rows do **not** produce false `AST_INCOMPLETE` blockers.
- [ ] Confirm unentered restricted agents do **not** produce false AMS approval blockers.

### Microscopy + AMS + IPC + Validation + Release

- [ ] Enter required urine microscopy values:
  - [ ] leukocytes
  - [ ] squamous epithelial cells
- [ ] Open AMS section:
  - [ ] confirm no automatic prescribing/dosing statements
  - [ ] confirm no false restricted approval blocker
- [ ] Open IPC section:
  - [ ] confirm no inappropriate high-priority IPC signal for uncomplicated E. coli urine unless explicitly configured
- [ ] Open Validation section:
  - [ ] list blockers/warnings
  - [ ] verify no false AMS blocker from unentered drugs
  - [ ] verify no false `AST_INCOMPLETE` blocker from blank rows
- [ ] Open Release section and release when blockers are resolved.
- [ ] Confirm post-release state:
  - [ ] released v1 (or equivalent)
  - [ ] frozen release package shown
  - [ ] release history shown

### Report + Export + Dashboard

- [ ] Open Report Preview:
  - [ ] clinician-facing report remains concise
  - [ ] internal AMS/IPC notes do not leak by default
- [ ] Open Export:
  - [ ] FHIR/HL7/JSON controls visible when export is available per app rules
- [ ] Return to dashboard/worklist and confirm no false urgent queue item remains for the released case.

## 4) Restricted-drug approval checklist

> Use a separate fresh demo accession (or fully reset and repeat in fresh context).

- [ ] Create equivalent urine accession and organism context.
- [ ] Enter restricted AST result with actual value:
  - [ ] `MEM` = (`S`/`I`/`R` as required by your scenario)
- [ ] Confirm AMS restricted approval blocker appears.
- [ ] Approve MEM in AMS UI if supported.
- [ ] Confirm `AMS_RESTRICTED_APPROVAL_REQUIRED` clears from Validation/Release.
- [ ] Confirm dashboard AMS pending item clears.

## 5) Navigation smoke checklist

Validate sections load without blank pages and with persistent shell navigation:

- [ ] Dashboard
- [ ] AST
- [ ] AMS
- [ ] IPC
- [ ] Validation
- [ ] Release
- [ ] Report
- [ ] Export

Expected each step:

- [ ] No blank/white page
- [ ] Header/sidebar remains visible
- [ ] Target section content renders

## 6) Report/export checklist

- [ ] Report has no internal-only wording by default.
- [ ] Export controls available only when release/validation state allows.
- [ ] Client-side copy/download works without requiring real patient identifiers.
- [ ] If dispatch-to-receiver is tested, use non-production/local receiver settings only.

## 7) Pass/fail evidence table

Use this table for each run:

| Date (UTC) | Tester | Build/Commit | Scenario | Result | Evidence | Defect Ref |
|---|---|---|---|---|---|---|
| YYYY-MM-DD | name | hash | Urine M/C/S baseline | PASS/FAIL | short note/screenshot ref | DEF-### |
| YYYY-MM-DD | name | hash | Restricted MEM approval | PASS/FAIL | short note/screenshot ref | DEF-### |
| YYYY-MM-DD | name | hash | Navigation smoke | PASS/FAIL | short note/screenshot ref | DEF-### |

## 8) Defect template

```text
Defect ID:
Title:
Environment:
Build/Commit:
Preconditions:
Steps to reproduce:
Expected:
Actual:
Severity:
Clinical safety impact:
Artifacts (screenshots/log snippets):
Status/Owner:
```

## 9) Reset/revert instructions for browser-local test data

- Clear local/session storage for the app origin before each run (or use fresh private context).
- In-app reset path: Case Manager → **Reset** (reset to demo seed).
- After test completion, clear local/session storage again to remove QA entries.
- Do not commit generated screenshots/videos/traces unless lightweight and directly useful.

## 10) Safety wording checks

During UI/report checks, verify absence of unsafe auto-action language:

- [ ] no `prescribe`
- [ ] no `switch automatically`
- [ ] no `stop automatically`
- [ ] no `dose optimise`
- [ ] no `confirmed outbreak`

Also verify browser-local limitation wording appears where relevant (dashboard/outbreak/queue surfaces).
