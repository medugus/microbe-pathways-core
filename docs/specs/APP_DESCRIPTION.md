# Medugu — Full Application Description

**Document status:** v1.0
**Last updated:** 2026-06-11
**Build:** `3.0.0-phase1` (browser-phase) with Phase-5 production architecture handoff
**Companion documents:** `PRD.md`, `URD.md`, `SRS.md`, `architecture/phase-5-handoff.md`

---

## 1. What Medugu Is

**Medugu is a clinical microbiology workflow platform** that takes a
patient specimen from the moment it arrives at the bench through to a
**sealed, signed, hash-bound, exportable report** — and keeps every
clinical decision along the way **coded, rule-checked, governed, and
auditable**.

It is a **Laboratory Information Management System (LIMS) for
microbiology specifically** — not a general LIS, not an EMR, not a
billing system. It is opinionated about how microbiology should be
practised: coded dictionaries over free text, pure engines over
spreadsheet logic, governed release over "save", and contract-first
integration over screen scraping.

The product is built for laboratories where the dominant safety
problems are **inconsistent breakpoints, missing expert rules, weak
stewardship coupling, weak infection-prevention coupling, ungoverned
release, and untraceable amendments** — typically district and
tertiary labs outside large reference centres, but equally applicable
to any lab that wants its microbiology results to be defensible end to
end.

---

## 2. The Problem Medugu Solves

A typical microbiology result, in many labs today, is the product of:

- A free-text specimen description that no engine can interpret.
- An organism name typed into a comment field.
- A zone diameter measured by ruler, transcribed by hand.
- An S/I/R call made by recall, sometimes against last year's
  breakpoints.
- A Reserve antibiotic released without anyone in stewardship knowing.
- An MRSA or CRE that reached IPC days after the consultant saw it.
- A report saved, then "corrected" in place, with no version trail.
- A downstream EMR that ingests this as a PDF blob.

Each of these is a safety failure. Medugu's job is to make each one
impossible, or — where it must still be possible (e.g. a consultant
override) — to make it **coded, justified, versioned, and auditable**.

---

## 3. Core Beliefs (Product Principles)

1. **Coded over free text.** Specimens, organisms, antibiotics,
   syndromes, IPC alert rules, AMS rules, and breakpoints are
   dictionary-driven. Free text is display-only and never drives
   logic.
2. **Pure engines.** Every clinical rule lives in a framework-agnostic
   engine (`astEngine`, `cascadeEngine`, `stewardshipEngine`,
   `ipcEngine`, `validationEngine`, `releaseEngine`, `reportPreview`,
   `exportEngine`). They are testable in isolation and portable from
   browser to backend without rewrite.
3. **Governed release.** A report is not "saved" — it is *released*.
   Release is a sealed event, signed by a consultant identity,
   hash-bound, and amendable only through an audited chain.
4. **Contract-first integration.** External systems (instruments,
   EMRs, surveillance) integrate against versioned schemas, not the
   UI. The Zone Reader integration is the first proof of this model.
5. **Local-first, sync-aware.** The browser-phase build is fully
   usable in a single browser profile, persisted to `localStorage`.
   The production phase adds durable Postgres and multi-actor
   governance **without changing the engines**.
6. **Safety over convenience.** A workflow that prevents an unsafe
   release is preferred to one that is faster.
7. **No silent automation in clinical decisions.** Engines may
   suggest, suppress, cascade, or block — but every decision is
   traceable to a coded rule with a version pin
   (`BREAKPOINT_VERSION`, `RULE_VERSION`, `EXPORT_VERSION`,
   `BUILD_VERSION`).

---

## 4. Who Uses Medugu

