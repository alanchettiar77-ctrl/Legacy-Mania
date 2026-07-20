# Consolidate Admin Role-Check Logic Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close `AUTH_AUDIT.md` Finding #3 — five independent inline implementations of "fetch `profiles.role` via service-role REST call, compare to `'admin'`" collapse into one exported, fail-closed helper.

**Architecture:** `src/lib/supabase/admin-auth.ts` already has a private `getCallerRole(userId)` used internally by `requireAdmin()`. Export it as the single source of truth. Update the four other call sites (`middleware.ts`, `admins/route.ts`, `role/route.ts`, `redirect/page.tsx`) to import and call it instead of re-implementing the fetch. The function only uses `fetch`/`process.env` (no `next/headers`), so it's safe to import into Edge-runtime middleware.

**Tech Stack:** TypeScript, Jest, Next.js middleware (Edge runtime) + Route Handlers + Server Components.

## Global Constraints

- Preserve existing behavior for all call sites except where the audit specifically flagged a bug (missing fail-closed handling) — do not change response shapes, status codes, or redirect targets.
- No new dependencies, no schema changes.
- `getCallerRole` must remain callable from Edge middleware — no `next/headers`/`cookies()` import inside it.

---

### Task 1: Export `getCallerRole` from `admin-auth.ts` with fail-closed error handling

**Files:**
- Modify: `src/lib/supabase/admin-auth.ts`
- Test: `src/lib/supabase/admin-auth.test.ts` (extend existing file)

**Interfaces:**
- Produces: `export async function getCallerRole(userId: string): Promise<string | null>` — returns the role string, or `null` on missing profile / any fetch failure (fail-closed).

Current code (`admin-auth.ts:11-24`):

