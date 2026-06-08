# Zone Reader inbound — production URL hardening (current build)

Scope: production-safety hardening only. No new integration features,
no schema changes, no polling, no sockets, no webhook verification
beyond what is already documented, no background jobs.

## Problem

The admin Zone Reader page previously derived the operator-facing live
endpoint URL from `window.location.origin`. When opened from a preview
host (`id-preview--*.lovable.app`, `*.lovableproject.com`, localhost),
the page would surface a preview URL that operators could mistakenly
configure in Zone Reader as the live ZoneResult destination. Preview
URLs are ephemeral and must never be used for live send.

## Change summary

1. The endpoint URL handed to Zone Reader is now built from a **stable
   production base URL**, never from `window.location.origin`.
2. The base URL has a **built-in default** equal to the known published
   Medugu host:
   `https://medugu-microbe-pathways-core.lovable.app`
3. Admins may **override** the base URL from `/admin/zone-reader`. The
   override is validated (https origin only) and persisted in
   `localStorage` (`medugu.zoneReaderInbound.baseUrl.v1`).
4. The canonical path remains:
   `/api/public/zone-reader/result`
5. When the admin page is opened from a **preview host**, a strong
   destructive-styled warning banner is rendered above the endpoint
   section explaining that preview URLs must not be used for live send,
   and confirming that the endpoint shown is pinned to the production
   host.
6. Token management remains admin-only (`RequireAuth` +
   `hasRole("admin")`).

## How the stable base URL is determined

In order:

1. Admin override stored in `localStorage` under
   `medugu.zoneReaderInbound.baseUrl.v1`, if set and valid.
2. Otherwise, the built-in constant
   `DEFAULT_PRODUCTION_BASE_URL = "https://medugu-microbe-pathways-core.lovable.app"`
   in `src/medugu/store/zoneReaderInboundConfig.ts`.

`window.location.origin` is **never** used to build the endpoint URL.
It is only read for the preview-host warning banner.

Override validation:
- must parse as a URL
- protocol must be `https:`
- only the origin is stored (path / query / hash are discarded)

## Preview-host detection

`isPreviewHost()` in `src/medugu/store/zoneReaderInboundConfig.ts`
returns true when `window.location.hostname`:
- equals `localhost` or `127.0.0.1`, or ends with `.local`
- ends with `.lovableproject.com`
- contains `id-preview--` or `-preview--`

## Warning shown on preview hosts

When `isPreviewEnvironment()` is true the admin page renders a
destructive-styled `role="alert"` banner that:

- titles **"Preview host detected — do not use this origin for live send"**
- names the current preview origin
- reminds the operator that preview URLs are ephemeral and must never be
  configured in Zone Reader
- confirms that the endpoint URL below is pinned to the stable
  production host

The endpoint URL itself remains the production URL even on preview
hosts, so an operator who copies it still gets the correct value.

## Runtime behavior change

- Endpoint URL surfaced to operators no longer depends on the current
  browser origin. On production, behavior is unchanged (it was already
  the production origin). On preview hosts, the surfaced URL is now the
  production URL instead of the preview URL — this is the intended
  hardening.
- Token storage, generation, revocation, and the receiver route
  (`/api/public/zone-reader/result`) are unchanged.
- ZoneResult schema and import mapping are unchanged.

## Files changed

- edited `src/medugu/store/zoneReaderInboundConfig.ts`
  (added production base URL store, preview-host detection, validation;
  `getEndpointUrl()` now derives from the production base URL)
- edited `src/routes/admin.zone-reader.tsx`
  (added preview-host warning banner; added Production base URL section
  with override save/reset)
- added `docs/acceptance/zone-reader-inbound-production-url-hardening-current.md`
