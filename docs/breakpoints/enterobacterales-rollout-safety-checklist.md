# Enterobacterales EUCAST Rollout Safety Checklist

Date: 2026-04-28
Scope: `src/medugu/config/breakpointRegistry/eucast2026/enterobacterales.ts`

## Goal

Complete Enterobacterales antibiotic coverage **without runtime regressions** and
without activating unverified clinical thresholds.

## Guardrails

1. Keep all EUCAST rows as `needs_validation`, `missing`, or `not_applicable`
   until official source rows are transcribed and clinically reviewed.
2. Add explicit placeholder rows for antibiotics present in AST panels but not
   yet numerically transcribed (do not silently omit them).
3. Treat subgroup-specific rows (e.g., Morganellaceae / Serratia exceptions)
   as non-active until organism-level routing is implemented.
4. Do not switch interpretation defaults to EUCAST in production until
   validation and sign-off are complete.
5. Do not make network fetches part of this workflow. If external EUCAST URLs
   are proxy-blocked (e.g., HTTP 403), continue using a locally supplied source
   file and record provenance in `sourceTableRef` and source notes.

## Recommended execution order

1. Ensure antibiotic dictionary includes all Enterobacterales panel codes.
2. Ensure registry includes explicit row status for each code (`needs_validation`,
   `missing`, `not_applicable`, `active`).
3. Add/refresh source notes for every newly transcribed row.
4. Run app-level regression checks before and after each batch.
5. Activate rows only in small batches after clinical sign-off.

## Minimum regression checklist per batch

- App boots from cold start.
- Login/auth initialization succeeds.
- Case manager loads seeded accessions.
- AST section renders without crashes.
- Validation/Release gates are unchanged for baseline scenarios.
- Run `npm run check:enterobacterales-breakpoints` to ensure panel-to-registry
  coverage remains consistent.

## Activation policy

A breakpoint row should move to `active` only when all are true:

- Numeric threshold copied from official EUCAST v16.0 source.
- `sourceTableRef` points to exact source row.
- Reviewer verifies category set (`S/I/R/ND`) and method scope (`MIC` vs disk).
- Any subgroup/specimen/indication constraints are represented in notes or
  routing logic.

## Current Enterobacterales panel status (2026-04-28)

Activated for all current Enterobacterales panel antibiotics with transcribed MIC+disk thresholds:

- `AMP`, `AMC`, `TZP`, `CXM`, `FEP`, `CTX`, `CAZ`, `CRO`, `ETP`, `IPM`, `MEM`, `ATM`, `AMK`, `GEN`, `CIP`, `LVX`, `SXT`, `TGC`.

Still pending targeted modelling/validation in routing logic (not numeric transcription):

- `IPM` (subgroup caveat: Enterobacterales except Morganellaceae).
- `AMK`, `GEN` (UTI/indication-constrained rows).
- `SXT` (Serratia subgroup caveat).
- `TGC` (species caveat: E. coli and K. oxytoca).
