# SECURITY.md — Legacy Mania

Security model reference. Update whenever an auth-relevant surface changes.

## Authorization model

- **Central helpers:** `requireAdmin()` (route/server-component guard) and the exported `getCallerRole()` it wraps (both in `src/lib/supabase/admin-auth.ts`) — the only two admin-role primitives. `requireAdmin()` resolves the session user via the cookie-scoped Supabase client, then reads `profiles.role` via `getCallerRole()` (service-role key, fails closed on any error), returning 401 (no session) / 403 (not admin). Every `/api/admin/*` route and admin-capable route (`/api/media/*`) must call `requireAdmin()` first. Call sites that already have a `user.id` and just need the role — `middleware.ts`, `/api/auth/role`, `/auth/redirect` — call `getCallerRole()` directly instead of re-fetching. **Never duplicate the fetch-and-compare logic inline.**
- **Service-role key** is used by repositories/services (bypasses RLS); therefore every route in front of them is responsible for authorization.
- **RLS** protects direct PostgREST access with the public anon key: admin-gated tables use the `SECURITY DEFINER is_admin()` helper (migration 005) to avoid the recursion bug; checkout RPCs have `EXECUTE` revoked from `anon`/`PUBLIC` (migration 006).

## Rate limiting

`checkRateLimit(key, limit, windowMs)` (`src/lib/rate-limit.ts`) — per-instance, in-memory, best-effort (resets on cold start; not shared across serverless instances). Applied to: checkout (10/min/ip), media upload (30/min/admin), analytics (30/min/ip), notifications admin APIs (60/min/ip), branding + category admin APIs (60/min/ip).

**Account lockout:** `login_attempts` table (migration 009) + `login-throttle-service.ts` — 5 consecutive failed logins for the same email lock it for 15 minutes, independent of and in addition to the per-IP limiter above. Locked and wrong-password responses are byte-identical (`401 {"error": "Invalid email or password"}`) — never reveal lockout state. On the failure that triggers lockout, a Supabase password-reset email is sent to the account once (not resent on subsequent blocked attempts).

## Session cookies

Server-set only: `src/lib/supabase/server.ts` and `middleware.ts` pass `cookieOptions: { httpOnly: true, secure: <production> }` to `createServerClient`. The browser client (`src/lib/supabase/client.ts`) never manages session state — every auth-relevant browser call (login, register, logout, password change, password reset, profile update, address/product/category/settings CRUD) goes through a server route instead, matching the pattern established by checkout/payments. This is load-bearing: the browser client structurally cannot set `httpOnly` (no JS API for it), so if it ever touches the session cookie again it will silently overwrite the server's protected cookie non-httpOnly. **Before adding any new `createClient()` (browser) call that reads/writes auth state, route it through a server API instead.**

The password-reset link exchanges its PKCE code server-side at `/auth/confirm` (not in the browser) for the same reason — see `AUTH_AUDIT.md` Finding #1.

## Upload policy

MediaService only: PNG/JPG/WEBP, 2 MB max, sharp-validated (corrupt files rejected), UUID filenames (no path traversal / filename XSS), namespace whitelist. **SVG is rejected by design** — SVGs can embed scripts and are an XSS vector when served from the site origin.

## Audit logging

`recordAuditLog()` (`src/lib/services/audit-service.ts`) → `audit_logs` table. Never throws (a failed audit write must not break the mutation). `userId` optional so anonymous failed-auth attempts can be recorded.

Conventions: `<domain>.<event>` action names, e.g. `analytics.view`, `analytics.access_denied` (includes caller IP + status in `new_values`).

## Endpoint auth matrix

See `API.md` — the section headers (Public / Customer / Admin) are the source of truth for which routes require what.

## Fixed vulnerabilities (history)

| Date | Issue | Fix |
|---|---|---|
| 2026-07-14 | Client-side order writes allowed price tampering | Server-side `create_order` RPC re-derives prices (Phase 1) |
| 2026-07-14 | `profiles` RLS infinite recursion broke admin-gated queries | `SECURITY DEFINER is_admin()` (migration 005) |
| 2026-07-14 | Checkout RPCs executable by `anon` key — stock corruption possible | `REVOKE EXECUTE` (migration 006) |
| 2026-07-19 | `/api/admin/analytics` fully anonymous — leaked revenue/user counts | `requireAdmin()` + rate limit + audit logging |
| 2026-07-20 | Open redirect on post-login navigation (`login` page + `/auth/redirect`) | `getSafeRedirect()` allow-lists relative paths only (`src/lib/utils.ts`) |
| 2026-07-20 | `forgot-password` relayed Supabase's raw error text (latent enumeration risk) | Fixed generic message, matching `login`/`register` route pattern |
| 2026-07-21 | Admin role-check logic duplicated 5x (drift risk — one copy wasn't fail-closed) | Consolidated to exported `getCallerRole()` in `admin-auth.ts`, used by all 5 call sites |
| 2026-07-21 | No per-account brute-force ceiling (only a soft per-IP, per-instance limiter) | `login_attempts` table + `login-throttle-service.ts`: 5-consecutive-failure / 15-min lockout with progressive delay |
| 2026-07-21 | Session cookie not `httpOnly` — any XSS could exfiltrate it for full session takeover | `cookieOptions: { httpOnly: true, secure }` on server/middleware clients; all ~13 browser-client auth/CRUD call sites migrated to server routes first (see `AUTH_AUDIT.md` Finding #1) |
| 2026-07-21 | Admin orders list quick-actions wrote `orders`/`payments` directly, bypassing `OrderService`'s guarded transitions and `PaymentService`'s verify audit trail | `orders-table-client.tsx` now calls the existing `PATCH /api/admin/orders/[id]/status` and `PATCH /api/admin/payments/[id]/verify` routes |

## Reporting

Found something? Open a private issue or contact the maintainer directly; do not commit exploit details to the repo.