```typescript
async function getCallerRole(userId: string): Promise<string | null> {
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}&select=role&limit=1`,
      { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` }, cache: "no-store" }
    );
    const rows = res.ok ? await res.json() : [];
    return rows?.[0]?.role ?? null;
  } catch (error) {
    // On any fetch or parsing failure, treat as "could not determine role"
    // This ensures we fail closed (deny access) rather than granting access on error
    return null;
  }
}
```

- [ ] **Step 1: Read the existing test file to confirm current coverage**

Read `src/lib/supabase/admin-auth.test.ts` in full before editing — it already mocks `fetch` for `requireAdmin()`'s behavior. New tests for the exported `getCallerRole` should follow the same mocking pattern.

- [ ] **Step 2: Write the failing test**

Add to `src/lib/supabase/admin-auth.test.ts`:

```typescript
import { getCallerRole } from "./admin-auth";

describe("getCallerRole", () => {
  const originalFetch = global.fetch;
  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it("returns the role when the profile exists", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => [{ role: "admin" }],
    }) as unknown as typeof fetch;
    expect(await getCallerRole("user-1")).toBe("admin");
  });

  it("returns null when no profile row is found", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => [],
    }) as unknown as typeof fetch;
    expect(await getCallerRole("user-1")).toBeNull();
  });

  it("fails closed (returns null) when the fetch itself throws", async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error("network down")) as unknown as typeof fetch;
    expect(await getCallerRole("user-1")).toBeNull();
  });

  it("fails closed (returns null) when the response is not ok", async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false }) as unknown as typeof fetch;
    expect(await getCallerRole("user-1")).toBeNull();
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx jest src/lib/supabase/admin-auth.test.ts`
Expected: FAIL — `getCallerRole` is not exported from `./admin-auth`.

- [ ] **Step 4: Export the function**

In `src/lib/supabase/admin-auth.ts`, change:

```typescript
async function getCallerRole(userId: string): Promise<string | null> {
```

to:

```typescript
export async function getCallerRole(userId: string): Promise<string | null> {
```

No other change needed — the implementation is already fail-closed and matches the interface above.

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx jest src/lib/supabase/admin-auth.test.ts`
Expected: PASS — all tests green, including the pre-existing `requireAdmin` tests (unaffected by the export change).

- [ ] **Step 6: Commit**

```bash
git add src/lib/supabase/admin-auth.ts src/lib/supabase/admin-auth.test.ts
git commit -m "refactor: export getCallerRole as the single admin-role-check source of truth"
```

---

### Task 2: Consolidate `src/lib/supabase/middleware.ts`

**Files:**
- Modify: `src/lib/supabase/middleware.ts:39-56`

**Interfaces:**
- Consumes: `getCallerRole(userId: string): Promise<string | null>` from Task 1 (`@/lib/supabase/admin-auth`).

Current code (the duplicated block):

```typescript
    // Use service role key for admin check to bypass RLS reliably in Edge runtime
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const profileRes = await fetch(
      `${supabaseUrl}/rest/v1/profiles?id=eq.${user.id}&select=role&limit=1`,
      {
        headers: {
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`,
        },
      }
    );
    const profiles = profileRes.ok ? await profileRes.json() : [];
    const role = profiles?.[0]?.role;

    if (role !== "admin") {
      return NextResponse.redirect(new URL("/account", request.url));
    }
```

- [ ] **Step 1: Apply the fix**

Replace with:

```typescript
    const role = await getCallerRole(user.id);

    if (role !== "admin") {
      return NextResponse.redirect(new URL("/account", request.url));
    }
```

Add the import at the top of the file:

```typescript
import { getCallerRole } from "./admin-auth";
```

(relative import — `middleware.ts` already lives in `src/lib/supabase/`, same directory as `admin-auth.ts`.)

- [ ] **Step 2: Manual verification (Edge runtime compatibility)**

Run: `npm run dev`, then in the browser:
1. Visit `/admin` while logged out → should redirect to `/login` (unchanged, this path doesn't touch `getCallerRole`).
2. Log in as a non-admin customer, visit `/admin` → should redirect to `/account` (exercises the new `getCallerRole` call inside middleware).
3. Log in as the admin (owner) account, visit `/admin` → should load normally.

Expected: middleware runs without an Edge-runtime import error (confirms `getCallerRole` has no `next/headers` dependency), and all three redirect/allow behaviors match pre-change behavior exactly.

- [ ] **Step 3: Commit**

```bash
git add src/lib/supabase/middleware.ts
git commit -m "refactor: use shared getCallerRole in middleware admin gate"
```

---

### Task 3: Consolidate `src/app/api/admin/admins/route.ts`

**Files:**
- Modify: `src/app/api/admin/admins/route.ts`
- Test: `src/app/api/admin/admins/route.test.ts` (new — this route currently has no test file)

This route's local `getCallerRole` (lines 8-15) is used identically in `GET`, `POST`, and `DELETE`. Unlike the shared version, it has **no try/catch** — a network failure here throws unhandled, whereas the shared helper fails closed. This is exactly the drift the audit flagged.

**Interfaces:**
- Consumes: `getCallerRole(userId: string): Promise<string | null>` from Task 1 (`@/lib/supabase/admin-auth`).

- [ ] **Step 1: Write the failing test**

Create `src/app/api/admin/admins/route.test.ts`:

```typescript
/**
 * @jest-environment node
 */
const mockGetUser = jest.fn();
jest.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getUser: mockGetUser } }),
}));

const mockGetCallerRole = jest.fn();
jest.mock("@/lib/supabase/admin-auth", () => ({
  getCallerRole: (...args: unknown[]) => mockGetCallerRole(...args),
}));

import { NextRequest } from "next/server";
import { GET } from "@/app/api/admin/admins/route";

afterEach(() => jest.clearAllMocks());

describe("GET /api/admin/admins", () => {
  it("401 when no session", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    const response = await GET();
    expect(response.status).toBe(401);
    expect(mockGetCallerRole).not.toHaveBeenCalled();
  });

  it("403 when caller role resolves to null (fails closed on lookup failure)", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u1" } } });
    mockGetCallerRole.mockResolvedValue(null);
    const response = await GET();
    expect(response.status).toBe(403);
  });

  it("403 when caller is not an admin", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u1" } } });
    mockGetCallerRole.mockResolvedValue("customer");
    const response = await GET();
    expect(response.status).toBe(403);
  });
});
```

Note: this test only covers `GET`'s auth gate (the shared concern this task is fixing). `POST`/`DELETE`'s existing business logic (owner protection, last-admin check) is unchanged and untested here — out of scope for this consolidation task.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/app/api/admin/admins/route.test.ts`
Expected: FAIL — `@/lib/supabase/admin-auth` mock target doesn't match current route (it doesn't import `getCallerRole` yet), or the local `getCallerRole` shadows the mock.

- [ ] **Step 3: Apply the fix**

Replace the whole top of `src/app/api/admin/admins/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const OWNER_EMAIL = "alan.chettiar.77@gmail.com";

async function getCallerRole(userId: string): Promise<string | null> {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}&select=role&limit=1`,
    { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` }, cache: "no-store" }
  );
  const rows = res.ok ? await res.json() : [];
  return rows?.[0]?.role ?? null;
}
```

with:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCallerRole } from "@/lib/supabase/admin-auth";

const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const OWNER_EMAIL = "alan.chettiar.77@gmail.com";
```

Leave every call site (`await getCallerRole(user.id)` — appears three times, once each in `GET`/`POST`/`DELETE`) untouched; they already call it as a bare function, which now resolves to the imported shared helper.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/app/api/admin/admins/route.test.ts`
Expected: PASS — all 3 tests green.

- [ ] **Step 5: Manual verification**

Run: `npm run dev`, log in as admin, visit `/admin/admins`, confirm the admin list still loads and add/remove still works (business logic untouched, only the role-check source changed).

- [ ] **Step 6: Commit**

```bash
git add "src/app/api/admin/admins/route.ts" "src/app/api/admin/admins/route.test.ts"
git commit -m "refactor: use shared getCallerRole in admins management route, add auth-gate tests"
```

---

### Task 4: Consolidate `src/app/api/auth/role/route.ts`

**Files:**
- Modify: `src/app/api/auth/role/route.ts`

Current code:

```typescript
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ role: null }, { status: 401 });

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;

  const res = await fetch(
    `${supabaseUrl}/rest/v1/profiles?id=eq.${user.id}&select=role&limit=1`,
    {
      headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
      cache: "no-store",
    }
  );

  const rows = res.ok ? await res.json() : [];
  const role = rows?.[0]?.role ?? "customer";

  return NextResponse.json({ role });
}
```

**Interfaces:**
- Consumes: `getCallerRole(userId: string): Promise<string | null>` from Task 1 (`@/lib/supabase/admin-auth`).

Note the existing behavior difference to preserve: this route defaults an unknown/null role to `"customer"` (not `null`) when a session exists — `getCallerRole` returns `null` in that case, so the route must apply its own `?? "customer"` fallback on the result, same as today.

- [ ] **Step 1: Apply the fix**

```typescript
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCallerRole } from "@/lib/supabase/admin-auth";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ role: null }, { status: 401 });

  const role = (await getCallerRole(user.id)) ?? "customer";

  return NextResponse.json({ role });
}
```

- [ ] **Step 2: Manual verification**

Run: `npm run dev`, log in as any user, open browser devtools Network tab, confirm `GET /api/auth/role` still returns `{"role": "admin"}` or `{"role": "customer"}` as appropriate (whatever it returned before this change for that account).

- [ ] **Step 3: Commit**

```bash
git add "src/app/api/auth/role/route.ts"
git commit -m "refactor: use shared getCallerRole in /api/auth/role"
```

---

### Task 5: Consolidate `src/app/(auth)/redirect/page.tsx`

**Files:**
- Modify: `src/app/(auth)/redirect/page.tsx`

Current code:

```typescript
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSafeRedirect } from "@/lib/utils";

