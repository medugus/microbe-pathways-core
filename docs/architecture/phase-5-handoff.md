# Phase 5 — Production Architecture Handoff

This document maps the current browser-phase Medugu build into the first
production architecture. It is deliberately conservative: we keep what is
working, draw clean service/domain boundaries, and only move state across
the network when there is a clear governance reason to do so.

## Guiding principles

1. **Frontend stays React.** No rewrite. The current Vite + TanStack
   Router + React 19 client is the production client.
2. **Logic engines stay pure.** `astEngine`, `stewardshipEngine`,
   `ipcEngine`, `validationEngine`, `workflowEngine`, `releaseEngine`,
   `reportPreview`, `exportEngine`, `specimenResolver`, and the config
   modules are framework-agnostic. They become a **shared domain
   package** consumed by both the React client and the backend services.
3. **Modular monolith first.** Single deployable backend with clear
   module boundaries and an internal contract bus. Microservices only
   if a specific module needs independent scaling, sovereignty, or
   release cadence.
4. **Contract stability.** The `Accession`, `ReleasePackage`, `ASTResult`,
   `StewardshipDecision`, `IPCDecision`, and the export payload schemas
   are the inter-service contract. Changing them requires a schema
   version bump and a migration path.

## High-level shape

```
┌──────────────────────────────────────────────┐
│  React client (current Vite app)             │
│   - UI sections                              │
│   - Section rail / context bar               │
│   - Local cache (TanStack Query)             │
│   - No business logic                        │
└────────────┬─────────────────────────────────┘
             │ HTTPS (REST + JSON or tRPC)
┌────────────▼─────────────────────────────────┐
│  Backend modular monolith                    │
│   ┌────────────────────────────────────────┐ │
│   │ Shared domain package (from src/medugu)│ │
│   │  - engines, configs, types, helpers    │ │
│   └────────────────────────────────────────┘ │
│                                              │
│   Modules:                                   │
│    1. identity & access                      │
│    2. clinical case service                  │
│    3. specimen resolution                    │
│    4. AST interpretation                     │
│    5. stewardship                            │
│    6. IPC                                    │
│    7. workflow & validation                  │
│    8. reporting & release                    │
│    9. export & interoperability              │
│   10. configuration                          │
│   11. analytics                              │
│   12. audit & versioning                     │
└────────────┬─────────────────────────────────┘
             │
   ┌─────────▼──────────┐  ┌─────────────────┐
   │ Postgres (durable) │  │ Object storage  │
   │ row-level security │  │ (release blobs, │
   │ event log table    │  │  exports)       │
   └────────────────────┘  └─────────────────┘
```

## Module / domain boundaries

### 1. Identity & access
**New in Phase 5.** OIDC/OAuth provider integration; user, role, and
session management; consultant approval identities; signing identity for
release/amendment. Issues short-lived JWTs to the client. Owns the
*actor* on every audit event. Roles: lab tech, microbiologist,
consultant, AMS pharmacist, IPC, admin.

### 2. Clinical case service
Owns `Accession` lifecycle persistence. CRUD with optimistic concurrency
(version field). Enforces tenant isolation. Exposes domain events
(`accession.created`, `isolate.added`, `ast.entered`, etc.) consumed by
analytics and audit.

### 3. Specimen resolution
Wraps `specimenResolver` from the current build. Read-only service that
returns the resolved specimen profile for a given family + subtype.
Backed by versioned config; no per-tenant overrides in v1.

### 4. AST interpretation
Wraps `astEngine`. Exposes `evaluateIsolate(isolate, accessionContext)`
and `applyExpertRules(accession)`. Persists `ASTResult` rows with
`governance`, `cascadeDecision`, `phenotypeFlags`, `expertRulesFired`,
and `consultantOverride`. Consultant override requires identity
service + audit emit.

### 5. Stewardship
Wraps `stewardshipEngine` + `stewardshipRules`. Read-only computation
service. Restricted-drug approval workflow promoted to a first-class
record (request → approve/deny by AMS pharmacist) — currently a
placeholder in the browser phase.

### 6. IPC
Wraps `ipcEngine` + `ipcRules`. Adds **cross-accession** rolling-window
queries (currently the browser phase scans the in-memory store). Emits
notification events (the actual delivery — email/pager — is a separate
concern in Phase 6).

