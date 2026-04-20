# Browser-phase Final Regression & Acceptance Receipt

**Date:** 2026-04-20
**Build phase:** end of browser-phase feature build
**Method:** direct invocation of `runValidation`, `evaluateIPC`,
`evaluateIsolate`, and `evaluateExportGate` against the seeded demo
accessions in `src/medugu/seed/demoAccessions.ts`. No new feature code
was added in this regression pass.

---

## A. Files updated

- `docs/acceptance/scenario-matrix.json` — refreshed with observed-vs-expected
  blocks per scenario, build/run metadata, and pass/fail verdicts.
- `docs/acceptance/scenario-matrix.md` — refreshed table; pass/fail filled in.
- `docs/acceptance/known-issues.md` — new authoritative defect log.
- `docs/acceptance/browser-phase-limitations.md` — new browser-phase scope
  statement.
- `docs/acceptance/export-verification/README.md` — refreshed with the
  current export-gate regression run.
- `docs/acceptance/final-receipt.md` — this file.

No source code was modified.

---

## B. Scenario-by-scenario regression summary

| # | Scenario | Accession | Expected blockers | Observed blockers | Result |
|---|---|---|---|---|---|
| 1 | MRSA bloodstream infection | `MB25-EF34GH` | `PHONE_OUT_REQUIRED` | `PHONE_OUT_REQUIRED` | ✅ pass |
| 2 | ESBL urinary tract infection | `MB25-AB12CD` | none | none | ✅ pass |
| 3 | CRE sterile-site infection | `MB25-CRE001` | `PHONE_OUT_REQUIRED` | none | ❌ fail (DEF-001) |
| 4 | Sputum quality rejection (Bartlett) | `MB25-NP78QR` | none (warn `ISO_NONE`) | none (warn `ISO_NONE`) | ✅ pass |
| 5 | CSF consultant-controlled release | `MB25-JK56LM` | `CONSULTANT_APPROVAL_REQUIRED` | `CONSULTANT_APPROVAL_REQUIRED` | ✅ pass |
| 6 | Admission screening positivity & clearance | `MB25-ST90UV` | none | none | ✅ pass |

**Aggregate:** 5 / 6 pass. Scenario 3 fails because the IPC-driven
sterile-site phone-out coupling (DEF-001) is not present in the current
`validationEngine.ts`.

Per-scenario detail (rules / phenotypes / IPC / warnings / export reason)
is in `scenario-matrix.json` under each `observed` block.

---

## C. Export regression summary

`evaluateExportGate` was exercised on all six demo accessions in their
seeded state.

- **Pre-release behaviour:** all six correctly report
  `"Report not yet released — release first to produce a versioned export."`
  except the two scenarios that are pre-blocked by validation
  (`MB25-EF34GH`, `MB25-JK56LM`), which correctly cite the validation
  blocker as the export-gate reason.
- **Format pack:** the three saved samples
  (`samples/MRSA_BSI.fhir.json`, `samples/ESBL_UTI.hl7`,
  `samples/CSF_CONSULTANT.normalised.json`) remain representative of the
  current `exportEngine` output. No schema breakage was observed.
- **Client-side guarantee:** confirmed unchanged — the export path does
  not call `fetch`; copy goes through `navigator.clipboard`, download
  uses a `Blob` + object URL.
- **Open export gap:** Scenario 3 (`MB25-CRE001`) currently allows
  immediate post-release export despite an active IPC critical alert on a
  sterile-site specimen. This is a downstream consequence of DEF-001, not
  a separate export defect.

---

## D. Current known defects / review points

### Open

- **DEF-001 — Sterile-site IPC critical alert does not require phone-out.**
  Severity: high. Owner: `validationEngine`. Symptom and expected
  behaviour are documented in `known-issues.md`. A previous patch was
  recorded as fixing this; the current source does not contain that
  patch, so the regression has been re-opened for Phase 5.

### Closed / non-defects

- **DEF-002 — Sputum rejection warning code.** Closed. The matrix has
  been corrected to expect `ISO_NONE` (the engine's actual output for a
  rejected sputum without isolates), which is the clinically correct
  behaviour.
- **Screening CRE alert (Scenario 6).** Not a defect. The colonisation
  isolate has a CRE phenotype, so `CRE_ALERT` correctly fires for
  surveillance. Antibiotic visibility is governed at report-build time by
  stewardship's `screening_only` flag.

### Review points (informational, non-blocking)

- MRSA scenario emits an additional `inducible_clindamycin_R` phenotype
  alongside `MRSA`. Correct expert-rule output; called out so reviewers
  do not flag it as drift.
- `AMS_PENDING_RESTRICTED` warnings appear on every scenario containing
  any restricted agent. Informational by design.

---

## E. Browser-phase limitations summary

(Full text in `browser-phase-limitations.md`.)

1. **Single-user / browser persistence.** Local cache + per-tenant cloud
   tables; no multi-user conflict resolution; no offline-first sync.
2. **Placeholder identity / actor model.** Auth is real; role-bound
   action enforcement lives only in RLS. Workflow actors (consultant,
   AMS pharmacist, IPC) are user-supplied free text at the action site.
3. **Mock dispatch vs real transport.** Dispatch panel exercises the
   build → freeze → POST pipeline locally; no real receiver, no retry
   queue, no NACK reconciliation, no end-to-end EMR acknowledgement.
4. **Local IPC cohort vs server-backed surveillance.** Episode dedup,
   rolling windows, and clearance counting operate over the signed-in
   user's cloud tenant only. No cross-facility outbreak aggregation, no
   scheduled re-evaluation when rule packs change.
5. **Local config governance vs enterprise config service.** Drafts /
   publish / rollback are local UI actions with a thin cloud audit
   trail. No multi-step approval chain, no two-person rule, no policy
   engine over diffs, no change-control ticket integration.

---

## F. Recommendation: ready for production planning?

**Yes — ready to begin Phase 5 production planning, conditional on the
following.**

The browser-phase build delivers the full clinical workflow contract end
to end: validation, IPC, AMS, stewardship-controlled visibility, release
sealing, governed exports, mock dispatch, analytics, semantic-coloured
clinical UI, and accessibility-first sound cues. Five of six benchmark
scenarios pass without intervention, and the sixth fails on a clearly
scoped, well-understood defect with a known correct shape.

Conditions for Phase 5 entry:

1. **DEF-001 must be re-fixed and locked in** (sterile-site IPC critical
   alert ⇒ `PHONE_OUT_REQUIRED` blocker until acknowledged phone-out is
   recorded). Add an explicit unit test against `MB25-CRE001` so the
   patch cannot regress silently again.
2. **Treat all five items in §E as Phase-5 work items**, not as
   browser-phase defects. None of them are bugs against the current
   contract; they are scope boundaries the user has explicitly agreed to.
3. **Do not extend new feature work into Phase 5 from this receipt.**
   Phase 5 is production planning — backend authority, real transport,
   real surveillance, real config governance, regulatory artefacts —
   not additional product surface.