| User | What they do in Medugu |
|---|---|
| **Lab Technologist** | Accessions specimens, enters microscopy, sets up cultures, captures raw AST (zone diameters / MICs), runs the blood-bottle workflow. |
| **Microbiologist** | Reviews interpretation, accepts or overrides expert-rule outputs, requests AMS approvals, runs pre-release validation, drives Zone Reader import. |
| **Consultant Microbiologist** | Owns final interpretation; signs release; signs amendments; holds the signing identity that seals the report. |
| **AMS Pharmacist** | Reviews Watch/Reserve approval requests within SLA; approves, denies (with coded reason), or escalates. |
| **IPC Officer** | Receives alert-organism flags at detection time (MRSA, VRE, CRE, *C. difficile*, *M. tuberculosis*, sterile-site *S. aureus*); manages IPC episodes; runs the local watch list; tracks colonisation vs infection. |
| **Lab Manager / Admin** | Manages users and roles, receivers, configuration, dictionaries, breakpoint versions, integration tokens, Zone Reader inbound configuration. |
| **Zone Reader Operator** | Operates the Zone Reader device or app; imports a worklist from Medugu, exports a ZoneResult back. |
| **External Receiver System** | EMR, downstream LIS, surveillance — consumes released reports as FHIR Bundle, HL7v2-ish, or normalised JSON. |

---

## 5. The Workflow, End to End

Medugu organises every case as an **Accession** that moves through
eleven sections. Each section is a coded surface; transitions are gated
by the workflow engine.

```text
Patient → Specimen → Microscopy → Isolate → AST → Stewardship → IPC →
Validation → Release → Report → Export
```

### 5.1 Patient
Coded patient identity, age, sex, ward, clinician, clinical syndrome.
Paediatric flags drive paediatric blood-volume guidance for blood
cultures.

### 5.2 Specimen
Coded specimen family + subtype (no free-text labels in logic). The
specimen resolver computes the workflow profile: which sections are
required, whether the site is sterile, whether the blood-bottle branch
applies.

### 5.3 Microscopy
Gram stain category, cell counts, organisms-seen — all coded. Feeds
validation (e.g. "no organisms seen" can gate a premature release).

### 5.4 Isolate
One or more isolates per accession; each carries a coded
`organismCode`, gram class, organism group, and a stable `isolateId`.
Microbiology history for the patient surfaces here.

### 5.5 AST (Antimicrobial Susceptibility Testing)
Disk diffusion (zone diameter in mm) and MIC entry. Each AST row is
keyed by `(isolateId, antibioticCode, method, standard)` where standard
is `EUCAST` / `CLSI` / `LOCAL`.

The AST engine then runs three layers:

1. **Raw interpretation** from the pinned breakpoint registry.
2. **Expert rules** (phenotype detection):
   - **MRSA** (FOX/OXA R) → suppress all β-lactams except anti-MRSA
     agents; emit `MRSA` flag.
   - **MSSA** (FOX S) → β-lactam preference.
   - **Inducible clindamycin resistance** (ERY R + CLI S) →
     suppress CLI to R.
   - **ESBL** suspicion (3rd-gen ceph R, carbapenem S) → suppress
     penicillins/cephalosporins.
   - **AmpC** suspicion (CRO R, FEP S).
   - **CRE / carbapenemase suspicion** (MEM/ETP R) → IPC alert.
   - **VRE / VSE** (VAN R) → IPC alert + stewardship redirection.
   - **Enterococcal intrinsic** cephalosporin resistance → suppress.
   - **Non-fermenter carbapenem-R** → IPC alert.
   - **Unusual antibiogram** heuristic (e.g. glycopeptide S on
     gram-negative) → flag for verification.
3. **Cascade**: which results are released vs suppressed under the
   tenant's selective-reporting policy.

A consultant may override any final interpretation with a recorded
reason. Overrides are first-class and audited.

### 5.6 Stewardship (AMS)
The AMS engine classifies each released antibiotic as **Access /
Watch / Reserve** (AWaRe) and against the local formulary. Watch and
Reserve agents create approval requests with an SLA timer, escalation
path, denial reason taxonomy, and expiry. **Reserve agents cannot be
released without recorded approval.** AMS rule governance pins
`RULE_VERSION` and records which rules fired per decision.

