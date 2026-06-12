# Zone Reader live ingestion

Medugu is the sole clinical authority. Zone Reader sends raw disk-diffusion
measurements and always asserts `notForClinicalRelease=true` and
`releaseAuthority="LIS"`.

## Endpoint

`POST /api/public/zone-reader/result`

Required deployment secrets:

- `ZONE_READER_INBOUND_TOKEN`
- `ZONE_READER_TENANT_ID`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- Optional: `ZONE_READER_ALLOWED_ORIGIN`

The token is provisioned outside the browser and copied into Zone Reader.
Medugu validates the complete contract before storage.

## Receipt semantics

A successful request returns `202 Accepted` with a durable receipt ID and
`status: "pending_review"`. Re-sending the same canonical payload returns the
same receipt with `idempotent: true`.

Acceptance means the payload is stored. It does not update AST rows, interpret
susceptibility, or release a clinical result. An authorized LIMS user must
review and accept queued measurements through the standard AST workflow.