export default async function AuthRedirectPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;

  const profileRes = await fetch(
    `${supabaseUrl}/rest/v1/profiles?id=eq.${user.id}&select=role&limit=1`,
    {
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
      },
      cache: "no-store",
    }
  );

  const profiles = profileRes.ok ? await profileRes.json() : [];
  const role = profiles?.[0]?.role;

  const params = await searchParams;

  if (role === "admin") {
    redirect("/admin");
  } else {
    const target = params.redirect ? decodeURIComponent(params.redirect) : null;
    redirect(getSafeRedirect(target, "/account"));
  }
}
```

**Interfaces:**
- Consumes: `getCallerRole(userId: string): Promise<string | null>` from Task 1 (`@/lib/supabase/admin-auth`).

- [ ] **Step 1: Apply the fix**

```typescript
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSafeRedirect } from "@/lib/utils";
import { getCallerRole } from "@/lib/supabase/admin-auth";

export default async function AuthRedirectPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const role = await getCallerRole(user.id);
  const params = await searchParams;

  if (role === "admin") {
    redirect("/admin");
  } else {
    const target = params.redirect ? decodeURIComponent(params.redirect) : null;
    redirect(getSafeRedirect(target, "/account"));
  }
}
```

- [ ] **Step 2: Manual verification**

Run: `npm run dev`, visit `/auth/redirect` as an admin → lands on `/admin`; as a customer → lands on `/account` (or the safe `redirect` param target). Matches Task 5 of the prior open-redirect plan's verification steps.

- [ ] **Step 3: Commit**

```bash
git add "src/app/(auth)/redirect/page.tsx"
git commit -m "refactor: use shared getCallerRole in /auth/redirect"
```

---

### Task 6: Update `SECURITY.md` and `AUTH_AUDIT.md`

**Files:**
- Modify: `SECURITY.md`
- Modify: `AUTH_AUDIT.md`

- [ ] **Step 1: Add a row to `SECURITY.md`'s fixed-vulnerabilities table**

```markdown
| 2026-07-20 | Admin role-check logic duplicated 5x (drift risk — one copy wasn't fail-closed) | Consolidated to exported `getCallerRole()` in `admin-auth.ts`, used by all 5 call sites |
```

- [ ] **Step 2: Update `SECURITY.md`'s Authorization model section**

The existing line `**Central helper:** requireAdmin() ... **Never duplicate role checks inline.**` should get one clause added noting `getCallerRole()` is now the shared primitive `requireAdmin()` and all other role-check call sites build on:

```markdown
- **Central helpers:** `requireAdmin()` (route/server-component guard) and the exported `getCallerRole()` it wraps (`src/lib/supabase/admin-auth.ts`) — the only two admin-role primitives. `requireAdmin()` for full auth+role gating in routes; `getCallerRole()` directly when you already have a `user.id` and just need the role (middleware, `/api/auth/role`, `/auth/redirect`). **Never duplicate the fetch-and-compare logic inline.**
```

- [ ] **Step 3: Mark Finding #3 resolved in `AUTH_AUDIT.md`**

Below Finding #3's "Fix direction" line, add:

```markdown
**Status: fixed 2026-07-20** — `getCallerRole()` exported from `admin-auth.ts`; `middleware.ts`, `admins/route.ts`, `role/route.ts`, and `redirect/page.tsx` all consolidated onto it. See `SECURITY.md`.
```

- [ ] **Step 4: Commit**

```bash
git add SECURITY.md AUTH_AUDIT.md
git commit -m "docs: record admin role-check consolidation in SECURITY.md and AUTH_AUDIT.md"
```

---

## Self-Review

**Spec coverage:** All 5 duplicate sites named in Finding #3 (`admin-auth.ts` internal, `middleware.ts`, `admins/route.ts`, `role/route.ts`, `redirect/page.tsx`) are covered — Task 1 makes the first canonical and exported, Tasks 2-5 migrate the other four.

**Placeholder scan:** No TBD/TODO. Task 3 explicitly scopes out what it's NOT testing (POST/DELETE business logic) rather than hand-waving full coverage.

**Type consistency:** `getCallerRole(userId: string): Promise<string | null>` signature is identical across every consuming task (2-5), matching Task 1's definition exactly. `role/route.ts` (Task 4) is the only site that needs a local `?? "customer"` fallback since its external contract (API response shape) differs from the others — called out explicitly so the implementer doesn't silently change API behavior.