### 5.7 IPC (Infection Prevention & Control)
The IPC engine fires alerts **at detection time, not at release**:
MRSA, VRE, CRE, *C. difficile*, *M. tuberculosis*, sterile-site
*S. aureus*. IPC officers manage episodes (open → investigation →
closed) with audit, watch a local list of regional concern organisms,
and track colonisation distinctly from infection.

### 5.8 Validation
Pre-release validation produces blockers, warnings, and infos with
stable codes. Blockers include: unresolved AMS approval on a Reserve
agent, missing IPC acknowledgement on an alert organism, unusual
antibiogram pending verification, incomplete microscopy on a sterile
site, signing identity missing.

### 5.9 Release
Release is the **governed event**. It requires a consultant identity
and produces a `ReleasePackage` containing:

- The canonical JSON representation of the report (deterministic via
  `utils/canonicalJson.ts`).
- A **SHA-256 release seal** over that canonical form.
- The signing identity.
- Pinned versions: `BUILD_VERSION`, `EXPORT_VERSION`,
  `BREAKPOINT_VERSION`, `RULE_VERSION`.

After release, the report is **amendable only through a chained
amendment** with a coded reason; each amendment is a new sealed
version linked by `previousReleaseHash`.

### 5.10 Report
The report preview is a faithful representation of what receivers see.
Release history and dispatch history are visible per accession.

### 5.11 Export
Three formats, all driven by the same canonical model:

- **FHIR Bundle** (e.g. `MRSA_BSI.fhir.json`)
- **HL7v2-ish** message (e.g. `ESBL_UTI.hl7`)
- **Normalised JSON** (e.g. `CSF_CONSULTANT.normalised.json`)

Every export envelope embeds the pinned versions. Sample outputs for
each acceptance scenario are committed under
`docs/acceptance/export-verification/samples/`.

---

## 6. Instrument Integration — Zone Reader v1

Medugu's first instrument contract is the **Zone Reader** — any
device or app that measures disk-diffusion zone diameters and emits a
v1 `ZoneResult` payload.

### 6.1 The contract (one direction at a time)

**Worklist export** — Medugu emits a flat `ZoneReaderWorklistExport`
JSON containing:
- `schemaVersion: "1.0.0"`, `sourceSystem: "MEDUGU_LIMS"`.
- `accessionId`, `accessionNumber`, `isolateId`, `astPanelId`,
  `astPanelName`, `standard` (EUCAST / CLSI / LOCAL).
- `expectedDiscs[]` with `antibioticCode`, `discPotency` (never empty
  — placeholder `"unspecified"` when no real potency mapping exists),
  AWaRe category, reportability default.

**ZoneResult import** — Zone Reader returns a `ZoneReaderResultImport`
JSON containing per-antibiotic `zoneDiameterMm`, reader confidence,
measurement source (auto / manual / imported), optional image
reference, optional manual edit and override reason.

### 6.2 Strict row matching
The importer matches strictly on
`(isolateId, antibioticCode, method = "disk_diffusion", standard)`.
Unmatched rows surface a structured reason:

- `MISSING_AST_ROW` — Zone Reader returned a result for an antibiotic
  Medugu didn't ask about.
- `METHOD_MISMATCH` — Medugu's row for that antibiotic is MIC, not
  disk diffusion. **This is an expected non-match, not a defect.**
- `STANDARD_MISMATCH` — Medugu's row uses a different breakpoint
  standard than the ZoneResult declares.

### 6.3 Live inbound endpoint
`POST /api/public/zone-reader/result` is **live** with bearer
authentication, CORS preflight, and schema validation. GET returns
endpoint metadata; OPTIONS handles preflight; POST returns
`202 Accepted` on valid payloads. **Server-side persistence of POST
payloads is not enabled in the current build** — the live endpoint
proves auth + CORS + parsing; the actual AST update is still performed
through the manual import path in `ZoneReaderPanel.tsx`.

