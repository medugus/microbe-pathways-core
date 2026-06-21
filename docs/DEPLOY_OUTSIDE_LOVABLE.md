# Deploy Medugu LIMS Outside Lovable

This repo is now configured to build and deploy directly from GitHub to Cloudflare Workers. Lovable is not required for build, auth, AI gateway, or deployment.

## GitHub Settings

Add these repository variables:

- `CLOUDFLARE_DEPLOY_ENABLED=true`
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `VITE_MEDUGU_PUBLIC_BASE_URL`, for example `https://lims.example.com`
- `VITE_ZONE_READER_PUBLIC_URL`, for example `https://reader.example.com`
- `VITE_MEDUGU_REQUIRE_AUTH=false` for prelaunch no-login mode; change to `true` when real Supabase Auth users/profiles are ready.
- `VITE_MEDUGU_IPC_EMAIL`, for the IPC "Notify IPC" email draft button
- `SUPABASE_PROJECT_REF`, only if using the Supabase migration workflow

Add these repository secrets:

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`
- `SUPABASE_ACCESS_TOKEN`, only if using the Supabase migration workflow
- `SUPABASE_DB_PASSWORD`, only if using the Supabase migration workflow

## Cloudflare Worker Settings

Worker name: `medugu-lims`.

Add these Worker variables/secrets in Cloudflare:

- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `ZONE_READER_INBOUND_TOKEN`
- `AI_ASSIST_ENABLED`
- `AI_API_KEY` or `OPENAI_API_KEY`, only if AI assist is enabled
- `AI_GATEWAY_URL`, optional OpenAI-compatible endpoint override
- `AI_MODEL`, optional model override
- `PHASE5_SERVER_VALIDATION`, optional validation feature gate

Never expose `SUPABASE_SERVICE_ROLE_KEY` or AI keys as `VITE_*` variables.

## Deploy

On every push to `main`, GitHub runs tests and a production build. Deployment runs only when `CLOUDFLARE_DEPLOY_ENABLED=true`.

Manual local deploy:

```bash
npm ci
npm run preflight:outside-lovable
npm test
npm run build
npm run deploy
```

The preflight check fails if Lovable packages, hosted URLs, `.lovable` metadata, or the required Cloudflare deployment wiring reappear.

## Supabase Migrations

Use the manual `Supabase Migrations` GitHub workflow or run locally:

```bash
supabase link --project-ref <project-ref>
supabase db push
```

Prefer migrations in GitHub over manual dashboard schema changes.
