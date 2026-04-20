# Phase 5 — Production Implementation Plan

**Status:** Browser-phase build frozen 2026-04-20. This plan turns the current
modular browser build into the first production architecture as a **modular
monolith** (single deployable, internal module boundaries, one database, one
auth surface). It is deliberately **not** a microservice plan.

**Inputs:** `docs/acceptance/final-receipt.md`,
`docs/acceptance/scenario-matrix.json`,
`docs/acceptance/browser-phase-limitations.md`,
`docs/acceptance/known-issues.md`, current `src/medugu/**` modules.

**Out of scope for this document:** new feature surface, mobile app, BI
warehouse. Phase 5 is production hardening of the existing contract.

---

## A. Epic list

| # | Epic | One-line purpose |
|---|---|---|
| E1 | Identity & Access | Real auth, tenants, roles, role-bound action enforcement (not just RLS reads). |
| E2 | Clinical Case Service | Authoritative accession lifecycle owned by the server, not the browser store. |
| E3 | Durable Persistence | Production-grade Postgres schema, migrations, backups, point-in-time recovery. |
| E4 | Workflow & Validation | Server-evaluated `runValidation` / `evaluateExportGate` as the single source of truth. |
| E5 | Release Sealing & Amendment | Server-built, server-signed release packages with versioned amendments. |
| E6 | Stewardship Approvals | Real AMS pharmacist / consultant approval flow with bound identity and time stamps. |
| E7 | IPC Service & Surveillance | Cross-accession episode dedup, rolling windows, outbreak signals on the server. |
| E8 | Export & Interoperability | Real HL7v2 / FHIR transport with retry, NACK reconciliation, delivery receipts. |
| E9 | Configuration Service | Governed config (rule packs, breakpoints, antibiotics) with approvals and rollback. |
| E10 | Audit & Versioning | Immutable, append-only audit log with verifiable hash chain. |
| E11 | Analytics & Observability | App-level metrics, structured logs, traces, SLOs, on-call hooks. |

---

## B. Delivery sequence

Three production milestones. Each milestone is releasable.

### Milestone P5-M1 — "Server is authoritative" (foundations)
Goal: move governing state off the browser. After M1, the browser is a thin
client and cannot bypass rules by editing localStorage.

1. **E3 Durable Persistence** — lock production schema, add migrations CI,
   backups, PITR, RLS audit.
2. **E1 Identity & Access** — tenants, roles, role-bound *write* enforcement,
   service accounts, session hardening.
3. **E2 Clinical Case Service** — accessions, isolates, AST owned by server
   APIs; browser store becomes a cache + optimistic UI.
4. **E10 Audit & Versioning** — immutable audit log (hash-chained) wired to
   every write path created in 1–3.

### Milestone P5-M2 — "Clinical contract enforced server-side"
Goal: the rules that gate patient safety run on the server.

5. **E4 Workflow & Validation** — port `runValidation`,
   `evaluateExportGate`, `evaluateIPC`, `evaluateIsolate` to a server module;
   browser calls them, never re-implements them. **Includes DEF-001 fix +
   regression test.**
6. **E5 Release Sealing & Amendment** — server builds and signs the release
   package; amendment versioning; tamper detection.
7. **E6 Stewardship Approvals** — bound to real users, with reason codes,
   timestamps, and audit entries.

### Milestone P5-M3 — "Production interop & surveillance"
Goal: leave the demo perimeter.

8. **E8 Export & Interoperability** — real MLLP/HL7v2 + FHIR REST clients,
   retry queue, NACK handling, delivery receipts, idempotency keys.
9. **E7 IPC Service & Surveillance** — cross-accession episodes, rolling
   windows, scheduled re-evaluation when rule packs change.
10. **E9 Configuration Service** — approval chain, two-person rule, rollback,
    diff policy engine.
11. **E11 Analytics & Observability** — SLOs, alerting, dashboards, on-call.

---

## C. Dependency map

```
E3 ──┬─► E1 ──┬─► E2 ──┬─► E4 ──┬─► E5 ──► E8
     │        │        │        │
     │        │        │        └─► E6
     │        │        │
     │        │        └─► E7
     │        │
     │        └─► E10 (cuts across every write path)
     │
     └─► E9 (config tables) ──► E4 (rule packs feed validation)
                              └─► E7 (IPC rule packs)

E11 observability instruments E1–E10; do not block on it but wire it from M1.
```