### 7. Workflow & validation
Wraps `workflowEngine` + `validationEngine`. Enforces transition gating
server-side; the client cannot bypass `releaseAllowed === false`.

### 8. Reporting & release
Wraps `reportPreview` + `releaseEngine`. Owns the **frozen
ReleasePackage** as an immutable, cryptographically sealed record.
Adds digital signature (signing identity from module 1). Owns
amendments (Phase 5 deliverable).

### 9. Export & interoperability
Wraps `exportEngine` + `exportHelpers`. Server-side generation of
FHIR/HL7/JSON from the frozen `ReleasePackage`, identical bytes to
client-side generation. Adds outbound transport (HTTP push, MLLP, secure
file drop), receiver registry, and delivery audit.

### 10. Configuration
Owns versioned dictionaries: organisms, antibiotics, breakpoints,
specimen families, stewardship rules, IPC rules. Read-only at runtime;
changes go through a config-promotion workflow with version bump and
audit. Current `BUILD_VERSION` / `RULE_VERSION` / `BREAKPOINT_VERSION` /
`EXPORT_VERSION` model is the seed for this.

### 11. Analytics
Read-only projections off the event log: time-on-task, blocker
incidence, IPC alert rates, restricted-drug approval cycle time,
phenotype frequency, scenario benchmark aggregates. Not on the release
critical path.

### 12. Audit & versioning
Append-only `audit_event` table. Every state-changing operation in any
module emits an audit event with `actor`, `action`, `field`,
`oldValue`, `newValue`, `reason`, `at`, `accessionId`, `version`. The
table is the source of truth for governance; all other tables are
projections.

## What stays stable from the current build

- **Domain types** (`src/medugu/domain/types.ts`) — promoted unchanged
  to the shared package; SCHEMA_VERSION continues from 5.
- **All logic engines** — used unchanged on both client (preview) and
  server (authoritative).
- **Config modules** — promoted unchanged; gain a versioned promotion
  workflow.
- **React UI sections** — continue to render the same engine outputs;
  the only change is the data source (HTTP cache instead of
  localStorage).
- **Export payload schemas** — FHIR Bundle, HL7 ORU^R01 segment list,
  normalised JSON top-level keys, all unchanged.
- **Benchmark scenario contract** — `SCENARIO_CATALOGUE` and
  `observeScenario` shape unchanged; benchmarks become a backend
  acceptance test.

## What moves from browser-only to backend-owned

- **Persistence** — `localStorage` → Postgres (per-tenant, RLS).
- **Identity** — placeholder `signedBy: "user-placeholder"` → real
  identity from OIDC.
- **Consultant approval** — placeholder field → identity-bound action
  with signed audit event.
- **Restricted-drug approval** — placeholder visibility flag →
  AMS-pharmacist approval workflow.
- **IPC rolling window** — in-memory same-MRN scan → server-side query
  across all accessions.
- **Release sealing** — JSON object → cryptographically signed
  immutable record in object storage with hash in Postgres.
- **Export delivery** — copy/download → outbound transport with
  receiver registry and delivery audit.
- **Audit trail** — in-memory `accession.audit[]` → append-only
  `audit_event` table.

## What must remain portable and contract-stable

- `Accession`, `Isolate`, `ASTResult`, `ReleasePackage`,
  `StewardshipDecision`, `IPCDecision`, `ValidationResult` shapes.
- The four version pins on every release.
- Visibility contract: `visibleToClinician` decides exposure in
  reports and exports.
- Export schemas (FHIR / HL7 / JSON top-level keys).
- Workflow stage enum and forward-transition map.
- Benchmark scenario catalogue.

Anything outside this list (UI structure, storage technology, transport
protocol, identity provider) is allowed to evolve.

## Recommended implementation order

1. Identity & access + Postgres + RLS.
2. Clinical case service (CRUD + per-tenant).
3. Audit & versioning (so every later module emits events).
4. Workflow & validation + reporting & release (server-authoritative
   release gating).
5. AST + stewardship + IPC (move engines server-side, keep them shared).
6. Export & interoperability (server generation + outbound transport).
7. Configuration promotion workflow.
8. Analytics projections.
9. Amendment flow (Phase 5 functional deliverable on top of the
   architecture).
