# Medugu — Software Requirements Specification (SRS)

**Document status:** Draft v1.0
**Owner:** Medugu Engineering
**Last updated:** 2026-06-11
**Companion to:** `PRD.md`, `URD.md`
**Conforms loosely to:** IEEE Std 830 structure, adapted for a
contract-first, engine-driven LIMS.

---

## 1. Introduction

### 1.1 Purpose
This SRS specifies the functional and non-functional requirements of
the Medugu clinical microbiology platform at engineering granularity.
Each requirement (`SR-xxx`) is implementable, testable, and traceable
back to a user requirement (`UR-xxx`) in `URD.md`.

### 1.2 Scope
The SRS covers:
- the React client (Vite + TanStack Start + React 19),
- the framework-agnostic domain core (`src/medugu/{domain,config,logic,store,utils}`),
- the persistence adapter (`localStorage` in browser phase, Postgres in
  Phase 5),
- the integration surfaces (Zone Reader contract v1, FHIR/HL7/JSON
  export),
- the admin surfaces and the authentication/authorisation model
  (Lovable Cloud).

### 1.3 Definitions
- **Accession**: a coded case from specimen receipt to release.
- **Isolate**: a coded organism recovered from an accession.
- **AST row**: a single antibiotic test on an isolate
  (`isolateId × antibioticCode × method × standard`).
- **Cascade**: the policy that decides which antibiotic results are
  released vs suppressed.
- **Release seal**: a hash-bound, signed snapshot of the released
  report.
- **ZoneResult**: payload returned by Zone Reader containing zone
  diameters per antibiotic for a given worklist.
- **Pinned versions**: `BUILD_VERSION`, `EXPORT_VERSION`,
  `BREAKPOINT_VERSION`, `RULE_VERSION` — embedded in every release.

### 1.4 References
- `docs/integrations/zone-reader-contract-v1.md`
- `docs/integration-contract/medugu-zone-result-import-mapping.md`
- `docs/architecture/phase-5-handoff.md`
- `docs/acceptance/*` (scenario matrix, manual/live round-trip,
  inbound-production-url hardening, public-endpoint live)
- `src/medugu/README.md`

---

## 2. Overall Description

### 2.1 Product perspective
Medugu is a single-page application backed by Lovable Cloud. The
domain core is **framework-agnostic** and is consumed by the React UI
today; in Phase 5 it is consumed by both the React UI and the backend
modular monolith without code change.

### 2.2 High-level architecture
```text
┌─────────────────────────────────────────┐
│  React client (Vite + TanStack Start)   │
│   - routes/ (file-based)                │
│   - medugu/ui/ (sections, shell)        │
│   - medugu/store/useAccessionStore      │
└──────────────┬──────────────────────────┘
               │ pure imports
┌──────────────▼──────────────────────────┐
│  Domain core (framework-agnostic)       │
│   - domain/ (types, ids, enums, versions)│
│   - config/ (dictionaries, breakpoints) │
│   - logic/ (engines: AST, AMS, IPC,     │
│             validation, release, export)│
│   - store/accessionStore (zustand-like) │
│   - utils/ (audit, canonical JSON)      │
└──────────────┬──────────────────────────┘
               │ adapter
┌──────────────▼──────────────────────────┐
│  Persistence                             │
│   - browser-phase: localStorage          │
│     (medugu.v3.state)                    │
│   - Phase 5: Postgres + RLS              │
└──────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│ Server (TanStack Start, Cloudflare      │
│ Worker runtime)                          │
│  - createServerFn for app RPC            │
│  - /api/public/* for webhooks           │
│  - requireSupabaseAuth middleware        │
│  - attachSupabaseAuth function MW        │
└─────────────────────────────────────────┘
```

### 2.3 Constraints
- Cloudflare Worker runtime (no `child_process`, `sharp`, native
  bindings).
- Strict TypeScript; unresolved imports are hard build failures.
- Roles in a separate `user_roles` table; `has_role` SECURITY DEFINER.
- Tables in `public` require explicit `GRANT`s and RLS.
- `src/integrations/supabase/client.ts` is auto-generated; never edit.

---

## 3. Functional Requirements

### 3.1 Authentication & Authorisation