### 6.4 Ownership boundary
- **Zone Reader owns** measurement capture and export.
- **Medugu owns** interpretation (S/I/R), expert rules, cascade, AMS,
  IPC, validation, release, and the report content.

The Zone Reader never decides categorical results; Medugu never
asks the Zone Reader to suppress, escalate, or release anything.

### 6.5 Admin hardening
- `/admin/zone-reader` exposes: the full inbound endpoint URL, the
  bearer token (view/regenerate), the production base URL override,
  and a preview-host warning banner.
- The endpoint URL is built from a stable **production base URL** in
  this strict order: (1) admin override stored in `localStorage` key
  `medugu.zoneReaderInbound.baseUrl.v1` (validated HTTPS origin only —
  path/query/hash discarded); (2) deployment variable
  `VITE_MEDUGU_PUBLIC_BASE_URL`; (3) visible fallback
  `https://lims.example.com` until the real production URL is configured.
  **`window.location.origin` is never used to build the endpoint** —
  only to detect a preview host for the warning banner.
- Preview-host detection (`localhost`, `127.0.0.1`, `*.local`,
  hostnames containing `id-preview--`, `preview--`, or `-preview--`)
  renders a destructive-styled `role="alert"` banner:
  **"Preview host detected — do not use this origin for live send."**

---

## 7. Architecture

### 7.1 Layering

```text
┌──────────────────────────────────────────────┐
│  React client (Vite + TanStack Start)        │
│   - src/routes/ (file-based routing)         │
│   - src/medugu/ui/ (sections, shell)         │
│   - src/medugu/store/useAccessionStore.ts    │
│     (the only React binding for the store)   │
└──────────────┬───────────────────────────────┘
               │  pure imports, no React
┌──────────────▼───────────────────────────────┐
│  Domain core (framework-agnostic)            │
│   - domain/  types, ids, enums, versions     │
│   - config/  dictionaries, breakpoints       │
│   - logic/   AST, cascade, AMS, IPC,         │
│              validation, release, export,    │
│              analytics, history              │
│   - store/   accessionStore (zustand-like)   │
│   - utils/   audit, canonical JSON           │
└──────────────┬───────────────────────────────┘
               │  persistence adapter
┌──────────────▼───────────────────────────────┐
│  Persistence                                  │
│   Browser phase: localStorage                 │
│     key = "medugu.v3.state"                   │
│   Phase 5: Postgres + RLS                     │
└───────────────────────────────────────────────┘

┌──────────────────────────────────────────────┐
│  Server (TanStack Start, Cloudflare Worker)  │
│   - createServerFn for app RPC               │
│   - /api/public/* for webhooks & inbound     │
│   - requireSupabaseAuth middleware           │
│   - attachSupabaseAuth function middleware   │
└──────────────────────────────────────────────┘
```

### 7.2 The layering rule (enforced)
- `domain/`, `config/`, `logic/`, `utils/`, and the core of `store/`
  have **zero React imports**.
- `store/useAccessionStore.ts` is the **only** React binding for the
  store.
- `ui/` consumes store + logic; it **never inlines business rules**.
- Free-text fields are display-only; logic keys off coded fields
  (`specimenFamily`, `specimenSubtype`, `organismCode`,
  `antibioticCode`, `ruleCode`).

### 7.3 Production handoff (Phase 5)
The same domain core becomes a **shared domain package** consumed by
both the React client and a backend modular monolith with 12 modules:
identity & access, clinical case, specimen resolution, AST, AMS, IPC,
workflow & validation, reporting & release, export & interoperability,
configuration, analytics, audit & versioning. Inter-service contracts
are the existing schemas — changing them requires a schema version
bump and a migration path.

---

## 8. The Tech Stack

- **Frontend:** React 19, Vite 7, TanStack Start v1 (file-based
  routing under `src/routes/`), TanStack Query, TanStack Router,
  Tailwind v4 (via `src/styles.css` with semantic tokens — no raw
  colour classes in components).
