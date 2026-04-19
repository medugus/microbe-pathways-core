# Scenario Acceptance Matrix

Human-readable companion to `scenario-matrix.json`. Six named benchmark
scenarios, each fully pre-seeded in `src/medugu/seed/demoAccessions.ts` and
evaluable via `observeScenario(accession)` in
`src/medugu/logic/benchmarkHarness.ts`.

| # | Scenario | Accession | Expected rules | Expected blockers / warnings | Report visibility | Export availability | Workflow path | Pass/Fail |
|---|---|---|---|---|---|---|---|---|
| 1 | MRSA bloodstream infection | `MB25-EF34GH` | `STA_MRSA` (phenotype `MRSA`) | **Block**: `PHONE_OUT_REQUIRED` | β-lactams (AMP, CRO) WITHHELD with reason; VAN visible | Available after phone-out + release | Accession → Specimen → Microscopy → Isolate → AST → Validation → Released | ☐ |
| 2 | ESBL urinary tract infection | `MB25-AB12CD` | `ENB_ESBL` (phenotype `ESBL`) | None | 3GCs (CRO, CAZ) WITHHELD; NIT, FOS marked first-line preferred | Available immediately (no critical-comm gate) | Accession → Specimen → Isolate → AST → Validation → Released | ☐ |
| 3 | CRE sterile-site infection | `MB25-CRE001` | `ENB_CRE` (phenotypes `CRE`, `carbapenemase_suspected`); IPC `CRE_ALERT` | **Block**: `PHONE_OUT_REQUIRED` | MEM visible; restricted last-line agents WITHHELD pending AMS approval | Available after phone-out + release | Accession → Specimen → Isolate → AST → Validation → Released | ☐ |
| 4 | Sputum quality rejection (Bartlett) | `MB25-NP78QR` | None (specimen rejected) | **Warning**: `MIC_REQUIRED_MISSING` (none required since rejected) | No susceptibility table; rejection NTE/comment | Available (rejection is a valid final state) | Accession → Specimen → Microscopy → Released (rejection report) | ☐ |
| 5 | CSF meningitis with consultant-controlled release | `MB25-JK56LM` | None (syndrome cascade) | **Block**: `CONSULTANT_APPROVAL_REQUIRED` | NIT WITHHELD (no CSF penetration); CRO visible | Available after consultant approval + release | Accession → Specimen → Microscopy → Isolate → AST → Validation → Released | ☐ |
| 6 | Admission screening positivity & clearance | `MB25-ST90UV` | None (screening profile) | None | All AST WITHHELD (`screening_only`); VAN, MEM never released clinically; clearance progress carried | Available immediately | Accession → Specimen → Isolate → Released (screening report) | ☐ |

## Benchmark metric fields captured per scenario

For every scenario the harness records:

- `clicks`
- `screenTransitions`
- `timeOnTaskMs`
- `ruleExplanationVisible`
- `blockersVisible` (derived from `runValidation`)
- `exportAvailable` (derived from `evaluateExportGate`)

## Acceptance verdict columns

Each scenario row carries a `pass/fail` placeholder. A scenario passes when:

1. `observeScenario(accession).rules` ⊇ expected rules
2. `observeScenario(accession).phenotypes` ⊇ expected phenotypes
3. `observeScenario(accession).blockers` matches expected blocker set
4. `visibility.mustSuppress` antibiotics are not present in clinician-visible
   AST output, and `visibility.mustShow` antibiotics are present
5. After completing the scenario's required actions (phone-out, consultant
   approval, release), `exportAvailable === true`

Re-evaluate by reloading the demo, opening each accession, and reading the
Benchmark panel.