| ID | Requirement | Verification | Trace |
|---|---|---|---|
| SR-001 | The system shall require authenticated sessions for all non-public routes. | Manual: unauthenticated access to `/` redirects to `/login`. | UR-001 |
| SR-002 | The system shall support email/password and Google OAuth providers. | Manual sign-in with both providers. | UR-001 |
| SR-003 | The system shall store roles in `public.user_roles`, never on the profile. | Schema review; migration test. | UR-002, UR-006 |
| SR-004 | The system shall expose a SECURITY DEFINER `public.has_role(uuid, app_role)` function. | SQL unit test. | UR-002 |
| SR-005 | Privileged server functions shall call `requireSupabaseAuth` and assert role via `has_role`. | Code review; unit tests reject unauthorised calls. | UR-003 |
| SR-006 | `src/start.ts` shall register `attachSupabaseAuth` in `functionMiddleware`. | File assertion in test. | UR-003 |

### 3.2 Domain Model & State

| ID | Requirement | Verification | Trace |
|---|---|---|---|
| SR-010 | The domain shall expose strongly-typed `Accession`, `Isolate`, `ASTResult`, `ReleasePackage`, `StewardshipDecision`, `IPCDecision` records. | Type check; `domain/types.ts` review. | UR-040, UR-050 |
| SR-011 | The `accessionStore` shall expose CRUD actions (`upsertAccession`, `addIsolate`, `addAST`, `updateAST`, `overrideCascade`, `setWorkflowStage`, `finaliseRelease`, etc.) without React imports. | Unit test: import store from a Node context. | All §3 |
| SR-012 | State shall be JSON-serialisable and persisted to `localStorage` under `medugu.v3.state`. | Roundtrip test: serialise → restore. | UR-130 |
| SR-013 | The store shall expose `hydrateFromTenant` / `detachTenant` to swap tenant scopes in Phase 5 without engine change. | Unit test. | — |

### 3.3 Specimen Resolution

| ID | Requirement | Verification | Trace |
|---|---|---|---|
| SR-020 | Specimen entry shall accept `(specimenFamily, specimenSubtype)` from `config/specimenFamilies.ts` only. | Code path rejects unknown codes. | UR-020 |
| SR-021 | `specimenResolver` shall return a workflow profile (required sections, sterile-site flag, blood-culture branch). | Unit test per family. | UR-021, UR-022 |
| SR-022 | Sterile-site specimens shall propagate the `sterileSite=true` flag through IPC and validation engines. | Integration test (sterile-site *S. aureus* → IPC fires). | UR-022, UR-080 |

### 3.4 AST Engine

| ID | Requirement | Verification | Trace |
|---|---|---|---|
| SR-030 | `astEngine.evaluateIsolate(accession, isolate)` shall be pure (no I/O, no mutation of inputs). | Unit test: input equality before/after. | UR-052 |
| SR-031 | For each AST row, `rawInterpretation` shall be derived from the breakpoint registry pinned by `BREAKPOINT_VERSION`. | Unit tests per registry (eucast2026 enterobacterales, pseudomonas, staphylococcus, …). | UR-052 |
| SR-032 | The engine shall detect and apply: MRSA (FOX/OXA R) with β-lactam suppression except anti-MRSA agents; MSSA; inducible clindamycin resistance (ERY R + CLI S); ESBL (3GC R, carbapenem S); AmpC suspicion (CRO R, FEP S); CRE / carbapenemase suspicion (MEM/ETP R); VRE / VSE; enterococcal intrinsic cephalosporin resistance; non-fermenter carbapenem-R; unusual antibiogram (glycopeptide S vs gram-negative). | `astEngine` unit tests; regression tests under `logic/__tests__/`. | UR-053 |
| SR-033 | Suppressed rows shall set `cascadeDecision = "suppressed_by_phenotype"` and `interpretedSIR = "R"` unless a consultant override exists. | Unit test. | UR-054 |
| SR-034 | Cascade decisions shall run *after* phenotype patches via `cascadeEngine.evaluateCascadeForIsolate`. | Unit test ordering. | UR-054 |
| SR-035 | Consultant overrides shall preserve `interpretedSIR` and override `finalInterpretation` only, with audit. | Unit test. | UR-055 |
| SR-036 | Every fired rule shall carry `{ruleCode, message, firedAt, ruleVersion}`. | Schema assertion. | UR-120 |

### 3.5 Stewardship (AMS)

| ID | Requirement | Verification | Trace |
|---|---|---|---|
| SR-040 | `stewardshipEngine` shall classify each released antibiotic as Access/Watch/Reserve per `config/antibiotics.ts`. | Unit test. | UR-070 |
| SR-041 | Watch/Reserve agents shall produce an AMS approval request with SLA timer (`requestAMSApproval`). | Store action test. | UR-071 |
| SR-042 | AMS approvals shall support `decideAMSApproval`, `expireAMSApproval`, `escalateAMSApproval`, `sweepAMSSlas`. | Store action tests. | UR-071, UR-072 |
| SR-043 | The release engine shall block release of Reserve agents lacking approval. | Validation test. | UR-073, UR-090 |
| SR-044 | AMS rule governance shall pin `RULE_VERSION` and record fired rules per decision. | Unit test. | UR-120 |