- **UI primitives:** shadcn/ui components under `src/components/ui/`.
- **Backend:** Supabase (Postgres + Auth + RLS + storage) with
  Cloudflare Workers hosting the TanStack Start runtime. Server functions via `createServerFn` from
  `@tanstack/react-start`; webhooks and inbound endpoints via
  `createFileRoute` under `src/routes/api/public/*`.
- **Runtime:** Cloudflare Worker (`nodejs_compat`). No
  `child_process`, `sharp`, `puppeteer`, or native bindings.
- **Auth:** email/password + Google OAuth. No anonymous sign-ups.
  Roles in a separate `user_roles` table; `has_role(uuid, app_role)`
  is a SECURITY DEFINER function. Tables in `public` always have
  explicit `GRANT`s and RLS policies.
- **State:** zustand-style `accessionStore`, JSON-serialisable,
  persisted to `localStorage["medugu.v3.state"]` in the browser
  phase.

---

## 9. The Codebase, at a Glance

```
src/
├── auth/                # Auth context, RequireAuth, role catalog,
│                        # session bar, admin server functions
├── components/ui/       # shadcn primitives
├── integrations/
│   └── supabase/        # Auto-generated; do not edit client.ts /
│                        # client.server.ts / types.ts
├── medugu/
│   ├── ai/              # AI assist + triage server functions
│   ├── config/          # Coded dictionaries + breakpoint registry
│   │   ├── breakpointRegistry/eucast2026/  # EUCAST 2026 scaffolding
│   │   ├── antibiotics.ts
│   │   ├── organisms.ts
│   │   ├── specimenFamilies.ts
│   │   ├── ipcRules.ts
│   │   ├── stewardshipRules.ts
│   │   └── ...
│   ├── domain/          # types, ids, enums, versions
│   ├── fixtures/        # IPC acceptance cases, etc.
│   ├── integrations/
│   │   └── zoneReader/  # types, schemas, importMapper,
│   │                    # exportWorklist, validateImport, settings,
│   │                    # auditEvents, tests
│   ├── logic/           # Engines (pure, no React)
│   │   ├── astEngine.ts
│   │   ├── cascadeEngine.ts
│   │   ├── stewardshipEngine.ts
│   │   ├── ipcEngine.ts
│   │   ├── ipcQueue.ts
│   │   ├── ipcLocalWatch.ts
│   │   ├── ipcColonisation.ts
│   │   ├── validationEngine.ts
│   │   ├── workflowEngine.ts
│   │   ├── releaseEngine.ts
│   │   ├── reportPreview.ts
│   │   ├── exportEngine.ts
│   │   ├── analyticsEngine.ts
│   │   ├── microHistoryEngine.ts
│   │   ├── benchmarkHarness.ts
│   │   └── ...
│   ├── seed/            # Seeded demo accessions
│   ├── store/           # accessionStore, persistence, cloud sync,
│   │                    # configStore, server functions (dispatch,
│   │                    # engines, export, release), inbound config
│   ├── ui/              # AppShell, CaseManager, ContextBar,
│   │                    # SectionRail, NewAccessionDialog,
│   │                    # CommandPalette, sections/*
│   └── utils/           # canonical JSON, audit helpers, export helpers
├── routes/              # File-based TanStack routes
│   ├── __root.tsx       # Root layout; do not replace
│   ├── index.tsx        # Home
│   ├── login.tsx, signup.tsx, forgot-password.tsx, reset-password.tsx
│   ├── ams.tsx, ipc.tsx, analytics.tsx, audit.tsx
│   ├── admin.users.tsx, admin.receivers.tsx,
│   │ admin.config.tsx, admin.zone-reader.tsx
│   └── api.public.zone-reader.result.ts  # Public inbound endpoint
├── routeTree.gen.ts     # Auto-generated; do not edit
├── router.tsx
└── styles.css           # Tailwind v4 + semantic design tokens

docs/
├── README.md
├── acceptance/          # Scenario matrix, sample exports, manual /
│                        # live round-trip receipts, hardening receipt
├── architecture/        # Phase 5 handoff + plan
├── audits/              # Modularity boundary audit
├── breakpoints/         # EUCAST 2026 source notes
├── handoff/             # Local run + verification, readiness summary
├── integration-contract/# Zone Result import mapping
├── integrations/        # Zone Reader contract v1
└── specs/               # PRD, URD, SRS, this description
```

