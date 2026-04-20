# Browser-phase limitations

Last refreshed: **2026-04-20**.

This document is the authoritative scope statement for what the current
build is, and — more importantly — what it is not. It is intended to be
read alongside the regression receipt before any production-planning
conversation.

## 1. Single-user / browser persistence

- All clinical state (accessions, isolates, AST rows, IPC episodes, AMS
  approvals, validation status, release packages, configuration drafts)
  is held in a single browser tab plus localStorage and Lovable Cloud
  tables scoped to the signed-in tenant.
- There is **no multi-user conflict resolution**. Concurrent edits across
  tabs or users will last-write-win.
- There is **no offline-first sync engine**. The app assumes the browser
  can talk to Lovable Cloud while in use.
- Schema migrations of locally persisted state are best-effort: a
  forward-incompatible release will silently discard the local cache and
  re-hydrate from the cloud.

## 2. Placeholder identity / actor model

- Auth is real (Supabase), but **role-based action enforcement** lives in
  RLS policies on the cloud tables, not in a centralised authorisation
  service.
- Workflow actor labels (e.g. AMS pharmacist, consultant, IPC) are
  user-supplied free-text in the relevant section forms. There is no
  binding to a credentialed identity at the action site.
- "Acknowledged phone-out", "consultant approved", "AMS approved", "alert
  silenced" are all attributable only to the signed-in user, not to a
  named role-bearer with a verified credential.

## 3. Mock dispatch vs real transport

- The dispatch panel exercises the **server-side build → freeze → POST**
  pipeline, but the receiver list is configured locally per tenant and
  the simulate / retry buttons do **not** reach a production receiver.
- There is no retry queue with exponential back-off, no dead-letter
  handling, no NACK reconciliation, and no end-to-end acknowledgement
  from a downstream HIS/EMR.
- Failures emit an in-app toast and an "urgent" sound cue; they do not
  page anyone.

## 4. Local IPC cohort vs server-backed surveillance

- IPC episode dedup, rolling-window cohorting, and clearance counting
  operate over the accessions visible to the signed-in user in the
  current cloud tenant.
- There is **no cross-tenant** or **cross-facility** surveillance, no
  outbreak-aggregation service, and no scheduled background re-evaluation
  of historical episodes when a rule pack changes.
- Rule packs are versioned but evaluated client-side; a change in
  `ipcRules.ts` only takes effect when the user reloads the app.

## 5. Local config governance vs enterprise config service

- The admin config workspace stores draft, published, and rollback
  versions in browser-scoped storage with a thin cloud audit trail.
- There is **no multi-step approval chain**, no two-person rule, no
  policy engine evaluating proposed config diffs, and no change-control
  ticket integration.
- Promotion / rollback events are local UI actions; they do not notify
  external stakeholders or generate a regulatory artefact.

## 6. Reporting, analytics, and sound

- Analytics dashboards aggregate the locally available accessions only.
- Sound alerts are an accessibility affordance, never the sole signal —
  every condition that plays a sound is also represented by a visible
  chip, banner, or blocker.
- No notification engine, no SMS, no email, no pager.

## 7. Out of scope for this build (explicit)

- Native mobile clients.
- Offline-first operation.
- LIS/HIS integration beyond the mock dispatch surface.
- Production-grade observability (no centralised logging, no SLO
  dashboard, no alerting on engine errors).
- Regulatory documentation pipelines (IFU/SoUP, IEC 62366 usability
  files, IEC 62304 SDLC artefacts).