Critical path: **E3 → E1 → E2 → E4 → E5 → E8.** Everything else parallelises
behind those gates.

---

## D. Production blocker map (top 10)

| # | Blocker | Why it blocks production | Epic |
|---|---|---|---|
| B1 | Governing state lives in the browser store (`accessionStore.ts`, localStorage). | Patient-safety rules can be bypassed by editing client state. | E2, E4 |
| B2 | DEF-001 — sterile-site IPC critical alert does not require phone-out. | Open clinical defect against the contract. | E4 |
| B3 | Workflow actors (consultant, AMS, IPC) are user-supplied free text, not bound identities. | No accountability; audit cannot attribute approvals. | E1, E6 |
| B4 | Role enforcement only on RLS reads; writes are not role-bound at the action level. | Privilege escalation risk. | E1 |
| B5 | Release package is built and "sealed" client-side. | A user can ship an unsealed/altered package. | E5 |
| B6 | Audit log is mutable and tenant-scoped only; no hash chain. | Cannot prove tamper-evidence to a regulator. | E10 |
| B7 | Dispatch is a mock; no real MLLP/FHIR transport, no retry queue, no NACK reconciliation. | Cannot integrate with a real EMR. | E8 |
| B8 | IPC surveillance is per-tenant local; no cross-accession episode authority on server. | Outbreak signals are not reproducible across observers. | E7 |
| B9 | Config (rule packs, breakpoints, antibiotics) is locally edited with no approval chain or rollback. | A single user can change clinical rules unilaterally. | E9 |
| B10 | No production observability: no SLOs, no alerting, no structured logs, no traces. | Cannot detect or triage incidents. | E11 |

---

## E. Per-epic detail

### E1 — Identity & Access
- **Purpose:** real auth and role-bound *action* enforcement.
- **From browser → backend:** action-level permission checks (currently UI-gated)
  move into server-fn middleware; actor identity stamped server-side.
- **Dependencies:** E3.
- **Risks:** breaking existing tenant bootstrap (`handle_new_user`), session
  rotation across tabs.
- **Delivery order:** M1, after E3.
- **Acceptance:** every server-fn that mutates clinical state checks `has_role`
  and writes `actor_user_id`; no UI-only role check remains for write paths.

### E2 — Clinical Case Service
- **Purpose:** server owns accession lifecycle, isolate set, AST results.
- **From browser → backend:** `dispatch.functions.ts` becomes the only write
  path; `accessionStore.ts` becomes a read cache + optimistic mutation buffer.
- **Dependencies:** E1, E3.
- **Risks:** offline UX regressions; conflict resolution on concurrent edits.
- **Delivery order:** M1.
- **Acceptance:** all six benchmark scenarios reproduce identically from a
  cold cache against the server APIs; localStorage tampering cannot change a
  rendered report.

### E3 — Durable Persistence
- **Purpose:** production-grade Postgres baseline.
- **From browser → backend:** N/A (already server). Hardening only.
- **Dependencies:** none.
- **Risks:** migration drift between Lovable Cloud and a future self-hosted
  Postgres.
- **Delivery order:** M1, first.
- **Acceptance:** PITR proven by restore drill; migration CI green on
  forward + rollback; RLS coverage verified by `supabase--linter`.

### E4 — Workflow & Validation
- **Purpose:** the clinical rules engine runs on the server.
- **From browser → backend:** `validationEngine.ts`, `ipcEngine.ts`,
  `astEngine.ts`, `stewardshipEngine.ts`, `releaseEngine.ts` become a server
  module; browser imports a thin client.
- **Dependencies:** E2, E9 (rule packs).
- **Risks:** divergence between browser and server engine versions during
  the cutover window.
- **Delivery order:** M2, first.
- **Acceptance:** DEF-001 regression test passes; all six scenarios pass
  against server-side `runValidation` / `evaluateExportGate` with byte-equal
  outputs to the current browser engine outside the DEF-001 case.

### E5 — Release Sealing & Amendment
- **Purpose:** server builds, hashes, and signs release packages; amendments
  are versioned and linkable.
- **From browser → backend:** `release_packages.body_sha256` becomes a
  server-computed signature; amendment chain enforced at the DB level.