---

## 10. Coded Dictionaries (Source of Truth)

- **Specimen families** (`config/specimenFamilies.ts`) — family +
  subtype codes that drive the workflow profile.
- **Organisms** (`config/organisms.ts`) — `organismCode`, genus,
  species, gram class, group (enterobacterales, staphylococcus,
  enterococcus, non_fermenter, …).
- **Antibiotics** (`config/antibiotics.ts`) — `antibioticCode`, class
  (penicillin / cephalosporin / carbapenem / glycopeptide / …), route,
  AWaRe category.
- **Breakpoint registry** (`config/breakpointRegistry/`) — EUCAST 2026
  scaffolding by organism group (enterobacterales, pseudomonas,
  acinetobacter, staphylococcus, enterococcus, streptococcus,
  haemophilus/moraxella). Active thresholds are marked
  `breakpointStatus: "needs_validation"` until official source tables
  are cited.
- **Cascade rules** (`config/cascadeRules/`) — selective-reporting
  policy keyed by organism group.
- **IPC rules** (`config/ipcRules.ts`) — alert-organism + resistance
  triggers.
- **Stewardship rules** (`config/stewardshipRules.ts`) — AMS rules
  per agent / organism / context.
- **Blood culture presets**, **paediatric blood volumes**, **AMS
  denial reasons**, **AMS config** — additional coded dictionaries.

Free text never overrides a dictionary.

---

## 11. Versioning & Governance

Every release embeds four pinned versions from
`src/medugu/domain/versions.ts`:

| Pin | Meaning |
|---|---|
| `BUILD_VERSION = "3.0.0-phase1"` | Application build. |
| `EXPORT_VERSION = "export-1.1.0"` | Export envelope schema. |
| `BREAKPOINT_VERSION = "EUCAST-2024"` | Breakpoint registry in force. |
| `RULE_VERSION` | Rule-set id, version, and `effectiveFrom`. |

Changing any of these is a governed event: the rule registry, the
breakpoint registry, and the export envelope each have governance
docs under `docs/acceptance/`.

---

## 12. Audit & Analytics

- **Audit:** Every store action that mutates clinical state emits an
  audit event via `utils/audit.ts`. In Phase 5 these become durable
  rows in an event-log table; in the browser phase they live in
  state.
- **Analytics:** `analyticsEngine` + `operationalDashboard` compute
  turnaround time, AMS SLA adherence, IPC queue depth, validation
  blocker rates, expert-rule firing counts.
- **Benchmark:** `benchmarkHarness` produces a comparison report per
  scenario (e.g. Beaker vs Medugu baseline template).
- **Microbiology history:** `microHistoryEngine` surfaces prior
  isolates and resistance patterns for the patient at the moment of
  isolate identification.

---

## 13. Security Posture

- No anonymous sign-ups.
- Admin-only routes (`/admin/*`) enforced server-side via
  `requireSupabaseAuth` + `has_role('admin')`.
- Roles in `public.user_roles`, never on the profile row.
- `client.server.ts` (service-role) is **dynamically imported inside
  handlers only**; never at module scope outside other `.server.ts`
  files.
- The public Zone Reader inbound endpoint verifies the bearer token
  before any processing; payloads are Zod-validated with min/max
  bounds.
- All `CREATE TABLE` in `public` is followed by explicit `GRANT`s and
  `ENABLE ROW LEVEL SECURITY` + policies.
- The admin Zone Reader page hardens against preview-host leakage:
  the operator-facing endpoint is built from a hardcoded production
  base URL, never from `window.location.origin`.

