# CI Quality Gates

## Commands added

The repository now exposes standard quality-gate commands via `package.json`:

- `npm run build` → production build (existing command)
- `npm run typecheck` → TypeScript compile check with no emit (`tsc --noEmit`)
- `npm run lint` → ESLint run (existing command)
- `npm test` → Medugu logic/regression script test runner

## What CI runs

GitHub Actions workflow: `.github/workflows/ci.yml`

Triggers:

- `push` to `main`
- all `pull_request` events

Steps:

1. `npm ci`
2. `npm run build`
3. `npm run typecheck`
4. `npm test`
5. `npm run lint` (non-blocking with `continue-on-error: true`)

## Current lint status

`npm run lint` currently fails against a broad existing baseline. Most failures are Prettier formatting (`prettier/prettier`) with a smaller number of substantive rules (for example `@typescript-eslint/no-explicit-any`, React hook dependency warnings, and react-refresh warnings).

Because this baseline predates this change and spans many unrelated files, lint is included as visible but non-blocking in CI for now.

## Logic test discovery

`npm test` runs `node scripts/run-medugu-logic-tests.mjs`, which:

1. Scans `src/medugu/logic/__tests__`.
2. Selects every file matching `*.ts`.
3. Runs each file with `npx --no-install tsx <file>`.
4. Stops on first failure.
5. Exits non-zero if any test fails.
6. Prints per-file status plus a final summary.

## How to add a new logic test

1. Add a TypeScript script-style test file in `src/medugu/logic/__tests__` with extension `.ts`.
2. Make sure the file exits with code 0 when assertions pass and throws/exits non-zero on failure.
3. Run `npm test` locally to verify discovery and execution.

No registration in a separate test manifest is required; discovery is file-system based.

## Future lint cleanup

To make lint blocking, complete a baseline cleanup pass:

1. Apply Prettier formatting across the existing codebase.
2. Triage/resolve substantive ESLint issues (typing, hook deps, refresh rules).
3. Flip CI lint step to blocking by removing `continue-on-error: true`.
