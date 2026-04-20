# Scenario Acceptance Matrix

Human-readable companion to `scenario-matrix.json`. Six named benchmark
scenarios, fully pre-seeded in `src/medugu/seed/demoAccessions.ts` and
evaluable by calling `runValidation`, `evaluateIPC`, `evaluateIsolate`, and
`evaluateExportGate` directly.

Last regression run: **2026-04-20** (browser-phase final).

| # | Scenario | Accession | Observed rules / IPC | Observed blockers / warnings | Report visibility | Export gate | Pass/Fail |
|---|---|---|---|---|---|---|---|
| 1 | MRSA bloodstream infection | `MB25-EF34GH` | phenotype `MRSA` (+ `inducible_clindamycin_R`); IPC `MRSA_ALERT` | **Block** `PHONE_OUT_REQUIRED`; **Warn** `AMS_PENDING_RESTRICTED` | β-lactams (AMP, CRO) WITHHELD; VAN visible | Blocked until phone-out + release | ✅ pass |
| 2 | ESBL urinary tract infection | `MB25-AB12CD` | phenotype `ESBL` | **Warn** `MIC_REQUIRED_MISSING`, `AMS_PENDING_RESTRICTED` | 3GCs WITHHELD; NIT/FOS preferred | Available after release | ✅ pass |
| 3 | CRE sterile-site infection | `MB25-CRE001` | phenotypes `CRE`, `carbapenemase_suspected`; IPC `CRE_ALERT` | **(missing)** `PHONE_OUT_REQUIRED`; **Warn** `MIC_REQUIRED_MISSING`, `AMS_PENDING_RESTRICTED` | MEM visible; restricted agents WITHHELD pending AMS | Available immediately (should be blocked) | ❌ fail — DEF-001 |
| 4 | Sputum quality rejection (Bartlett) | `MB25-NP78QR` | none | **Warn** `ISO_NONE` | No susceptibility table; rejection report | Available after release | ✅ pass |
| 5 | CSF meningitis (consultant release) | `MB25-JK56LM` | none | **Block** `CONSULTANT_APPROVAL_REQUIRED`; **Warn** `AMS_PENDING_RESTRICTED` | NIT WITHHELD; CRO visible | Blocked until consultant approval + release | ✅ pass |
| 6 | Admission screening positivity & clearance | `MB25-ST90UV` | phenotypes `CRE`, `carbapenemase_suspected`; IPC `CRE_ALERT` (new episode) | **Warn** `AMS_PENDING_RESTRICTED` | All AST WITHHELD (`screening_only`); VAN/MEM never released clinically | Available after release | ✅ pass |

Five of six scenarios pass against the current build. Scenario 3 remains
**open** as DEF-001 — see `known-issues.md`.

## Per-scenario field reference

For every scenario the harness records (`benchmarkHarness.observeScenario`):

- `clicks`, `screenTransitions`, `timeOnTaskMs`
- `ruleExplanationVisible`
- `blockersVisible` (from `runValidation`)
- `exportAvailable` (from `evaluateExportGate`)

## Acceptance criteria

A scenario passes when **all** of the following hold:

1. Rule outputs (phenotypes + IPC rule codes) match the expected set.
2. Blockers and warnings match the expected set (modulo informational AMS
   warnings that depend only on whether any restricted agent appears).
3. Report visibility — antibiotics in `mustSuppress` are absent from the
   clinician-facing report and antibiotics in `mustShow` are present.
4. Export gate behaves as expected: blocked while a release blocker is
   present; otherwise available immediately after release.