### 3.6 IPC Engine

| ID | Requirement | Verification | Trace |
|---|---|---|---|
| SR-050 | `ipcEngine` shall fire alerts for MRSA, VRE, CRE, *C. difficile*, *M. tuberculosis*, and sterile-site *S. aureus*. | Unit tests under `logic/__tests__/ipc*.test.ts`. | UR-080 |
| SR-051 | Alerts shall fire at AST evaluation time, not at release. | Integration test. | UR-081 |
| SR-052 | `ipcQueue` shall support open/in-investigation/closed episode states with audit. | Unit test. | UR-082 |
| SR-053 | `ipcLocalWatch` shall surface tenant-defined organisms/resistances. | Unit test. | UR-083 |
| SR-054 | `ipcColonisation` shall track colonisation distinctly from infection. | Unit test. | UR-084 |

### 3.7 Workflow & Validation

| ID | Requirement | Verification | Trace |
|---|---|---|---|
| SR-060 | `workflowEngine` shall gate stage transitions on required-field completeness per specimen profile. | Unit test. | UR-021 |
| SR-061 | `validationEngine` shall produce blockers, warnings, and infos with stable codes. | Unit test. | UR-090 |
| SR-062 | Pre-release validation shall block release when any blocker is present. | Integration test. | UR-090 |

### 3.8 Release & Amendment

| ID | Requirement | Verification | Trace |
|---|---|---|---|
| SR-070 | `releaseEngine.finalise` shall produce a `ReleasePackage` containing canonical JSON, SHA-256 hash, signing identity, and pinned versions. | Hash determinism test using `utils/canonicalJson.ts`. | UR-091, UR-093 |
| SR-071 | Amendment shall create a new release version chained by `previousReleaseHash` with a coded amendment reason. | Unit test. | UR-092 |
| SR-072 | Release history and dispatch history shall be queryable per accession. | UI test. | UR-094 |

### 3.9 Reporting & Export

| ID | Requirement | Verification | Trace |
|---|---|---|---|
| SR-080 | `reportPreview` shall render a faithful preview consistent with exported forms. | Snapshot test. | UR-100 |
| SR-081 | `exportEngine` shall emit FHIR bundle, HL7v2-ish, and normalised JSON. | Sample outputs under `docs/acceptance/export-verification/samples/`. | UR-101 |
| SR-082 | Export envelopes shall embed `EXPORT_VERSION`, `BREAKPOINT_VERSION`, `RULE_VERSION`, `BUILD_VERSION`. | Envelope assertion test. | UR-093 |

### 3.10 Zone Reader Integration

| ID | Requirement | Verification | Trace |
|---|---|---|---|
| SR-090 | `exportWorklist` shall emit a flat `ZoneReaderWorklistExport` matching `schemas.ts` with `schemaVersion = "1.0.0"`, `sourceSystem = "MEDUGU_LIMS"`. | Schema test. | UR-060 |
| SR-091 | `discPotency` shall always be a non-empty string; `"unspecified"` is the placeholder when no true potency is mapped. | Unit test. | UR-060 |
| SR-092 | `importMapper` shall match rows on `(isolateId, antibioticCode, method = "disk_diffusion", standard)`. | Unit test cases AMP/PEN/TEC matched; VAN method-mismatch unmatched. | UR-062 |
| SR-093 | Unmatched rows shall include a structured `UnmatchedAlignment` reason from `MISSING_AST_ROW` \| `METHOD_MISMATCH` \| `STANDARD_MISMATCH`. | Unit test. | UR-063, UR-064 |
| SR-094 | The public route `/api/public/zone-reader/result` shall be live for GET, OPTIONS, POST. GET returns endpoint metadata; OPTIONS returns CORS preflight; POST validates bearer token, schema-parses the payload, and returns `202 Accepted` (no server-side persistence in current build). | `publicInboundRoute.test.ts`. | UR-065 |
| SR-095 | The admin Zone Reader page (`/admin/zone-reader`) shall expose: full endpoint URL (built from stable production base URL), bearer token (view/regenerate), production base URL override (HTTPS-origin validated), preview-host warning banner. | UI test. | UR-066, UR-067, UR-113 |
| SR-096 | The production base URL shall be derived in this strict order: (1) admin override in `localStorage` key `medugu.zoneReaderInbound.baseUrl.v1` (validated HTTPS origin); (2) hardcoded `DEFAULT_PRODUCTION_BASE_URL = "https://medugu-microbe-pathways-core.lovable.app"`. `window.location.origin` shall **never** be used to build the endpoint. | Unit test. | UR-067 |
| SR-097 | Preview-host detection (`localhost`/`127.0.0.1`/`*.local`, `*.lovableproject.com`, hostnames containing `id-preview--` or `-preview--`) shall render a destructive `role="alert"` banner: "Preview host detected — do not use this origin for live send". | UI snapshot. | UR-067, UR-134 |

