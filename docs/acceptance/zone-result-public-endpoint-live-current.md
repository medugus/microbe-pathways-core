# ZoneResult public inbound endpoint — live (current build)

Scope: this document covers the **HTTP route** that backs the documented
ZoneResult inbound URL. It does not add polling, sockets, bidirectional
sync, webhook signature verification, device control, or background jobs.
Manual JSON import via the AST Zone Reader panel remains the supported
workflow until server-side persistence is enabled.

## Route now live

| Aspect | Value |
|---|---|
| Path | `/api/public/zone-reader/result` |
| File | `src/routes/api.public.zone-reader.result.ts` |
| Methods | `OPTIONS`, `GET`, `POST` |
| Auth on `POST` | `Authorization: Bearer <token>` (required) |
| Auth on `OPTIONS` / `GET` | None (preflight + liveness only) |

The route is registered through TanStack Start's file-based routing under
the `/api/public/*` prefix, allowing external callers such as Zone Reader
devices and automation to reach the bearer-protected endpoint.

## Method behavior

### `OPTIONS` (CORS preflight)
- Status: **204 No Content**
- Headers: `Access-Control-Allow-Origin: *`,
  `Access-Control-Allow-Methods: GET, POST, OPTIONS`,
  `Access-Control-Allow-Headers: Content-Type, Authorization`,
  `Access-Control-Max-Age: 86400`.
- Purpose: lets browser-based Zone Reader builds satisfy CORS preflight
  before POSTing a ZoneResult body.

### `GET` (liveness)
- Status: **200 OK**, `Content-Type: application/json`.
- Body (shape):
  ```json
  {
    "ok": true,
    "route": "/api/public/zone-reader/result",
    "methods": ["OPTIONS", "GET", "POST"],
    "message": "ZoneResult inbound endpoint is live. POST a ZoneResult JSON body with `Authorization: Bearer <token>`. ..."
  }
  ```
- Purpose: route-existence check so operators can confirm the URL is
  reachable on the deployed host without sending a payload. Never accepts
  payloads. Never exposes secrets.

### `POST` (ZoneResult submission)
| Condition | Status | Body |
|---|---|---|
| Valid bearer token + `application/json` + object body | **202 Accepted** | `{ ok: true, accepted: true, route, message }` |
| `Authorization` header missing | **401 Unauthorized** | `{ error: "missing_authorization", message }` |
| `Authorization` present but not `Bearer <token>` | **401 Unauthorized** | `{ error: "malformed_authorization", message }` |
| Token does not match server-configured token, OR (no server token configured) is not 64-char hex | **403 Forbidden** | `{ error: "invalid_token", message }` |
| Body is not `application/json` | **415 Unsupported Media Type** | `{ error: "unsupported_media_type" }` |
| Body is not parseable JSON | **400 Bad Request** | `{ error: "invalid_json" }` |
| Body is not a JSON object | **400 Bad Request** | `{ error: "invalid_payload" }` |

All responses include CORS headers so browser-origin callers see the
status and JSON body instead of an opaque network error.

## Bearer token rules

The route enforces a real bearer-token gate without introducing a
persistent server-side token store in this step:

- If `ZONE_READER_INBOUND_TOKEN` is set in the server environment, the
  presented token must match it exactly. Mismatch → **403**.
- If `ZONE_READER_INBOUND_TOKEN` is unset, the token must be a 64-char
  hex string (the shape produced by `/admin/zone-reader` →
  *Generate token*). Anything else → **403**.

Missing or malformed `Authorization` headers always return an explicit
JSON **401**, never silent acceptance and never a 404.

The ZoneResult **schema** is not changed in this step. The endpoint
only structurally validates that the body is a JSON object; the manual
import path in the AST Zone Reader panel continues to apply
`zoneReaderResultImportSchema` for full validation. Server-side
persistence is not enabled in this build — a 202 confirms the endpoint
authenticated and parsed the payload, not that it has been ingested
into a case.

## Admin UI alignment

`/admin/zone-reader` (`src/routes/admin.zone-reader.tsx`) already
renders the endpoint URL as
`window.location.origin + /api/public/zone-reader/result`, which now
matches the live route exactly. No copy changes were needed.

## Verification

Tests live at
`src/medugu/integrations/zoneReader/__tests__/publicInboundRoute.test.ts`
and cover:

- route exists (`GET` returns 200 JSON, not 404)
- `OPTIONS` preflight returns 204 with the expected CORS headers
- authenticated `POST` returns 202 for a JSON object body
- missing `Authorization` → 401 `missing_authorization`
- malformed `Authorization` scheme → 401 `malformed_authorization`
- structurally invalid token → 403 `invalid_token`
- `ZONE_READER_INBOUND_TOKEN` env override is honored (mismatched hex
  token rejected, matching server-side secret accepted)
- non-JSON `Content-Type` → 415
- unparseable JSON body → 400

Run:

```sh
bunx tsx src/medugu/integrations/zoneReader/__tests__/publicInboundRoute.test.ts
# → publicInboundRoute.test ok
```

## Files in this change

- Added: `src/routes/api.public.zone-reader.result.ts`
- Added: `src/medugu/integrations/zoneReader/__tests__/publicInboundRoute.test.ts`
- Added: `docs/acceptance/zone-result-public-endpoint-live-current.md`

## Out of scope (explicitly)

- Webhook signature verification (HMAC) — not added.
- Polling, sockets, or background jobs — not added.
- Server-side persistence of inbound ZoneResults — not added; manual
  import remains the supported ingestion path.
- ZoneResult schema changes — not made.
