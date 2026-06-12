# Zone Reader live ingestion

Medugu is the sole clinical authority. Zone Reader sends raw disk-diffusion
measurements and always asserts `notForClinicalRelease=true` and
`releaseAuthority="LIS"`.

## Connected browser workflow

When an authenticated Medugu user selects **Send to Zone Reader**, Medugu opens
and registers that exact Zone Reader window and transfers the worklist to its
configured origin. The completed Zone Result can return through the same
origin-checked browser connection without a bearer token.

Medugu accepts the return only from the registered reader window, validates it
with the existing strict import mapper, and loads it into the AST clinical
review panel. Zone Reader reports success only after Medugu acknowledges the
payload. Keep the originating Medugu page open until the result is returned.

## Standalone API workflow

A Zone Reader opened independently can use:

`POST /api/public/zone-reader/result`

This public-network path remains bearer-token protected. Required deployment
secrets:

- `ZONE_READER_INBOUND_TOKEN`
- `ZONE_READER_TENANT_ID`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- Optional: `ZONE_READER_ALLOWED_ORIGIN`

The token is provisioned outside the browser and copied into Zone Reader only
for standalone API submission. Medugu validates the complete contract before
storage.

## Receipt semantics

A successful API request returns `202 Accepted` with a durable receipt ID and
`status: "pending_review"`. Re-sending the same canonical payload returns the
same receipt with `idempotent: true`.

Browser-window acknowledgement means the payload was loaded into the open
Medugu clinical review panel; it is not a durable API receipt.

Neither path updates AST rows, interprets susceptibility, or releases a
clinical result automatically. An authorized LIMS user must review and accept
returned measurements through the standard AST workflow.