### 3.11 Admin & Configuration

| ID | Requirement | Verification | Trace |
|---|---|---|---|
| SR-100 | `/admin/users` shall manage user accounts and role assignments via server functions guarded by `requireSupabaseAuth` + `has_role('admin')`. | Server-function test. | UR-110 |
| SR-101 | `/admin/receivers` shall manage receivers and per-receiver preferences. | UI test. | UR-111 |
| SR-102 | `/admin/config` shall manage configuration under governance; changes shall be audited. | UI test. | UR-112 |

### 3.12 Audit & Analytics

| ID | Requirement | Verification | Trace |
|---|---|---|---|
| SR-110 | Every store action that mutates clinical state shall emit an audit event via `utils/audit.ts`. | Unit test. | UR-120 |
| SR-111 | The operational dashboard shall compute TAT, AMS SLA, IPC queue depth, blocker rates from the local store (browser phase) and from durable events (Phase 5). | Snapshot test. | UR-121 |
| SR-112 | The benchmark harness shall produce a comparison report per scenario. | Sample under `docs/acceptance/benchmark-pack.md`. | UR-122 |

---

## 4. External Interface Requirements

### 4.1 User interfaces
- TanStack Start file-based routing in `src/routes/`.
- Root layout `src/routes/__root.tsx` provides shell.
- Section navigation via `SectionRail`, `SectionTabs`, `CommandPalette`.
- Admin pages under `/admin/*` (RequireAuth + role gate).
- Tailwind v4 via `src/styles.css` semantic tokens; no raw colour
  classes in components.

### 4.2 Hardware interfaces
- Zone Reader: any device or app that emits the v1 `ZoneResult` schema
  and can POST to `/api/public/zone-reader/result` with bearer auth.

### 4.3 Software interfaces
- **Public inbound**: `POST /api/public/zone-reader/result`
  - Headers: `Authorization: Bearer <token>`, `Content-Type: application/json`.
  - Body: `ZoneReaderResultImport` (see `integrations/zoneReader/types.ts`).
  - Responses: `202 Accepted` on valid; `401` on missing/invalid token;
    `400` on schema failure.
  - GET returns endpoint metadata; OPTIONS handles CORS preflight.
- **Worklist export**: client-side download of `ZoneReaderWorklistExport`
  JSON.
- **Report export**: FHIR Bundle, HL7v2-ish, normalised JSON.

### 4.4 Communications interfaces
- HTTPS only in production. Preview hosts shall not be used for live
  Zone Reader send (enforced by admin warning + hardcoded production
  base URL).

---

## 5. Data Requirements

### 5.1 Persistence
- Browser phase: `localStorage["medugu.v3.state"]`.
- Phase 5: Postgres with RLS; every `CREATE TABLE` in `public` followed
  by `GRANT` statements and `ENABLE ROW LEVEL SECURITY` + policies.

### 5.2 Versioning
- `BUILD_VERSION`, `EXPORT_VERSION`, `BREAKPOINT_VERSION`,
  `RULE_VERSION` are defined in `src/medugu/domain/versions.ts` and
  embedded in every release package and export envelope.

### 5.3 Dictionaries
- Specimen families, organisms, antibiotics, syndromes, IPC rules, AMS
  rules, breakpoint registry (EUCAST 2026 scaffolding;
  `breakpointStatus: "needs_validation"` until official source
  thresholds are cited).

---

## 6. Non-Functional Requirements

### 6.1 Performance
- Initial route TTI ≤ 2.5s on a mid-range laptop on broadband.
- AST engine evaluation ≤ 50ms for an isolate with ≤30 AST rows.
- Report export generation ≤ 200ms per format for a typical accession.

### 6.2 Reliability
- All clinical state shall be recoverable from `localStorage` (browser
  phase) or durable Postgres (Phase 5) after a forced reload.
