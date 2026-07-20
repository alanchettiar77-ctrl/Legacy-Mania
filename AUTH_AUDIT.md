# AUTH_AUDIT.md — Legacy Mania

Phase 0 pre-implementation audit for the auth/security hardening initiative. Read-only — no code changed to produce this document. Every claim below is sourced from a specific file; none are assumed from general Supabase/Next.js knowledge.

Scope note: the request that triggered this audit bundled 11 phases (session cookies, server authz, email verification, login hardening, password hashing, error-message copy, provider migration, OAuth, full pentest, test suite, doc sync) into one initiative. Per `docs/superpowers/plans/` conventions this gets split into separate, independently-shippable plans after this audit — see "Recommended phase plan" at the end.

---

## 1. Current authentication architecture

**Provider:** Supabase Auth exclusively. No custom auth, no Clerk, no Firebase. Confirmed via `package.json` (`@supabase/ssr`, `@supabase/supabase-js`) and absence of any other auth library import in `src/`.

**Session mechanism:** `@supabase/ssr` cookie-based SSR sessions — three client constructors:
- `src/lib/supabase/client.ts` — browser client (`createBrowserClient`), used in `use client` components for `signOut`, `resetPasswordForEmail`, `updateUser`.
- `src/lib/supabase/server.ts` — server client (`createClient`, cookie-bound to the request) for Server Components/Route Handlers, plus `createAdminClient()` (service-role, no cookies — intentionally never reads a caller's session, documented inline as the reason RLS bypass is safe).
- `src/lib/supabase/middleware.ts` — a third server client instantiated per-request inside `updateSession()`, used only to refresh the session and gate `/admin` and `/account`.

**Token storage:** Cookies, not `localStorage`/`sessionStorage`. Confirmed no `localStorage`/`sessionStorage` write touches auth state anywhere in `src/` (`cart-provider.tsx` is the only hit, and it's the cart store, unrelated).

## 2. Session handling — cookie flags (Finding #1, see §11)

`@supabase/ssr`'s default cookie serialization (`node_modules/@supabase/ssr/src/utils/constants.ts`):

```ts
export const DEFAULT_COOKIE_OPTIONS: CookieOptions = {
  path: "/",
  sameSite: "lax",
  httpOnly: false,
  maxAge: 400 * 24 * 60 * 60,
};
```

None of the three client constructors in this repo override `httpOnly` or add `secure`. So today:
- `sameSite=Lax` — ✅ matches the spec requirement, no action needed.
- `httpOnly=false` — ❌ the `sb-<project>-auth-token` cookie (access + refresh token) is readable via `document.cookie` by any JS running on the page, including an injected XSS payload.
- `secure` — not set at all by the library; Next's cookie serializer doesn't infer it from protocol. In production (Vercel, HTTPS-only) this is low-risk in practice, but it's not defense-in-depth — the cookie has no `Secure` attribute forcing HTTPS-only transmission.

**Why `httpOnly:false` is the library default, not a bug:** the browser client (`client.ts`) needs to read/write the session cookie itself for client-driven flows (`auth.updateUser()` on the reset-password page, `auth.signOut()` on logout buttons). If the cookie were `httpOnly`, those client-side calls would break. Fixing this is not a one-line flag flip — it requires either (a) accepting Supabase's documented trade-off and relying on CSP/XSS-hardening instead, or (b) moving `signOut`/`updateUser`/`resetPasswordForEmail` to server routes (mirroring what `login`/`register` already do) and making the browser client read-only. Recommend (b) — it's consistent with the pattern already established for login/register.

## 3. Token storage

Covered above — cookies only. No JWT ever placed in `localStorage`, `sessionStorage`, or a JS-readable global. No `console.log` of password/token/secret values found anywhere in `src/` (checked explicitly).

## 4. Password handling

No custom password storage exists in this codebase — 100% delegated to Supabase Auth (`supabase.auth.signUp` / `signInWithPassword` / `updateUser`), which hashes with bcrypt server-side inside Supabase's GoTrue service. **Phase 5 of the original spec (Argon2id/bcrypt migration) is not applicable — there is nothing to migrate.**

App-level password rules (`src/lib/validation/auth.ts`):
- Register: min 8, max 128 chars, no complexity rule.
- Login: min 6 (comment explains this is intentional — grandfathers accounts created under an older 6-char client-side rule; tightening it would lock out real users, not attackers, since it only gates the *login* schema).

No breached-password check (e.g., HaveIBeenPwned k-anonymity range API). Current 8-char minimum with no complexity rule matches NIST 800-63B guidance (favor length over forced complexity) — this is a defensible choice, not a vulnerability, but a breach check would be a reasonable low-effort addition.

## 5. User creation flow

`POST /api/auth/register` (`src/app/api/auth/register/route.ts`) → server-validates via `registerSchema` → `sanitizeText()` strips HTML/control chars from `fullName` before it reaches `auth.signUp()`'s metadata → Postgres trigger `handle_new_user()` (migration `001_initial_schema.sql:37-54`) auto-creates the `profiles` row, hardcoding the owner email as the sole `role='admin'` seed. Rate-limited 5/min/IP. Generic error on failure (no "email already registered" leak) — confirmed in `auth-routes.test.ts:106-115`.

## 6. Login flow

`POST /api/auth/login` — rate-limited 10/min/IP, server-validates via `loginSchema`, calls `signInWithPassword`, returns a single generic `"Invalid email or password"` on any failure (bad password, unknown email, or validation error all collapse to indistinguishable responses — confirmed by test suite). Failed attempts are audit-logged (`auth.login_failed`) but **not** counted toward any lockout — see Finding #4.

## 7. Logout flow

Client-only, three call sites (`account-sidebar.tsx`, `admin-header.tsx`, `account/settings/page.tsx`), all calling `supabase.auth.signOut()` on the browser client directly — no server route involved. Functionally fine (Supabase clears the cookie client-side), but it's the same pattern that requires the browser client to remain cookie-read/write-capable (see §2's fix trade-off).

## 8. Password reset flow

`resetPasswordForEmail()` (browser client, `forgot-password/page.tsx`) → Supabase emails a recovery link → `reset-password/page.tsx` calls `updateUser({ password })` on the browser client once Supabase's SDK auto-detects the recovery session from the URL. Standard Supabase pattern, no custom token handling to audit. One gap: the forgot-password page surfaces `error.message` from Supabase directly via `toast.error(error.message)` (`forgot-password/page.tsx:33`) — if Supabase's own error text ever differentiates "user not found" this would leak it client-side. Currently Supabase's `resetPasswordForEmail` does **not** error on unknown emails (returns success either way), so this is not currently exploitable, but it's a latent enumeration risk if that ever changes upstream — recommend replacing with a fixed message rather than relaying `error.message` verbatim.

## 9. Protected routes / middleware

`src/middleware.ts` → `updateSession()` (`src/lib/supabase/middleware.ts`), matched against everything except static assets:
- `/admin/*` — requires `user`, then a second REST call (service-role key, bypassing RLS) checks `profiles.role === 'admin'`; redirects to `/login` (no user) or `/account` (wrong role).
- `/account/*` — requires `user`; redirects to `/login?redirect=<path>`.

This is real server-side gating (not a client-side route guard), which is correct. But it re-implements the same "fetch profiles, check role" logic that `requireAdmin()` already encapsulates — see Finding #3.

## 10. Admin routes / API authorization

Central helper exists and is documented as mandatory: `requireAdmin()` (`src/lib/supabase/admin-auth.ts`), called first in `/api/admin/*` and `/api/media/*` routes per `SECURITY.md:7` ("the only admin gate... **Never duplicate role checks inline**"). Verified by grep: 26 of the routes under `src/app/api/admin/` do call `requireAdmin` (includes test files in that count). **Two routes violate the project's own stated rule** — see Finding #3.

RLS: `profiles`/`categories`/etc. use a `SECURITY DEFINER is_admin()` helper (migration `005_fix_profiles_rls_recursion.sql`) to avoid the self-referencing-policy recursion bug fixed in Phase 1. Checkout RPCs have `EXECUTE` revoked from `anon`/`authenticated`/`PUBLIC` (migration `006_revoke_anon_rpc_execute.sql`) after a confirmed-live exploit (anon key could call `consume_reservation` directly). Both fixes are real, applied, and hold up under review.

## 11. Existing vulnerabilities found

Ranked by severity, each with exact file:line and a concrete exploit scenario.

### Finding #1 — Session cookie not `httpOnly` (HIGH)
**Where:** `src/lib/supabase/client.ts`, `server.ts`, `middleware.ts` (all use `@supabase/ssr` defaults, none override `httpOnly`/`secure`).
**Exploit:** Any XSS on the site (stored or reflected) can run `document.cookie` and exfiltrate the `sb-*-auth-token` cookie, yielding a full session takeover — not just a captured form value. This is the single highest-value target for an attacker on this codebase, because it turns *any* XSS bug anywhere in the app into full account takeover.
**Fix direction (revised after deeper scoping — 2026-07-20):** Originally scoped as "move `signOut`/`updateUser`/`resetPasswordForEmail` to server routes," but the browser client (`@/lib/supabase/client`) is actually imported in **13 files**, not 3. At least `account/addresses/page.tsx` (full CRUD), `account/settings/page.tsx` (profile update), and five admin pages/forms (`products-table.tsx`, `product-form.tsx`, `orders-table-client.tsx`, `settings-client.tsx`, `category-form.tsx`) do direct RLS-scoped reads/writes from the browser client, relying on it being able to read its own session cookie to attach the user's JWT. Setting `httpOnly: true` breaks all of them at once, not just the 3 auth-flow calls. **This is a full migration of those ~10 call sites to server-route-backed writes (matching the pattern `checkout`/`payments`/`orders` already use), scoped as its own follow-on plan — not bundled with Findings #2/#6.**

**Status: deferred, not yet planned.** Needs its own plan (per-surface: customer addresses/settings first, admin panel second) before implementation starts.

### Finding #2 — Open redirect, two independent instances (HIGH)
**Where A:** `src/app/(auth)/login/page.tsx:37-43` — `redirectParam` is read straight from `window.location.search` and used as `window.location.href = destination` if it doesn't start with `/account`. No same-origin/relative-path validation.
**Exploit A:** `legacymania.com/login?redirect=https://evil-lookalike.com` — victim logs in with real credentials on the real site (so nothing looks wrong), then is silently bounced to an attacker-controlled page immediately after. Classic post-auth phishing pivot; the login itself is completely genuine, which is what makes it convincing.
**Where B:** `src/app/(auth)/redirect/page.tsx:39-40` — `redirect(decodeURIComponent(params.redirect))` passed straight to Next's `redirect()` with no allow-list/relative-path check.
**Exploit B:** Same class, via `/auth/redirect?redirect=https://evil.com` for any flow that lands on this page.
**Fix direction:** Validate the redirect target is a relative path (`^/(?!/)` — starts with a single `/`, not `//` which browsers treat as protocol-relative) before using it in either location.
**Status: fixed 2026-07-20** — `getSafeRedirect()` (`src/lib/utils.ts`) added and wired into both call sites. See `SECURITY.md`.

### Finding #3 — Admin role-check logic duplicated 5x, against the project's own documented rule (MEDIUM)
**Where:** `requireAdmin()` (`admin-auth.ts`), `updateSession()` (`middleware.ts:39-56`), `admins/route.ts:8-15` (`getCallerRole`), `role/route.ts:12-24`, `redirect/page.tsx:18-33` — five separate inline implementations of "fetch `profiles.role` via service-role REST call, compare to `'admin'`."
**Why it matters:** `SECURITY.md:7` explicitly states this exact pattern must never be duplicated, precisely because drift between copies is how authz bugs get introduced (e.g., one copy forgets the "at least one admin left" check, or fails open instead of closed on fetch error — `admins/route.ts`'s copy doesn't wrap the fetch in try/catch and fails closed only by accident of `res.ok` defaulting the array to empty, whereas `admin-auth.ts`'s copy explicitly documents fail-closed as an intentional invariant). This isn't hypothetical drift — it's already present today between copies.
**Fix direction:** Consolidate all five into `requireAdmin()`/a shared `getCallerRole()` export from `admin-auth.ts`. Middleware runs on the Edge runtime, so confirm the shared helper is Edge-compatible (it already only uses `fetch`, so it should be).
**Status: fixed 2026-07-21** — `getCallerRole()` exported from `admin-auth.ts`; `middleware.ts`, `admins/route.ts`, `role/route.ts`, and `redirect/page.tsx` all consolidated onto it. See `SECURITY.md`.

### Finding #4 — No account lockout / brute-force ceiling beyond a soft, per-instance IP rate limit (MEDIUM-HIGH)
**Where:** `checkRateLimit()` (`src/lib/rate-limit.ts`) — in-memory `Map`, explicitly documented as "not shared across serverless instances... a best-effort deterrent, not a hard guarantee" (its own comment, `rate-limit.ts:17-19`).
**Exploit:** On Vercel, each serverless instance gets its own empty bucket. An attacker distributing a credential-stuffing run across enough concurrent requests (which spin up multiple instances) faces nowhere near the nominal "10/min/IP" ceiling in aggregate, and the counter resets on every cold start regardless. No per-account lockout exists at all — only per-IP.
**Fix direction:** The original spec's Phase 4 ask (Upstash Redis-backed limiter + 5-attempt account lockout) directly addresses this. This is the one phase of the original 11 that's a real, justified gap rather than already-solved or scope-mismatched.
**Status: fixed 2026-07-21** — `login_attempts` table (migration 009) + `login-throttle-service.ts` add a real per-account lockout (5 consecutive failures / 15 min) with progressive delay, layered on top of the unchanged per-IP limiter. Supabase table chosen over Upstash Redis (no new external dependency, matches existing repository/service pattern). See `SECURITY.md`.

### Finding #5 — Email verification status not checked before sensitive actions (UNVERIFIED — needs a dashboard check, not a code fix)
**Where:** No code path anywhere in `src/` reads `user.email_confirmed_at` or gates `/api/checkout`, `/api/account/profile`, wishlist actions, etc. on it. No `supabase/config.toml` exists in this repo, so whether "Confirm email" is even enabled is a **Supabase project dashboard setting, not visible in this codebase** — cannot be verified from code alone.
**Conflict to flag before implementing:** `TASKS.md` documents `/api/checkout` as intentionally **guest-friendly** (no login required at all). Gating checkout on email verification is a product-scope decision, not a pure security fix — needs explicit sign-off before Phase 3 of the original spec is implemented, since it changes existing, working functionality (guest checkout) for non-guest users.

### Finding #6 — Password-reset error message relays Supabase's raw error text (LOW)
**Where:** `forgot-password/page.tsx:33` — `toast.error(error.message)`.
**Exploit:** Not currently exploitable (Supabase's `resetPasswordForEmail` doesn't currently error differently for unknown emails), but it's a latent enumeration vector if that behavior ever changes, and it's inconsistent with the fixed-message discipline already applied to login/register.
**Fix direction:** Replace with a fixed message, matching the pattern already used in `login/route.ts` and `register/route.ts`.
**Status: fixed 2026-07-20** — see `SECURITY.md`.

### Already fixed / not applicable — do not re-touch
- **Generic auth error messages (spec Phase 6):** already done, commit `295e930`. `login`/`register` routes return fixed strings; test suite (`auth-routes.test.ts`) asserts no enumeration leak. No action needed beyond Finding #6's one remaining spot.
- **Password hashing (spec Phase 5):** not applicable — no custom hashing exists to migrate; Supabase Auth owns this entirely.
- **`console.log(password)`/`console.log(token)` sweep (spec Phase 5):** none found.
- **SQL injection / RLS bypass via direct PostgREST (spec Phase 9 items):** migrations 005 and 006 already closed the two live exploits found in Phase 1 review. Nothing new found in this pass.
- **CSRF:** `sameSite=Lax` (already the library default, see §2) plus JSON-only route handlers (no state-changing `GET`, all mutations require `Content-Type: application/json` which a cross-site `<form>` POST can't trivially forge) means CSRF risk here is low without an additional token scheme. Informational only, not a gap.

## 12. Priority ranking

| # | Finding | Severity | Effort | Blocks launch? |
|---|---|---|---|---|
| 1 | `httpOnly:false` session cookie | High | Medium (touches signOut/updateUser call sites) | Yes — full session-takeover surface for any future XSS |
| 2 | Open redirect (login page + `/auth/redirect`) | High | Low (one allow-list check, two sites) | Yes — actively phishable today, no other bug required |
| 4 | No real brute-force ceiling | Medium-High | Medium (needs Upstash or equivalent) | Recommended before launch |
| 3 | Duplicated admin role-check (5x) | Medium | Low-Medium (consolidate to one export) | No, but fix before it causes a real drift bug |
| 5 | Email verification gating | Unverified/Product decision | Depends on decision | Needs a decision, not code, first |
| 6 | Raw Supabase error relay on reset | Low | Trivial | No |

## 13. Overall risk score

**6.5 / 10 (Medium-High).** Driven almost entirely by Findings #1 and #2 — both are HIGH severity and both are cheap to fix relative to their impact, which is what makes them worth prioritizing over the original spec's broader Phase 1–11 sweep. The rest of the authz surface (RLS, `requireAdmin`, server-side price/stock truth, audit logging) is in genuinely good shape — this is not a codebase with systemic auth problems, it's a codebase with two sharp, fixable defects and one real gap (brute-force ceiling) sitting inside an otherwise solid pattern.

---

## Recommended phase plan (supersedes the original 11-phase request)

The original request's phases 1, 2, 4, 6, 9 map to real findings above; phases 3, 5, 7, 8, 10 either don't apply to this codebase as-is or need a product decision before they're implementable:

- **Phase A (do now):** Fix Findings #1, #2, #6 — cookie hardening + both open redirects + reset-error message. Small, surgical, no product-scope questions.
- **Phase B (do next):** Fix Finding #3 — consolidate the 5 role-check copies into `requireAdmin()`.
- **Phase C (needs infra decision):** Finding #4 — real distributed rate limiting + lockout. Needs a decision on Upstash Redis vs. Supabase-table-backed counters before scoping.
- **Phase D (needs product decision):** Finding #5 — email verification gating. Needs sign-off on which "sensitive actions" still allow guests, since checkout currently doesn't require login at all.
- **Not planned:** Phase 5 (password hashing — N/A), Phase 7 (provider migration — already on Supabase Auth, nothing to migrate), Phase 8 (OAuth — no existing request for it beyond the original template; separate feature, not a security fix), full penetration-test-style Phase 9 sweep beyond what's listed above (would need explicit scope + authorization as a distinct engagement).
