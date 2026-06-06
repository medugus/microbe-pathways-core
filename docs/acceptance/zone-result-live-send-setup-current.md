# Zone Reader live send — setup (current build)

Scope: this document covers the **operator-facing configuration** required to
let Zone Reader POST ZoneResult JSON to this Medugu deployment. It does not
introduce polling, sockets, bidirectional sync, webhook signature
verification, device control, or background jobs. The manual JSON import path
remains fully supported and is still the documented fallback.

## What Zone Reader needs

To send live ZoneResult payloads, Zone Reader must be configured with two
values per Medugu tenant:

1. **Inbound endpoint URL** — the full HTTPS URL Zone Reader POSTs the
   ZoneResult JSON body to.
2. **Bearer token** — sent as `Authorization: Bearer <token>` on every POST.

Zone Reader must use the **absolute Medugu URL**, not a relative path. A
relative path will resolve against the Zone Reader host and never reach
Medugu.

## Where an admin retrieves this in Medugu

Both values live on a single admin-only page:

- **Route:** `/admin/zone-reader`
- **Source file:** `src/routes/admin.zone-reader.tsx`
- **Auth restriction:** the page is wrapped in `RequireAuth` and gated by
  `useAuth().hasRole("admin")`. Non-admin users are redirected to `/` with a
  toast "Admin role required". Loading state shows "Checking permissions…"
  until the auth context resolves.

### Endpoint URL

- Section: **Inbound endpoint URL**
- The page renders the fully-qualified URL by concatenating
  `window.location.origin` with the canonical path
  `/api/public/zone-reader/result`.
- A **Copy** button copies the full URL to the clipboard.
- The canonical path is also shown verbatim for documentation purposes.

### Bearer token

- Section: **Bearer token**
- Backed by `src/medugu/store/zoneReaderInboundConfig.ts` (browser-phase,
  localStorage, scoped per `tenantId`).
- Controls:
  - **Generate token** — first-time creation. Creates a 32-byte random hex
    token, stores it, reveals it, and copies it to the clipboard.
  - **Regenerate token** — replaces the existing token. The previous token is
    invalidated immediately and Zone Reader will stop authenticating until the
    new value is pasted in.
  - **Reveal / Hide** — token is masked by default.
  - **Copy** — copies the current token to the clipboard.
  - **Revoke** — clears the token entirely; Zone Reader cannot send until a
    new token is generated.
- The `Generated <timestamp>` label shows when the current token was issued.

## Auth restrictions applied

| Surface | Restriction |
|---|---|
| `/admin/zone-reader` route | `RequireAuth` + `hasRole("admin")` gate. Redirect on fail. |
| Token storage | Per-tenant key in `localStorage` (`medugu.zoneReaderInbound.v1`). |
| Token reveal | Masked input by default; explicit Reveal click required. |
| Token regeneration | Confirms via toast that the previous token is invalidated. |
| Token revoke | Native `confirm()` prompt before clearing. |

Non-admins never see the page contents and cannot read the token through the
UI. (Browser-phase storage means a user with direct devtools access to the
admin's browser could read localStorage; this matches the existing
browser-phase boundary documented in
`docs/acceptance/browser-phase-limitations.md`.)

## Operator procedure (live send setup)

1. Sign in to Medugu as an **admin**.
2. Navigate to `/admin/zone-reader`.
3. In **Inbound endpoint URL**, click **Copy** and paste into Zone Reader's
   ZoneResult destination field. Verify Zone Reader stores the full URL (it
   must begin with `https://` and the Medugu host).
4. In **Bearer token**:
   - If no token exists, click **Generate token**. The token is copied to the
     clipboard automatically.
   - If rotating, click **Regenerate token** and immediately update Zone
     Reader. Until Zone Reader is updated, its POSTs will be rejected.
5. Configure Zone Reader to send the token as
   `Authorization: Bearer <token>` on every ZoneResult POST.
6. Send a test ZoneResult from Zone Reader and confirm it appears in the AST
   Zone Reader panel.

## Scope of this step

- No new server endpoint was added. The receiver wiring at
  `/api/public/zone-reader/result` is a future deployment step and is out of
  scope here. This step exposes only the **configuration** that Zone Reader
  needs.
- No schema changes were made to the ZoneResult contract.
- No webhook signature verification, polling, or background jobs were added.
- Manual JSON import (documented in
  `docs/acceptance/zone-reader-manual-roundtrip-current.md`) remains the
  supported workflow until the receiver endpoint is deployed.

## Files in this change

- Added: `src/medugu/store/zoneReaderInboundConfig.ts`
- Added: `src/routes/admin.zone-reader.tsx`
- Added: `docs/acceptance/zone-result-live-send-setup-current.md`