- Release seals shall be deterministic for identical input (canonical
  JSON).

### 6.3 Security
- No anonymous sign-ups.
- Admin-only routes enforced server-side.
- `client.server.ts` (service-role) shall be `await import()`ed only
  inside handlers; never imported at module scope outside other
  `.server.ts` files.
- Public endpoints shall verify bearer tokens / signatures before any
  processing.
- All input validated via Zod with min/max bounds and format
  constraints.
- Roles in `user_roles`, never on profile.

### 6.4 Usability
- Keyboard navigation across section rail and command palette.
- Destructive admin actions require confirmation.
- Preview environments visually distinct.

### 6.5 Portability
- Domain core has zero React imports — runs unchanged in a Node /
  Worker context.
- Persistence adapter is swappable (`store/persistence.ts`).

### 6.6 Maintainability
- Layering enforced: `domain` / `config` / `logic` / `store` (core)
  never import from `ui`.
- Engines are pure functions over plain data; no hidden globals.
- Modularity boundary audit lives at
  `docs/audits/modularity-boundary-audit-2026-04-25.md`.

### 6.7 Compliance & Auditability
- Every clinical state transition produces an audit event with actor
  identity (Phase 5), timestamp, before/after, and rule version where
  applicable.
- Release packages are hash-sealed and amendable only through chained
  amendments.

### 6.8 Runtime compatibility
- Server runs in Cloudflare Worker (`nodejs_compat`); no
  `child_process`, `sharp`, `puppeteer`, native bindings, or packages
  requiring a full OS filesystem.
- All npm dependencies must be bundleable at build time.

---

## 7. Engineering Constraints (Lovable / TanStack Start)

- Routes live under `src/routes/`; never `src/pages/`.
- `src/routeTree.gen.ts` is generated; edits in this build are limited
  to keeping the registry coherent with new files.
- Server functions: `createServerFn` from `@tanstack/react-start`,
  validated with `.inputValidator()` before `.handler()`.
- Server routes: `createFileRoute` under `src/routes/api/public/*` for
  webhooks and public endpoints.
- Supabase clients: browser client for auth/realtime; admin client only
  inside handlers via dynamic import.

---

## 8. Test & Verification Strategy

- **Unit tests** colocated under `src/medugu/logic/__tests__/` and
  `src/medugu/integrations/zoneReader/__tests__/`.
- **Scenario tests** drive the six acceptance scenarios in
  `docs/acceptance/scenario-matrix.md` and produce sample exports under
  `docs/acceptance/export-verification/samples/`.
- **Round-trip tests** for Zone Reader: 18 cases in `roundTrip.test.ts`
  + 9 cases in `publicInboundRoute.test.ts`.
- **Manual verification** documented in
  `docs/handoff/local-run-and-verification.md`.

---

## 9. Acceptance Criteria

The build is accepted when:
1. All `MUST`-priority `SR-xxx` requirements pass their listed
   verification.
2. Scenario matrix exports match committed samples byte-for-byte
   (modulo timestamps).
3. Zone Reader manual round-trip + live inbound endpoint tests are
   green.
4. No expert-rule violation appears in any released report across the
   scenario matrix.
5. No clinical state is reachable without authentication; no admin
   action is reachable without `admin` role.

---

## 10. Open Issues

| ID | Issue | Owner |
|---|---|---|
| OI-001 | Server-side persistence of Zone Reader POST payloads (currently `202` without persistence). | Engineering, Phase 5 |
| OI-002 | EUCAST 2026 active thresholds — currently scaffold with `breakpointStatus: "needs_validation"`. | Clinical governance |
| OI-003 | MIC-capable instrument contract (scope for Phase 6). | Product |
| OI-004 | Surveillance auto-submission (WHONET/GLASS). | Product |

---

## 11. Traceability Matrix (URD → SRS, abridged)

| URD | SRS |
|---|---|
| UR-001 | SR-001, SR-002 |
| UR-002 | SR-003, SR-004 |
| UR-003 | SR-005, SR-006 |
| UR-020..023 | SR-020..022 |
| UR-040..042 | SR-010 |
| UR-050..056 | SR-030..036 |
| UR-060..067 | SR-090..097 |
| UR-070..074 | SR-040..044 |
| UR-080..084 | SR-050..054 |
| UR-090..094 | SR-060..062, SR-070..072 |
| UR-100..102 | SR-080..082 |
| UR-110..114 | SR-100..102, SR-095 |
| UR-120..122 | SR-110..112 |
| UR-130..134 | §6 Non-functional, SR-097 |
