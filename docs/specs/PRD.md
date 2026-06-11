# Medugu — Product Requirements Document (PRD)

**Document status:** Draft v1.0
**Owner:** Medugu Product
**Last updated:** 2026-06-11
**Applies to build:** `3.0.0-phase1` (browser-phase) and Phase-5 production handoff

---

## 1. Executive Summary

Medugu is a clinical microbiology workflow platform that takes a specimen
from **accession** through **microscopy, isolate identification, antimicrobial
susceptibility testing (AST), antimicrobial stewardship (AMS), infection
prevention & control (IPC), validation, release, and structured export**.
It is designed for laboratories in resource-variable environments where
free-text reporting, inconsistent breakpoints, missing expert rules, and
weak release governance are the dominant safety problems.

The product is opinionated:

- **Coded over free text.** Specimens, organisms, antibiotics, syndromes,
  IPC alert rules and AMS rules are dictionary-driven. Free text is
  display-only and never drives logic.
- **Logic is pure and portable.** AST interpretation, cascade reporting,
  expert rules, AMS, IPC, validation, release, report assembly and
  export are framework-agnostic engines that can run identically in the
  browser today and in a backend service tomorrow.
- **Release is a governed event.** A report is not "saved" — it is
  *released*, sealed, hash-bound, and amendable only through an audited
  amendment chain.
- **Instrument integration is contract-first.** External devices (e.g.
  the Zone Reader) submit measurement payloads against a stable schema;
  Medugu remains the sole authority for S/I/R interpretation, expert
  rules, AMS, IPC, validation, and release.

This PRD captures *what the product is*, *why it exists*, *who it is for*,
*what it must do*, and *what is explicitly out of scope* for the current
phase.

---

## 2. Problem Statement

Microbiology laboratories outside reference centres typically face the
following operational and safety problems:

1. **Free-text result entry** that cannot be aggregated, audited, or
   safely interpreted by rule engines.
2. **Inconsistent breakpoint application** (CLSI vs EUCAST, year drift,
   local exceptions) leading to inconsistent S/I/R calls between shifts.
3. **Missing or inconsistent expert rules** — MRSA suppression of
   β-lactams, ESBL/AmpC/CRE phenotype recognition, inducible clindamycin
   resistance (D-test), enterococcal intrinsic resistance, glycopeptide
   reporting against gram-negatives.
4. **Weak antimicrobial stewardship coupling** — Reserve agents released
   without approval; Watch agents reported without review; no SLA on AMS
   decisions; no audit of who approved what and why.
5. **Weak IPC coupling** — alert organisms (MRSA, VRE, CRE, *C. difficile*,
   *M. tuberculosis*, sterile-site *S. aureus*) not flagged to IPC at
   the moment of detection.
6. **Ungoverned release** — reports edited after the fact with no
   amendment chain, no signing identity, and no hash seal.
7. **No structured export** — receivers cannot consume results as
   FHIR/HL7/JSON; downstream EMR integration is bespoke and fragile.
8. **Instrument data captured by hand** — zone diameters are
   transcribed from photographs or rulers into the LIMS, with
   transcription errors and no provenance.

Medugu addresses each of these directly.

---

## 3. Vision & Product Principles

**Vision.** Every microbiology result released from a Medugu lab is
**coded, rule-checked, stewardship-aware, IPC-aware, validated, signed,
sealed, exportable, and amendable only under audit** — regardless of
whether the lab is a tertiary reference centre or a district hospital.

**Principles.**

1. **Safety over convenience.** A workflow that prevents an unsafe
   release is preferred to one that is faster.
2. **Coded dictionaries are the source of truth.** Free text never
   drives interpretation.
3. **Pure engines.** Logic is testable in isolation, framework-agnostic,
   and portable from browser to backend without rewrite.
4. **Governed release.** Release is a sealed, signed, hash-bound event.
   Amendments are first-class, audited, and chained.
5. **Contract-first integration.** External systems (instruments, EMRs,
   national surveillance) integrate against versioned schemas, not
   against the UI.
6. **Local-first, sync-aware.** The browser-phase build must remain
   usable when offline; the production phase must add durable storage
   and multi-actor governance without changing the engines.