---

## 14. Performance Targets

- Initial route TTI ≤ 2.5s on mid-range laptop / broadband.
- AST engine evaluation ≤ 50ms for an isolate with ≤30 AST rows.
- Report export generation ≤ 200ms per format for a typical
  accession.
- Release seal is deterministic for identical input (canonical JSON).

---

## 15. What's Proven Today

| Capability | Status |
|---|---|
| Coded dictionaries (specimens, organisms, antibiotics, syndromes) | ✅ |
| AST engine + expert rules (MRSA, MSSA, ICR, ESBL, AmpC, CRE, VRE, intrinsic, unusual) | ✅ |
| Cascade engine | ✅ |
| Stewardship engine + AMS approval queue + SLA / escalation / expiry | ✅ |
| IPC engine + queue + local watch + colonisation tracking | ✅ |
| Validation engine + blockers | ✅ |
| Release engine + hash seal + amendment chain | ✅ |
| Report preview | ✅ |
| Export (FHIR / HL7v2-ish / normalised JSON) with sample outputs | ✅ |
| Zone Reader contract v1 — worklist export | ✅ |
| Zone Reader contract v1 — ZoneResult import, strict row matching | ✅ |
| Zone Reader manual round-trip (matched rows: AMP, PEN, TEC) | ✅ |
| Zone Reader live inbound endpoint (auth + CORS + parsing, `202 Accepted`) | ✅ |
| Admin URL hardening + preview-host warning | ✅ |
| Auth, roles, admin gating | ✅ |
| Analytics dashboard + benchmark harness | ✅ |

| Capability | Status |
|---|---|
| Server-side persistence of Zone Reader POST payloads | ⏳ Phase 5 |
| EUCAST 2026 active thresholds (currently `needs_validation` scaffold) | ⏳ Clinical governance |
| MIC-capable instrument contract | ⏳ Phase 6 |
| EMR adapter pack (Beaker / Epic / Cerner / OpenMRS) | ⏳ Phase 6 |
| National surveillance auto-submission (WHONET / GLASS) | ⏳ Phase 6 |
| Multi-actor durable governance (OIDC, durable audit log) | ⏳ Phase 5 |

---

## 16. What Medugu Is **Not**

- Not an EMR.
- Not a billing or inventory system.
- Not a reagent / lot-tracking system.
- Not a direct controller for incubators, MALDI-TOF, or automated AST
  panels other than via the Zone Reader contract.
- Not a replacement for consultant judgement — it constrains and
  audits it.
- Not a free-text reporting tool. If a value isn't coded, it cannot
  drive interpretation, stewardship, IPC, validation, or release.

---

## 17. Roadmap

- **Phase 1 (current).** Browser-phase build; manual Zone Reader
  round-trip proven; live inbound endpoint proven for
  auth/CORS/parsing; admin URL hardening complete.
- **Phase 5.** Modular monolith backend; shared domain package;
  durable Postgres with RLS; server-side engines; OIDC identity;
  multi-actor governance; durable audit log; server-side persistence
  of Zone Reader payloads.
- **Phase 6.** EMR adapter pack; national surveillance auto-submission;
  MIC-capable instrument contract; native mobile field client.

---

## 18. One-Paragraph Summary

**Medugu is a coded, governed, contract-first microbiology LIMS.** It
takes a specimen from accession through microscopy, isolate, AST, AMS,
IPC, validation, and release into a sealed, signed, hash-bound report
that exports as FHIR, HL7, or normalised JSON. Every clinical decision
is driven by coded dictionaries and pure engines (AST, cascade,
expert-rule, AMS, IPC, validation, release, export), pinned to
explicit breakpoint and rule versions, and recorded against a signing
identity. Its first instrument contract — Zone Reader v1 — proves the
integration model: external devices submit measurement payloads
against a stable schema, and Medugu remains the sole authority for
interpretation, stewardship, infection prevention, validation, and
release.
