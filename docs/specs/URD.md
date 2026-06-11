# Medugu — User Requirements Document (URD)

**Document status:** Draft v1.0
**Owner:** Medugu Product
**Last updated:** 2026-06-11
**Companion to:** `PRD.md`, `SRS.md`

---

## 1. Purpose

This URD captures *what users need the system to do*, in user language,
independent of how it is implemented. Each requirement is uniquely
identified (`UR-xxx`), traceable to a persona, prioritised (MUST /
SHOULD / MAY), and linked downstream to one or more SRS requirements.

---

## 2. User Classes

| Code | User class | Description |
|---|---|---|
| U1 | Lab Technologist | Day-to-day bench operator: accessions, microscopy, plates, raw AST capture. |
| U2 | Microbiologist | Reviews interpretation, manages expert-rule outputs, requests AMS approvals, runs pre-release validation. |
| U3 | Consultant Microbiologist | Owns final interpretation; signs release and amendments. |
| U4 | AMS Pharmacist | Reviews and decides Watch/Reserve antibiotic approval requests within SLA. |
| U5 | IPC Officer | Reviews alert-organism flags, manages IPC episodes, runs local watch list. |
| U6 | Lab Manager / Admin | Manages users, roles, receivers, dictionaries, breakpoint versions, integration tokens. |
| U7 | Instrument Operator (Zone Reader) | Operates the Zone Reader device; imports worklist, exports ZoneResult. |
| U8 | External Receiver System | EMR, surveillance, downstream LIS — consumes released reports as FHIR/HL7/JSON. |

---

## 3. Operating Assumptions

- Users access Medugu via a modern desktop browser (Chromium, Firefox,
  Safari) at ≥1024×768 CSS px.
- The lab uses **coded dictionaries** (organism codes, antibiotic codes,
  specimen families). Where a coded value does not exist, the user
  raises a configuration request — they do not free-text it into logic.
- The lab has a **single tenant** per Medugu deployment (multi-tenant
  isolation is engineered, but each lab operates within one tenant).
- The browser-phase build assumes a **single active user per browser
  profile**; production phase assumes multi-actor with OIDC identity.

---

## 4. User Requirements

### 4.1 Authentication & Access (U1–U6)

| ID | Priority | Requirement |
|---|---|---|
| UR-001 | MUST | Users shall sign in with email/password or Google. Anonymous sign-ups shall not be permitted. |
| UR-002 | MUST | Users shall be assigned one or more roles from a controlled catalog (`lab_tech`, `microbiologist`, `consultant`, `ams_pharmacist`, `ipc_officer`, `admin`). |
| UR-003 | MUST | Admin-only pages (`/admin/*`) shall be inaccessible without the `admin` role; access shall be enforced server-side. |
| UR-004 | MUST | Role changes shall require an admin and shall be recorded in the audit log. |
| UR-005 | SHOULD | Users shall be able to see all roles currently assigned to them from a popover in the session bar. |
| UR-006 | MUST | The system shall never store role information on the user profile row. |

### 4.2 Accession & Patient (U1)

| ID | Priority | Requirement |
|---|---|---|
| UR-010 | MUST | A lab tech shall create a new accession with a unique accession number, patient identifier, and clinical context. |
| UR-011 | MUST | The system shall record collection time, received time, and receiving operator. |
| UR-012 | MUST | The patient section shall capture age, sex, ward, clinician, and clinical syndrome (coded). |
| UR-013 | SHOULD | Paediatric flags shall drive paediatric blood-volume guidance for blood cultures. |

### 4.3 Specimen (U1, U2)

| ID | Priority | Requirement |
|---|---|---|
| UR-020 | MUST | Specimen entry shall require a coded specimen family and subtype; free-text labels are display-only. |
| UR-021 | MUST | The specimen resolver shall derive the workflow profile (which sections are required) from the coded specimen. |
| UR-022 | MUST | Sterile-site specimens shall be flagged as such throughout the workflow (drives IPC and validation). |
| UR-023 | SHOULD | Blood culture specimens shall trigger the blood-bottle workflow (sets, bottles, incubation board). |