7. **No silent automation in clinical decisions.** Engines may suggest,
   suppress, cascade, or block — but every decision is traceable to a
   coded rule with a version pin.

---

## 4. Target Users & Personas

| Persona | Role | Primary Medugu surfaces |
|---|---|---|
| **Lab Technologist** | Accessions specimens, enters microscopy, sets up cultures, enters raw AST | Patient, Specimen, Microscopy, Isolate, AST sections |
| **Microbiologist** | Reviews interpretation, accepts/overrides expert rules, requests AMS approval | AST, AMS, IPC, Validation sections |
| **Consultant Microbiologist** | Signs release, signs amendments, owns final interpretation | Validation, Release, Report sections |
| **AMS Pharmacist** | Reviews approval requests for Watch/Reserve agents, decides within SLA | AMS approval queue |
| **IPC Officer** | Reviews IPC alerts (MRSA, VRE, CRE, *C. difficile*, *M. tuberculosis*, sterile-site flags), runs episode investigations | IPC section, IPC episode drawer |
| **Lab Manager / Admin** | Manages users, roles, receivers, dictionaries, breakpoint versions, integration tokens | Admin pages (`/admin/*`) |
| **External instrument operator** | Operates Zone Reader; imports worklist, exports ZoneResult | Out-of-app; integrates via `/api/public/zone-reader/result` |
| **External system (EMR, surveillance)** | Consumes released reports as FHIR/HL7/JSON | Export Section + downstream pipelines |

---

## 5. Scope

### 5.1 In scope (current build)

- Accession lifecycle: patient → specimen → microscopy → isolate(s) → AST
  → AMS → IPC → validation → release → report → export.
- Coded dictionaries: specimen families/subtypes, organisms, antibiotics,
  syndromes, IPC rules, AMS rules, breakpoint registries
  (EUCAST 2026 scaffolding, CLSI legacy stubs).
- Pure logic engines: specimen resolver, AST engine, cascade engine,
  expert rules (MRSA, MSSA, ICR, ESBL, AmpC, CRE, VRE, intrinsic
  resistance, unusual antibiograms), stewardship engine, IPC engine,
  workflow engine, validation engine, release engine, report builder,
  exporter, analytics engine, microbiology history engine.
- Governed release: release seal, amendment chain, consultant approval
  identity, hash binding.
- Structured export: FHIR bundle, HL7v2-ish, normalised JSON; sample
  outputs committed under `docs/acceptance/export-verification/samples/`.
- Zone Reader integration v1: LIMS Worklist export, ZoneResult import,
  strict row matching by `(isolateId, antibioticCode, method, standard)`,
  manual round-trip proven, live inbound endpoint
  `/api/public/zone-reader/result` proven for auth + CORS + parsing.
- Admin surfaces: users & roles, receivers, configuration, Zone Reader
  inbound configuration (production base URL hardening, bearer token
  management, preview-host warning).
- Authentication & roles (Lovable Cloud): admin-only routes, per-tenant
  data, no anonymous sign-ups.

### 5.2 Out of scope (current build)

- Bidirectional sync with Zone Reader; polling; sockets; webhooks from
  Medugu *to* the device; remote device control.
- Server-side persistence of Zone Reader POST payloads. The live POST
  endpoint currently returns `202 Accepted` and the actual AST update
  is still performed through the manual import path
  (`ZoneReaderPanel.tsx`).
- Native mobile clients.
- Direct LIS/HIS integration adapters (Beaker, Epic, Cerner, OpenMRS) —
  the export contract is stable; adapters are deferred.
- National surveillance auto-submission (e.g. WHONET, GLASS).
- Billing, inventory, reagent lot tracking.
- Direct instrument control (incubators, MALDI-TOF, automated AST
  panels other than Zone Reader).

### 5.3 Non-goals

- Medugu is not an EMR.
- Medugu is not a billing system.
- Medugu does not replace consultant judgement; it constrains and
  audits it.

---

## 6. Product Pillars & Capabilities

