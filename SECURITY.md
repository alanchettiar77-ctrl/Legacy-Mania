# SECURITY.md — Legacy Mania

Security model reference. Update whenever an auth-relevant surface changes.

## Authorization model

- **Central helper:** `requireAdmin()` (`src/lib/supabase/admin-auth.ts`) — the only admin gate. Resolves the session user via the cookie-scoped Supabase client, then reads `profiles.role` via the service-role key (fails closed on any error). Returns 401 (no session) / 403 (not admin). Every `/api/admin/*` route and admin-capable route (`/api/media/*`) must call it first. **Never duplicate role checks inline.**
- **Service-role key** is used by repositories/services (bypasses RLS); therefore every route in front of them is responsible for authorization.
- **RLS** protects direct PostgREST access with the public anon key: admin-gated tables use the `SECURITY DEFINER is_admin()` helper (migration 005) to avoid the recursion bug; checkout RPCs have `EXECUTE` revoked from `anon`/`PUBLIC` (migration 006).

## Rate limiting

`checkRateLimit(key, limit, windowMs)` (`src/lib/rate-limit.ts`) — per-instance, in-memory, best-effort (resets on cold start; not shared across serverless instances). Applied to: checkout (10/min/ip), media upload (30/min/admin), analytics (30/min/ip).

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

## Reporting

Found something? Open a private issue or contact the maintainer directly; do not commit exploit details to the repo.