### 4.4 Microscopy (U1, U2)

| ID | Priority | Requirement |
|---|---|---|
| UR-030 | MUST | Microscopy shall record Gram stain category, cell counts, and organisms-seen as coded fields. |
| UR-031 | SHOULD | Microscopy findings shall be available to the AST and validation engines (e.g. "no organisms seen" gates premature release). |

### 4.5 Isolate Identification (U1, U2)

| ID | Priority | Requirement |
|---|---|---|
| UR-040 | MUST | Each isolate shall carry a coded organism (`organismCode`), gram class, group, and a stable `isolateId`. |
| UR-041 | MUST | Multiple isolates per accession shall be supported; each carries its own AST. |
| UR-042 | SHOULD | The system shall surface microbiology history for the patient at isolate time. |

### 4.6 AST (U1, U2)

| ID | Priority | Requirement |
|---|---|---|
| UR-050 | MUST | AST entry shall support disk diffusion (zone diameter in mm) and MIC (numeric, with operator). |
| UR-051 | MUST | Each AST row shall carry `isolateId`, `antibioticCode`, `method`, and `standard` (EUCAST / CLSI / LOCAL). |
| UR-052 | MUST | The AST engine shall produce a `rawInterpretation` from the breakpoint registry. |
| UR-053 | MUST | The expert-rule engine shall apply MRSA, MSSA, ICR, ESBL, AmpC, CRE, VRE, intrinsic-resistance, and unusual-antibiogram rules. |
| UR-054 | MUST | The cascade engine shall decide which results are released vs suppressed. |
| UR-055 | MUST | A consultant shall be able to override any interpretation with a recorded reason. |
| UR-056 | SHOULD | Raw values, interpreted SIRs, and final interpretations shall be independently visible in the report preview. |

### 4.7 Zone Reader Integration (U2, U7)

| ID | Priority | Requirement |
|---|---|---|
| UR-060 | MUST | A microbiologist shall export a LIMS Worklist JSON for an isolate's AST panel. |
| UR-061 | MUST | The microbiologist shall import a ZoneResult JSON returned by Zone Reader. |
| UR-062 | MUST | The importer shall match rows strictly on `(isolateId, antibioticCode, method = disk_diffusion, standard)`. |
| UR-063 | MUST | Unmatched rows shall be surfaced with a structured reason (`MISSING_AST_ROW`, `METHOD_MISMATCH`, `STANDARD_MISMATCH`). |
| UR-064 | MUST | Method mismatches (e.g. MIC row vs disk_diffusion ZoneResult) shall be treated as expected non-matches, not defects. |
| UR-065 | MUST | A live inbound endpoint shall accept ZoneResult POSTs with bearer authentication. |
| UR-066 | MUST | The admin shall view and copy the inbound endpoint URL and bearer token from a single admin page. |
| UR-067 | MUST | The admin page shall warn the operator when opened on a preview host and shall show the production endpoint, not the preview origin. |

### 4.8 Stewardship / AMS (U2, U4)

| ID | Priority | Requirement |
|---|---|---|
| UR-070 | MUST | The AMS engine shall flag Watch and Reserve agents per AWaRe and per local formulary. |
| UR-071 | MUST | AMS approval requests shall have an SLA timer with escalation and expiry. |
| UR-072 | MUST | An AMS pharmacist shall approve or deny with a coded reason; decisions shall be audited. |
| UR-073 | MUST | Reserve agents shall not be released without recorded approval. |
| UR-074 | SHOULD | A bug-drug review surface shall summarise current AMS positions for the isolate. |

### 4.9 IPC (U2, U5)