### 6.1 Coded clinical model
Specimen families and subtypes, organism catalog (genus/species/gram/
group), antibiotic catalog (class/route/code/AWaRe), syndrome catalog,
breakpoint registry with version pinning (`EUCAST-2024`, EUCAST 2026
scaffolding), IPC alert rules, AMS rules with governance.

### 6.2 Workflow engine
Stage gating between Patient → Specimen → Microscopy → Isolate → AST →
Stewardship → IPC → Validation → Release. Required-field enforcement
per stage. Phone-out recording. Consultant approval gating.

### 6.3 AST & expert rules
Disk diffusion and MIC entry, breakpoint application from registry,
phenotype detection (MRSA, MSSA, ICR, ESBL, AmpC, CRE, VRE, intrinsic
resistance, unusual antibiogram), cascade reporting (selective release of
antibiotic results), consultant override with audit.

### 6.4 Stewardship (AMS)
AWaRe categorisation, formulary review, Watch/Reserve approval queue,
SLA timers, denial reasons, escalation, expiry, governance over which
rules fire and why.

### 6.5 Infection prevention (IPC)
Alert organism detection, transmission-based flagging, episode
detection, queue management, local watch list, colonisation tracking,
report governance.

### 6.6 Validation & release
Pre-release validation rules, release gating, release seal (hash-bound,
signed by consultant identity), amendment chain with reason codes,
release history, dispatch history.

### 6.7 Export & interoperability
FHIR bundle, HL7v2-ish message, normalised JSON. Stable export schema
version. Sample outputs verified for every acceptance scenario.

### 6.8 Instrument integration
Zone Reader contract v1 — worklist export, ZoneResult import. Strict
row matching. Public inbound endpoint with bearer auth, CORS, and
parsing proven. Production-host hardening for operator-facing URLs.

### 6.9 Analytics & audit
Operational dashboard, benchmark harness, microbiology history per
patient, audit events for every state transition and every consultant
override.

### 6.10 Admin & configuration
User & role management (server-side, role table is separate from
profiles), receiver management, configuration management, Zone Reader
inbound configuration with admin-only token control.

---

## 7. User Journeys

### 7.1 "Accession to release" (happy path)
1. Lab tech creates accession; selects patient, specimen family/subtype.
2. Microscopy entered (Gram stain, cell counts, organisms seen).
3. Isolate(s) created from culture growth.
4. AST entered as raw zone diameters / MICs against a coded panel.
5. AST engine interprets raw values via the breakpoint registry.
6. Expert rule engine fires phenotype detection (e.g. MRSA → suppress
   β-lactams), cascade engine selects which results to release.
7. AMS engine flags Watch/Reserve agents requiring approval.
8. AMS pharmacist approves/denies within SLA.
9. IPC engine fires alert (e.g. MRSA blood) → IPC officer reviews.
10. Microbiologist runs pre-release validation; resolves blockers.
11. Consultant signs release; report is sealed and hashed.
12. Report is dispatched; export produced as FHIR/HL7/JSON.

### 7.2 "Zone Reader round-trip" (manual, proven)
1. Medugu exports LIMS Worklist JSON for the isolate's AST panel.
2. Zone Reader imports the worklist, drives plate measurement.
3. Zone Reader exports a ZoneResult JSON.
4. Microbiologist imports ZoneResult into Medugu via the AST section.
5. Importer matches rows strictly on
   `(isolateId, antibioticCode, method = disk_diffusion, standard)`.
6. Matched rows update raw zone diameters; engines re-run.
7. Unmatched rows are reported with structured reasons
   (`MISSING_AST_ROW`, `METHOD_MISMATCH`, `STANDARD_MISMATCH`) — these
   are expected non-matches, not defects (e.g. an MIC row will never
   match a disk_diffusion ZoneResult).

### 7.3 "Amendment after release"
1. Released report identified as incorrect.
2. Consultant opens amendment panel; selects reason code.
3. New report version created, hash-bound to previous, fully audited.
4. Receivers notified per receiver preferences; dispatch history updated.

