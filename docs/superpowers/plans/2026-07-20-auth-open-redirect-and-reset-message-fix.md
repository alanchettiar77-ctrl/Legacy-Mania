# Auth Open-Redirect and Reset-Message Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the two open-redirect vulnerabilities found in `AUTH_AUDIT.md` Finding #2, and stop `forgot-password` from relaying Supabase's raw error text (Finding #6).

**Architecture:** Add one shared pure helper, `getSafeRedirect()`, to `src/lib/utils.ts` (existing home for small pure helpers like `slugify`/`formatCurrency`). Both vulnerable call sites route their untrusted redirect target through it before using it for navigation. No new files, no API/schema changes, no session/cookie changes (that's a separate, larger plan per `AUTH_AUDIT.md`).

**Tech Stack:** TypeScript, Jest (existing `npm test`), Next.js App Router.

## Global Constraints

- Preserve exact existing redirect *business logic* (e.g., login page's rule "ignore `/account` redirects, send to `/admin` instead") — only add a safety gate in front of it, don't change behavior for already-safe inputs.
- No new dependencies.
- Match existing code style (no comments unless explaining non-obvious WHY, per repo convention already visible in `rate-limit.ts`/`validation/auth.ts`).

---

### Task 1: `getSafeRedirect()` helper + tests

**Files:**
- Modify: `src/lib/utils.ts`
- Test: `src/lib/utils.test.ts` (new file)

**Interfaces:**
- Produces: `getSafeRedirect(target: string | null | undefined, fallback: string): string` — returns `target` unchanged if it's a safe same-origin relative path, otherwise returns `fallback`. "Safe" = starts with a single `/` (not `//` or `/\`, both of which browsers treat as protocol-relative and will navigate off-origin).

- [ ] **Step 1: Write the failing tests**

```typescript
// src/lib/utils.test.ts
import { getSafeRedirect } from "./utils";

describe("getSafeRedirect", () => {
  it("returns a plain relative path unchanged", () => {
    expect(getSafeRedirect("/checkout", "/admin")).toBe("/checkout");
  });

  it("returns a relative path with query/hash unchanged", () => {
    expect(getSafeRedirect("/account/orders?tab=open", "/admin")).toBe("/account/orders?tab=open");
  });

  it("falls back on null", () => {
    expect(getSafeRedirect(null, "/admin")).toBe("/admin");
  });

  it("falls back on undefined", () => {
    expect(getSafeRedirect(undefined, "/admin")).toBe("/admin");
  });

  it("falls back on empty string", () => {
    expect(getSafeRedirect("", "/admin")).toBe("/admin");
  });

  it("falls back on an absolute URL (no leading slash)", () => {
    expect(getSafeRedirect("https://evil.com", "/admin")).toBe("/admin");
  });

  it("falls back on a protocol-relative URL (//)", () => {
    expect(getSafeRedirect("//evil.com", "/admin")).toBe("/admin");
  });

  it("falls back on a backslash protocol-relative URL (/\\)", () => {
    expect(getSafeRedirect("/\\evil.com", "/admin")).toBe("/admin");
  });

  it("falls back on a bare protocol string with no slash", () => {
    expect(getSafeRedirect("javascript:alert(1)", "/admin")).toBe("/admin");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest src/lib/utils.test.ts`
Expected: FAIL — `getSafeRedirect` is not exported from `./utils` (`TypeError: (0 , _utils.getSafeRedirect) is not a function` or similar).

- [ ] **Step 3: Implement the helper**

Add to `src/lib/utils.ts` (after the existing exports, e.g. below `truncate`):

```typescript
export function getSafeRedirect(target: string | null | undefined, fallback: string): string {
  if (!target) return fallback;
  if (!target.startsWith("/")) return fallback;
  if (target.startsWith("//") || target.startsWith("/\\")) return fallback;
  return target;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest src/lib/utils.test.ts`
Expected: PASS — all 9 tests green.

- [ ] **Step 5: Commit**

```bash
git add src/lib/utils.ts src/lib/utils.test.ts
git commit -m "feat: add getSafeRedirect helper to block open-redirect payloads"
```

---

### Task 2: Fix open redirect in the login page

**Files:**
- Modify: `src/app/(auth)/login/page.tsx:37-43`

**Interfaces:**
- Consumes: `getSafeRedirect(target, fallback)` from Task 1 (`@/lib/utils`).

Current code (the vulnerable block):

```typescript
    const redirectParam = new URLSearchParams(window.location.search).get("redirect");
    // If redirect is /account (set by middleware when user icon is clicked while logged out),
    // ignore it and go to /admin so middleware can route based on role:
    // admins → /admin, customers → /account
    const destination =
      redirectParam && !redirectParam.startsWith("/account") ? redirectParam : "/admin";
    window.location.href = destination;
```

- [ ] **Step 1: Write the failing test**

There is no existing test file for this page (it's a `"use client"` form component with no test coverage today, confirmed by `Glob` finding zero `.test.tsx` files under `src/app/(auth)/`). Adding full RTL component test scaffolding is out of scope for this fix — `getSafeRedirect` already has full unit coverage from Task 1, and this task is a pure call-site wiring change. Skip to Step 2 (manual verification) instead of adding a new test harness for one call site.

- [ ] **Step 2: Apply the fix**

Replace the block above with:

```typescript
    const redirectParam = new URLSearchParams(window.location.search).get("redirect");
    // If redirect is /account (set by middleware when user icon is clicked while logged out),
    // ignore it and go to /admin so middleware can route based on role:
    // admins → /admin, customers → /account
    const safeRedirect = getSafeRedirect(redirectParam, "/admin");
    const destination = safeRedirect.startsWith("/account") ? "/admin" : safeRedirect;
    window.location.href = destination;
```

Add the import at the top of the file (alongside the existing `sonner`/`lucide-react` imports):

```typescript
import { getSafeRedirect } from "@/lib/utils";
```

- [ ] **Step 3: Manual verification**

Run: `npm run dev`, then in the browser:
1. Visit `/login?redirect=/checkout`, log in → should land on `/checkout` (safe relative path still works).
2. Visit `/login?redirect=https://example.com`, log in → should land on `/admin` (absolute URL rejected, falls back).
3. Visit `/login?redirect=//example.com`, log in → should land on `/admin` (protocol-relative rejected).
4. Visit `/login?redirect=/account/orders`, log in → should land on `/admin` (existing `/account`-ignore rule still applies).

Expected: all four behave as described — the fix must not change behavior for cases 1 and 4, only add rejection for cases 2 and 3.

- [ ] **Step 4: Commit**

```bash
git add "src/app/(auth)/login/page.tsx"
git commit -m "fix: block open redirect on post-login navigation"
```

---

### Task 3: Fix open redirect in `/auth/redirect`

**Files:**
- Modify: `src/app/(auth)/redirect/page.tsx:35-43`

**Interfaces:**
- Consumes: `getSafeRedirect(target, fallback)` from Task 1 (`@/lib/utils`).

Current code (the vulnerable block):

```typescript
  const params = await searchParams;

  if (role === "admin") {
    redirect("/admin");
  } else if (params.redirect) {
    redirect(decodeURIComponent(params.redirect));
  } else {
    redirect("/account");
  }
```

- [ ] **Step 1: Apply the fix**

Replace the block above with:

```typescript
  const params = await searchParams;

  if (role === "admin") {
    redirect("/admin");
  } else {
    const target = params.redirect ? decodeURIComponent(params.redirect) : null;
    redirect(getSafeRedirect(target, "/account"));
  }
```

Add the import at the top of the file:

```typescript
import { getSafeRedirect } from "@/lib/utils";
```

- [ ] **Step 2: Manual verification**

Run: `npm run dev`, then in the browser (as a logged-in customer account):
1. Visit `/auth/redirect?redirect=/account/orders/123` → should land on `/account/orders/123`.
2. Visit `/auth/redirect?redirect=https://example.com` → should land on `/account` (rejected, falls back).
3. Visit `/auth/redirect` with no `redirect` param → should land on `/account` (unchanged default behavior).

Expected: all three behave as described.

- [ ] **Step 3: Commit**

```bash
git add "src/app/(auth)/redirect/page.tsx"
git commit -m "fix: block open redirect in /auth/redirect"
```

---

### Task 4: Stop relaying Supabase's raw error text on password-reset request

**Files:**
- Modify: `src/app/(auth)/forgot-password/page.tsx:32-35`

Current code:

```typescript
    if (error) {
      toast.error(error.message);
      return;
    }
```

- [ ] **Step 1: Apply the fix**

Replace with a fixed message, matching the pattern already used in `src/app/api/auth/login/route.ts` and `src/app/api/auth/register/route.ts` (generic, no upstream detail leaked):

```typescript
    if (error) {
      toast.error("Something went wrong. Please try again.");
      return;
    }
```

- [ ] **Step 2: Manual verification**

Run: `npm run dev`, visit `/forgot-password`, submit a syntactically valid email. Confirm the success path (`sent` screen) still works unchanged — this fix only touches the error branch. Triggering the error branch itself requires a live Supabase outage/misconfiguration and isn't practical to reproduce locally; the change is a one-line string swap with no logic change, so code review substitutes for a live-error repro here.

- [ ] **Step 3: Commit**

```bash
git add "src/app/(auth)/forgot-password/page.tsx"
git commit -m "fix: stop relaying raw Supabase error text on password-reset request"
```

---

### Task 5: Update SECURITY.md and AUTH_AUDIT.md

**Files:**
- Modify: `SECURITY.md` (append to the "Fixed vulnerabilities (history)" table)
- Modify: `AUTH_AUDIT.md` (mark Findings #2 and #6 as fixed)

- [ ] **Step 1: Add a row to `SECURITY.md`'s fixed-vulnerabilities table**

Add after the existing last row (`2026-07-19 | /api/admin/analytics fully anonymous...`):

```markdown
| 2026-07-20 | Open redirect on post-login navigation (`login` page + `/auth/redirect`) | `getSafeRedirect()` allow-lists relative paths only (`src/lib/utils.ts`) |
```

- [ ] **Step 2: Mark Findings #2 and #6 as resolved in `AUTH_AUDIT.md`**

In the "Priority ranking" table (§12), change the `Open redirect...` and `Raw Supabase error relay...` rows' status, or add a one-line note directly below §11's Finding #2 and Finding #6 headers: `**Status: fixed 2026-07-20** — see SECURITY.md.`

- [ ] **Step 3: Commit**

```bash
git add SECURITY.md AUTH_AUDIT.md
git commit -m "docs: record open-redirect and reset-message fixes in SECURITY.md"
```

---

## Self-Review

**Spec coverage:** Finding #2 (both instances) → Tasks 2 and 3. Finding #6 → Task 4. Doc sync (repo convention, confirmed via `SECURITY.md`'s own "Update whenever an auth-relevant surface changes" instruction) → Task 5. No other `AUTH_AUDIT.md` finding is in this plan's scope (Findings #1, #3, #4, #5 are explicitly deferred to separate follow-on plans per the audit's "Recommended phase plan").

**Placeholder scan:** No TBD/TODO. Task 2 Step 1 explicitly explains *why* it skips automated test scaffolding (no existing test harness for this component type) rather than hand-waving it away.

**Type consistency:** `getSafeRedirect(target: string | null | undefined, fallback: string): string` is used identically in Task 2 (`redirectParam` is `string | null` from `URLSearchParams.get`) and Task 3 (`target` is `string | null`, constructed to match).