| ID | Priority | Requirement |
|---|---|---|
| UR-080 | MUST | The IPC engine shall fire alerts for MRSA, VRE, CRE, *C. difficile*, *M. tuberculosis*, and sterile-site *S. aureus*. |
| UR-081 | MUST | IPC alerts shall be raised at the moment of detection, not at release. |
| UR-082 | MUST | An IPC officer shall be able to open, investigate, and close IPC episodes with audit. |
| UR-083 | SHOULD | A local watch list shall surface organisms/resistances of regional concern. |
| UR-084 | SHOULD | Colonisation vs infection shall be tracked separately. |

### 4.10 Validation & Release (U2, U3)

| ID | Priority | Requirement |
|---|---|---|
| UR-090 | MUST | Pre-release validation shall block release on coded blockers (e.g. unresolved AMS approval, missing IPC acknowledgement, unusual antibiogram). |
| UR-091 | MUST | Release shall require a consultant identity and shall produce a hash-bound release seal. |
| UR-092 | MUST | Released reports shall be amendable only through an audited amendment chain with reason codes. |
| UR-093 | MUST | Each release shall embed the breakpoint version, rule version, and export version in force. |
| UR-094 | SHOULD | Release history and dispatch history shall be visible per accession. |

### 4.11 Reporting (U2, U3, U8)

| ID | Priority | Requirement |
|---|---|---|
| UR-100 | MUST | The report preview shall be a faithful representation of what receivers will see. |
| UR-101 | MUST | The report shall be exportable as FHIR bundle, HL7v2-ish message, and normalised JSON. |
| UR-102 | MUST | Sample export outputs for each acceptance scenario shall be committed in the repository. |

### 4.12 Admin & Configuration (U6)

| ID | Priority | Requirement |
|---|---|---|
| UR-110 | MUST | Admin shall manage users and roles. |
| UR-111 | MUST | Admin shall manage receivers and their preferences. |
| UR-112 | MUST | Admin shall manage configuration (dictionaries, AMS/IPC rules) under governance. |
| UR-113 | MUST | Admin shall manage Zone Reader inbound configuration: production base URL, bearer token. |
| UR-114 | MUST | The admin Zone Reader page shall display the canonical inbound path `/api/public/zone-reader/result`. |

### 4.13 Audit & Analytics (U2, U3, U5, U6)

| ID | Priority | Requirement |
|---|---|---|
| UR-120 | MUST | Every state transition and every consultant override shall produce an audit event. |
| UR-121 | SHOULD | An operational dashboard shall surface turnaround time, AMS SLA, IPC queue depth, and validation blocker rates. |
| UR-122 | SHOULD | A benchmark harness shall compare current run against a baseline (e.g. Beaker vs Medugu). |

### 4.14 Non-functional, user-facing (all)

| ID | Priority | Requirement |
|---|---|---|
| UR-130 | MUST | The UI shall be usable at ≥1024×768 CSS px. |
| UR-131 | MUST | The UI shall provide keyboard navigation for the section rail and command palette. |
| UR-132 | SHOULD | The UI shall play distinct audio acknowledgements for critical IPC alerts (with mute control). |
| UR-133 | MUST | All destructive admin actions shall require confirmation. |
| UR-134 | MUST | Preview-environment indicators shall be visually distinct from production. |

---

## 5. Traceability (URD → PRD → SRS)

Each UR-xxx requirement maps to at least one PRD pillar (§6 of PRD) and
one SRS requirement (`SR-xxx`) in the SRS. See `SRS.md` §11 for the full
trace matrix.

---

## 6. Acceptance Criteria (high-level)

A release is considered to satisfy the URD when:

1. All MUST requirements pass their corresponding SRS acceptance tests.
2. The six scenarios in `docs/acceptance/scenario-matrix.md` produce
   the committed sample exports byte-for-byte (modulo timestamps).
3. The Zone Reader manual round-trip succeeds for all matched-row paths
   in `docs/acceptance/zone-reader-manual-roundtrip-current.md`.
4. The live inbound endpoint passes `publicInboundRoute.test.ts` for
   all auth, CORS, and parsing cases.
5. No expert-rule violation appears in any released report across the
   acceptance scenario matrix.
