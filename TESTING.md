# TESTING.md — Legacy Mania

## Strategy

Jest (node env for routes/services, jsdom for components) with Testing Library. Convention: `X.test.ts(x)` colocated next to `X.ts(x)`.

Per layer:

- **Validation** — zod schema accept/reject cases (`src/lib/validation/*.test.ts`)
- **Repositories** — mocked `global.fetch` against the PostgREST contract
- **Services** — mocked repository module (`jest.mock` factory + `jest.requireMock`), business rules only
- **API routes** — mocked `requireAdmin`, `checkRateLimit`, services, audit; assert status codes (200/201/400/401/403/404/429/500) and audit calls
- **Components** — Testing Library render assertions (e.g. `announcement-bar.test.tsx`: empty → null, config → styles)

## Commands

- `npx jest` — full suite (must be green before any commit claiming completion)
- `npx jest <path>` — targeted
- `npx tsc --noEmit` — type check
- `node checkout-e2e.js` — live checkout E2E against production Supabase (manual, needs `.env.local`)

## Security-test conventions

Every admin route test must cover: auth passthrough (401/403 before any service call), rate-limit 429 before auth, validation 400 before service, audit-log assertions on mutations.

## Known gaps (do not fake coverage)

No harness exists for: browser E2E (beyond `checkout-e2e.js`), visual regression, automated a11y, or performance testing. If a task demands them, add the harness first or record the gap here.

## Current status (2026-07-19)

36 suites / 187 tests passing; type-check clean.
