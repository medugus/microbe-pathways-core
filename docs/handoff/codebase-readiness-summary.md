# Codebase Readiness Summary

End-of-Lovable-phase status. Companion to:

- `docs/acceptance/scenario-matrix.md`
- `docs/acceptance/benchmark-baseline-template.md`
- `docs/acceptance/export-verification/README.md`
- `docs/handoff/local-run-and-verification.md`
- `docs/architecture/phase-5-handoff.md`

## Complete in the Lovable phase

- Modular scaffold under `src/medugu/` (domain / store / logic / config /
  ui / utils / seed) with no business logic in React components.
- Specimen resolver with acceptance, microscopy, required fields, report
  sections, and gating per resolved profile.
- Workflow core: stages, forward-transition map, validation-gated
  `Validation → Released` transition, audit on blocked + successful
  transitions.
- AST engine with MRSA, ESBL, CRE/carbapenemase, VRE, inducible
  clindamycin, intrinsic, AmpC suspicion, unusual antibiogram.
  Phenotype flags, expertRulesFired, governance, cascade decision,
  consultant override with audit.
- Stewardship engine with release classes, AWaRe, syndrome-aware logic
  (UTI, BSI, meningitis, CAP/HAP/VAP), restricted-drug approval gating
  (placeholder approver), per-row visibility.
- IPC engine with MRSA / VRE / CRE / CRAB / CRPA / Candida auris /
  CDI / invasive ESBL contexts, rolling-window dedup, colonisation
  clearance counting.
- Validation engine with phone-out + consultant approval as true
  release blockers.
- Release engine producing a frozen `ReleasePackage` with version pins.
- Report preview honouring visibility (WITHHELD with inline reason),
  source-tagged comments (clinical / stewardship / IPC).
- Export engine producing FHIR R4 Bundle, HL7 v2.5 ORU^R01, and
  normalised JSON, gated by `evaluateExportGate`, fully client-side.
- Six fully pre-seeded benchmark scenarios.
- Benchmark harness (pure, framework-agnostic) with scenario catalogue
  and live observation function.
- Browser persistence at `SCHEMA_VERSION = 5`.
- Acceptance pack, baseline template, export samples, local-run guide,
  Phase 5 architecture handoff.

## Browser-phase only (intentionally not production)

- `localStorage` persistence.
- `signedBy: "user-placeholder"` and consultant/AMS approver placeholders.
- Restricted-drug approval as a visibility flag (no approval workflow).
- IPC rolling-window scan over the in-memory store only.
- No outbound export transport — copy/download for demo.
- No multi-tenant isolation, no roles enforced.
- No cryptographic sealing of the `ReleasePackage`.
- No amendment / correction status (`status=amended`, HL7 result-status
  `C`).
- No FHIR `Practitioner`/`PractitionerRole`, `ServiceRequest`,
  conformance URLs, or terminology validation.
- No HL7 `ORC` / `SPM` segments.

## Must be added before controlled deployment

- Identity, roles, and session management.
- Postgres-backed persistence with RLS and per-tenant isolation.
- Server-authoritative workflow + release gating.
- Append-only audit event table with actor binding.
- Cryptographic seal + signed `ReleasePackage`.
- Restricted-drug approval workflow with AMS pharmacist actor.
- Cross-accession IPC queries.
- Outbound interoperability transport (HTTP, MLLP, secure file drop)
  with receiver registry and delivery audit.
- Config promotion workflow (rules / breakpoints / dictionaries).
- Production logging, monitoring, and alerting.
- A documented data-retention and backup policy.
- Validation against EUCAST/CLSI source-of-truth and a clinical sign-off
  on the rule set per locale.

## Top 10 production blockers

1. **No real identity** — `signedBy`, consultant approver, AMS approver
   are placeholders; non-repudiation is impossible.
2. **`localStorage` persistence** — not durable, not multi-user,
   wiped on schema mismatch.
3. **No row-level tenant isolation** — single-user demo only.
4. **No cryptographic sealing of `ReleasePackage`** — frozen logically
   but not provably immutable.
5. **No amendment/correction flow** — released reports cannot be
   corrected with audit trail.
6. **Restricted-drug approval is a visibility flag, not a workflow** —
   no AMS approver action, no audit, no SLA.
7. **IPC rolling window only sees in-memory accessions** — cannot
   detect outbreaks across the actual case load.
8. **No outbound interoperability transport** — exports are
   copy/download only.
9. **No clinical sign-off on the rule set** — engines need formal
   review against EUCAST/CLSI for the deployment locale before clinical
   use.
10. **No production observability** — no centralised logs, metrics,
    alerting, or audit query surface.

## Recommended Phase 5 implementation order

1. Identity + Postgres + RLS + audit table.
2. Move engines + configs into a shared package; backend wraps them.
3. Clinical case service + server-authoritative workflow/validation/release.
4. Cryptographic seal on `ReleasePackage` + amendment flow.
5. Restricted-drug approval workflow + cross-accession IPC queries.
6. Outbound export transport + receiver registry.
7. Config promotion workflow.
8. Analytics projections + benchmark as backend acceptance test.
9. Production observability + retention/backup policy.
10. Locale-specific clinical sign-off of the rule set.

## Confirmation

- Modular file boundaries: intact.
- Logic outside React: intact.
- Accession state as single source of truth: intact.
- Browser persistence: working at `SCHEMA_VERSION = 5`.
- Codebase portable as plain React/Vite: confirmed (see
  `docs/handoff/local-run-and-verification.md`).
- **No new clinical feature logic was added in this handoff step** —
  only documentation under `docs/`.