### 7.4 "Admin sets up Zone Reader live send"
1. Admin opens `/admin/zone-reader`.
2. Confirms or overrides the production base URL (HTTPS origin only).
3. Generates/copies the bearer token.
4. Configures Zone Reader to POST to
   `https://medugu-microbe-pathways-core.lovable.app/api/public/zone-reader/result`
   with `Authorization: Bearer <token>`.
5. Preview hosts display a destructive-styled warning banner; admin
   must not use preview URLs for live send.

---

## 8. Success Metrics

### Safety
- **Zero releases** that violate a coded expert rule.
- **Zero releases** of Reserve agents without recorded AMS approval.
- **100% of MRSA / VRE / CRE / sterile-site flags** raised to IPC at
  time of detection.

### Workflow
- Median accession → release time tracked per syndrome.
- AMS SLA adherence (% approvals within SLA).
- IPC alert acknowledgement time.

### Data quality
- 100% of released reports include coded organism, coded antibiotics,
  pinned breakpoint version, pinned rule version, signing identity.
- 100% of released reports produce a valid FHIR bundle and HL7 message.

### Integration
- Zone Reader: % of measurement rows matched on first import (target ≥
  the proportion of disk_diffusion rows in the worklist).
- Zone Reader: 0 mis-attributions (matching is strict by definition).

---

## 9. Constraints

- **Browser-phase build is single-user, local-first**, persisted to
  `localStorage` under `medugu.v3.state`.
- **Production phase** introduces durable storage, RLS, server-side
  engines, and multi-actor governance — *without changing the engines
  themselves*.
- **Cloudflare Worker runtime** for server functions and SSR; no Node
  built-ins that require a full process (no `child_process`, `sharp`,
  `puppeteer`, native bindings).
- **Lovable Cloud** is the backend; the Supabase brand is never exposed
  to users.
- **No anonymous sign-ups**; admin-only routes are enforced
  server-side via `requireSupabaseAuth` + role check (`has_role`).
- **Roles live in a separate `user_roles` table**, never on the profile
  row — privilege-escalation risk.

---

## 10. Dependencies

- Lovable Cloud (Postgres + auth + storage + edge runtime).
- Lovable AI Gateway for triage and assist surfaces.
- Zone Reader v1 contract (`docs/integrations/zone-reader-contract-v1.md`).
- EUCAST and CLSI source tables (committed as scaffolds; thresholds are
  marked `needs_validation` until official tables are cited).

---

## 11. Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Breakpoint drift between standards/years | Pinned `BREAKPOINT_VERSION`; registry rows carry `breakpointStatus`; release embeds the version. |
| Expert rule omission | Rule engine fires from coded inputs only; every release embeds `RULE_VERSION`; unusual-antibiogram heuristic flags implausible combinations. |
| Operator uses preview URL for Zone Reader live send | Admin page detects preview hosts and shows a destructive-styled warning; endpoint URL is built from a hardcoded production base, never from `window.location.origin`. |
| Privilege escalation via client-side role flag | Roles stored in `user_roles` table; `has_role` SECURITY DEFINER function; server-side enforcement on every privileged server function. |
| Free-text leakage into logic | Engines key off coded fields only; free text is display-only. |
| Release tampering | Release is hash-sealed; amendments are chained and audited. |
| Instrument transcription error | Zone Reader integration eliminates transcription for disk_diffusion rows; MIC rows remain manual until an MIC-capable instrument contract is added. |

---

## 12. Release Plan (phased)

- **Phase 1 (current).** Browser-phase build; manual Zone Reader
  round-trip proven; live inbound endpoint proven for
  auth/CORS/parsing; admin URL hardening complete.
- **Phase 5 (production handoff).** Modular monolith backend; shared
  domain package; durable Postgres with RLS; server-side engines; OIDC
  identity; multi-actor governance; durable audit log.
- **Future.** EMR adapter pack; surveillance auto-submission;
  MIC-capable instrument contract; native mobile field client.

---

## 13. Open Questions

1. Which AMS denial reason taxonomy is canonical across tenants?
2. Which IPC episode close-out criteria are mandatory vs tenant-tunable?
3. Which export profile (FHIR vs HL7v2 vs JSON) is the receiver default
   per tenant?
4. When does MIC-capable instrument integration enter scope?