- **Dependencies:** E2, E4.
- **Risks:** signature key management; legacy unsigned packages.
- **Delivery order:** M2.
- **Acceptance:** browser cannot produce a release package the server will
  accept without re-signing; amendments are append-only with a parent link.

### E6 — Stewardship Approvals
- **Purpose:** AMS / consultant approval bound to a real user with reason and
  timestamp.
- **From browser → backend:** the "approval recorded" event becomes a
  server-fn that requires the matching role.
- **Dependencies:** E1, E4.
- **Risks:** UX flow change for clinicians used to free-text actor labels.
- **Delivery order:** M2.
- **Acceptance:** CSF and MRSA scenarios cannot be released without an
  approval row whose `actor_user_id` holds the required role.

### E7 — IPC Service & Surveillance
- **Purpose:** server-owned episode dedup, rolling windows, scheduled
  re-evaluation.
- **From browser → backend:** `ipc_signals` becomes the authoritative episode
  store; `ipcEpisodeDetail` reads from server; cross-accession aggregation
  added.
- **Dependencies:** E2, E9.
- **Risks:** episode boundary changes when rule packs are bumped.
- **Delivery order:** M3.
- **Acceptance:** screening clearance scenario (`MB25-ST90UV`) produces
  identical episode counts across two observers in two browsers.

### E8 — Export & Interoperability
- **Purpose:** real transport.
- **From browser → backend:** `exportEngine` payload build stays;
  *transport* moves to a server worker with retry queue, NACK reconciliation,
  idempotency keys, delivery receipts.
- **Dependencies:** E5.
- **Risks:** EMR receiver quirks; back-pressure under load.
- **Delivery order:** M3, first.
- **Acceptance:** `dispatch.failed` events are retried per policy; duplicate
  sends are rejected by idempotency key; delivery receipts close the loop.

### E9 — Configuration Service
- **Purpose:** governed config with approvals, rollback, and diff policy.
- **From browser → backend:** `configStore.ts` drafts move into a server
  module with a two-person approval chain.
- **Dependencies:** E1, E10.
- **Risks:** rule-pack version skew across active sessions.
- **Delivery order:** M3.
- **Acceptance:** publishing a rule pack requires two distinct approvers;
  rollback restores byte-identical prior state; diffs are policy-checked.

### E10 — Audit & Versioning
- **Purpose:** tamper-evident, append-only audit.
- **From browser → backend:** add a hash-chain column to `audit_event`,
  computed in a SECURITY DEFINER trigger; deny UPDATE/DELETE at the role
  level.
- **Dependencies:** E3.
- **Risks:** schema migration on a populated table; chain repair if a row is
  ever lost.
- **Delivery order:** M1, after E3.
- **Acceptance:** any row mutation breaks the chain and is detectable by a
  daily verifier job.

### E11 — Analytics & Observability
- **Purpose:** SLOs, structured logs, traces, alerts, on-call.
- **From browser → backend:** structured server logs replace ad-hoc console
  logging; client errors shipped to a sink.
- **Dependencies:** none hard; instruments everything.
- **Risks:** PHI leakage in logs — must scrub at the source.
- **Delivery order:** wire from M1, harden in M3.
- **Acceptance:** documented SLOs for release-build latency, dispatch success,
  validation latency; alerting paged in a drill.

---

## F. Recommendation: first implementation sprint

**Sprint P5-S1 (2 weeks). Theme: "Lock the foundation, fix the open defect."**

Scope, in order:

1. **E3 hardening** — backups, PITR drill, migration CI, RLS linter to zero.
   *(½ sprint)*
2. **E10 audit hash-chain** — add chained hash column + trigger; deny
   UPDATE/DELETE on `audit_event` for non-service roles. *(¼ sprint)*
3. **E4 DEF-001 fix in place** — port `runValidation` to a server-fn for the
   sterile-site + IPC-critical case only, with a regression test against
   `MB25-CRE001`; ship behind a feature flag. *(¼ sprint)*

Exit criteria for S1:
- Restore drill passes.
- Migration CI green on forward + rollback.
- `MB25-CRE001` produces `PHONE_OUT_REQUIRED` from the server-side rule path
  and the regression test is in CI.
- Audit hash-chain verifier job runs daily and is green.

Explicitly **not** in S1: real dispatch transport, configuration approval
chain, IPC cross-accession aggregation, observability dashboards. Those land
in M2/M3 once the foundation is locked.

Do **not** start any browser-phase feature work in S1.
