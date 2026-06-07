# Acceptance — Zone Reader Live Round-Trip (current build)

Scope: documents the **proven integration path** between Zone Reader and Medugu for
this build. It does not add polling, sockets, bidirectional sync, webhook
signature verification, device control, or background jobs.

## What is proven end to end

The following workflow has been executed and verified:

1. **Medugu exports** a LIMS Worklist JSON (`buildWorklistExport`).
2. **Zone Reader imports** the worklist and drives its measurement plan.
3. **Zone Reader sends** a ZoneResult JSON payload via HTTP POST to the live
   Medugu inbound endpoint.
4. **Medugu authenticates** the request via `Authorization: Bearer <token>`.
5. **Medugu parses and structurally validates** the ZoneResult payload
   (`zoneReaderResultImportSchema`).
6. **Strict row matching** aligns incoming reader rows with existing AST rows
   using the canonical four-part key.
7. **Accepted rows** are written via `meduguActions.updateAST` using **only**
   raw measurement + method fields.
8. **Downstream engines** (interpretation, cascade, AMS, IPC, validation,
   release) recompute automatically because `updateAST` triggers the same
   cascade re-eval path used for manual benchtop entry.

## Exact row-matching rule

A reader row matches an AST row only when **all four** conditions hold:

```
(isolateId, antibioticCode, method = disk_diffusion, standard)
```

- `isolateId` — must match the payload's `isolateId`.
- `antibioticCode` — exact code match (no aliases).
- `method` — the existing AST row **must** already be `DiskDiffusion`.
  MIC / broth / automated rows are **never** auto-converted.
- `standard` — taken from the worklist envelope when present; otherwise from
  the isolate's existing disk-diffusion AST rows.

Unmatched results are classified in the `alignment[]` array:

| Reason | Meaning |
|--------|---------|
| `MISSING_AST_ROW` | No row at all for `(isolate, antibioticCode)` |
| `METHOD_MISMATCH` | A row exists but uses a non-disk method |
| `STANDARD_MISMATCH` | A disk row exists under a different breakpoint standard |

## Expected non-match — method mismatch

A common and **intentional** non-match occurs when an existing AST row uses
`mic_broth` (or any non-disk method) and the incoming reader row declares
`disk_diffusion`. For example, if the isolate already carries a VAN MIC broth
row, the reader's disk-diffusion VAN result will be classified as
`METHOD_MISMATCH` and will **not** be auto-accepted.

This is deliberate: MIC and disk-diffusion represent different methodological
lanes and must not be conflated. If the laboratory wants to accept a zone
diameter for that antibiotic, a disk-diffusion AST row must be added to the
isolate first (the UI exposes a **Create disk-diffusion rows** action). Until
then, `METHOD_MISMATCH` protects the integrity of the existing MIC data.

## Proven ownership boundary

| Concern | Owner | Zone Reader may … | Medugu may … |
|---------|-------|-------------------|--------------|
| Raw zone measurement (mm) | Zone Reader | **Capture, export, send live** | Import, display, audit |
| S/I/R interpretation | Medugu | — | Compute via breakpoint registry + local engines |
| Phenotype / resistance markers | Medugu | — | Compute via expert rules |
| Cascade / selective reporting | Medugu | — | Compute via cascade engine |
| Stewardship (AMS) | Medugu | — | Compute via stewardship engine |
| IPC episode evaluation | Medugu | — | Compute via IPC engine |
| Validation state | Medugu | — | Gate and record |
| Release / report state | Medugu | — | Gate and record |

The importer enforces this boundary at two levels:
1. The `MatchedRow` type carries **only** raw / provenance keys.
2. The UI calls the canonical `updateAST` setter, which never accepts direct
   writes to interpreted or governance fields.

## Live endpoint behaviour

| Aspect | Value |
|---|---|
| Path | `/api/public/zone-reader/result` |
| File | `src/routes/api.public.zone-reader.result.ts` |
| Methods | `OPTIONS`, `GET`, `POST` |
| Auth on `POST` | `Authorization: Bearer <token>` (required) |

- `OPTIONS` → `204 No Content` with CORS headers.
- `GET` → `200 OK` JSON liveness probe (no payload accepted).
- `POST` with valid bearer token + `application/json` body → `202 Accepted`.
- Missing / malformed `Authorization` → `401` with explicit JSON error.
- Invalid token → `403` with explicit JSON error.
- Non-JSON body → `415` or `400` with explicit JSON error.

## Admin setup requirements

1. **Stable public endpoint required.** Zone Reader must be configured with the
   **published production URL** (e.g. `https://medugu-microbe-pathways-core.lovable.app`).
   Preview / dev URLs must not be used — they are ephemeral and may change.
2. **Bearer token is admin-controlled.** Navigate to `/admin/zone-reader` as an
   admin, generate a token, and paste it into Zone Reader's `Authorization`
   configuration. Regenerating immediately invalidates the previous token.
3. **Token storage is browser-phase** (`localStorage`, per-tenant). For
   multi-device admin workflows, generate once and distribute through your
   normal secret-sharing channel.

## Current limitation (explicit)

The live inbound endpoint authenticates and parses the payload, returning
`202 Accepted`, but **server-side persistence is not yet enabled**. In this
build the actual AST update is performed through the **manual import path** in
the AST Zone Reader panel (`src/medugu/ui/sections/ast/ZoneReaderPanel.tsx`),
which uses the same `zoneReaderResultImportSchema`, `mapImport`, and
`updateAST` pipeline proven above.

Therefore:
- **Auth + parsing round-trip** — proven live.
- **Full automated POST-to-database persistence** — not proven in this build;
  the endpoint wiring to `mapImport` → `updateAST` is a future deployment step.
- **Manual import ingestion** — proven and remains the supported workflow.

## Regression test status

All tests pass:

- `roundTrip.test.ts` — 18 scenarios covering identity gating, schema
  enforcement, boundary protection, null-audit acceptance, and row-alignment
  classification.
- `publicInboundRoute.test.ts` — 9 scenarios covering CORS preflight, liveness,
  auth-token gating, and JSON payload validation.

Run:

```sh
bunx tsx src/medugu/integrations/zoneReader/__tests__/roundTrip.test.ts
bunx tsx src/medugu/integrations/zoneReader/__tests__/publicInboundRoute.test.ts
```

## Files in this change

- Added: `docs/acceptance/zone-reader-live-roundtrip-current.md`

## Out of scope (explicitly)

- Server-side persistence of inbound ZoneResults inside the POST handler.
- Webhook signature verification (HMAC).
- Polling, sockets, or background jobs.
- Automatic creation of missing AST rows (UI button is manual).
- Converting MIC rows to disk-diffusion rows (deliberately unsupported).

## Status

The **manual round-trip is proven end to end** for matched rows. The **live
endpoint round-trip is proven for authentication, CORS, and parsing**, with the
actual database ingestion remaining on the manual import path until the POST
handler is wired to `mapImport` + `updateAST` in a future build.
