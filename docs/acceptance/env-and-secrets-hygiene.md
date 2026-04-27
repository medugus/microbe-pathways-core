# Environment and Secrets Hygiene — Medugu Microbiology Platform

## 1) Required environment variables
The application references the following environment variable names:

- `VITE_SUPABASE_URL` (frontend)
- `VITE_SUPABASE_PUBLISHABLE_KEY` (frontend)
- `SUPABASE_URL` (server/runtime and fallback)
- `SUPABASE_PUBLISHABLE_KEY` (server/runtime and fallback)
- `SUPABASE_SERVICE_ROLE_KEY` (server-only privileged client)

Optional:
- `PHASE5_SERVER_VALIDATION` (feature flag, non-secret)

## 2) Files that must never be committed
Do **not** commit real environment files containing live credentials or tenant-specific values, including:

- `.env`
- `.env.local`
- `.env.*.local`
- `.env.production`
- `.env.development`

Commit only the template file:

- `.env.example`

## 3) Local setup from template
1. Copy template:
   - `cp .env.example .env`
2. Fill in local values in `.env`.
3. Never commit `.env` or other real environment files.

## 4) Deployment variable handling
Set production/staging variables in the deployment platform secret manager / environment configuration (for example CI/CD or hosting provider runtime settings), **not** in git-tracked files.

## 5) Supabase key classification
- `VITE_SUPABASE_PUBLISHABLE_KEY` / `SUPABASE_PUBLISHABLE_KEY`: publishable/anon-style key for client-facing usage.
- `SUPABASE_SERVICE_ROLE_KEY`: private privileged key; server-only, never exposed to browser bundles.

Publishable keys are not equivalent to private service-role keys and should be treated with different handling controls.

## 6) Rotation recommendation
If any private key (especially service-role credentials) was ever committed to git history, rotate it in the provider console and update all consuming environments.

## 7) Secret handling confirmation
This document intentionally contains only variable names and placeholders. No secret values are printed.
