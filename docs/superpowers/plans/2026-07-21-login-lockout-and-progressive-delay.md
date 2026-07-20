# Login Lockout and Progressive Delay Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close `AUTH_AUDIT.md` Finding #4 — the login rate limiter is in-memory, per-serverless-instance, and resets on cold start, so there is no real ceiling on credential-stuffing against a single account. Add a Supabase-table-backed **per-account** lockout (5 consecutive failures → 15-minute lock) and progressive response delay, without touching the existing per-IP in-memory limiter (that one is a separate, lower-severity concern already documented as an accepted soft deterrent).

**Architecture:** New `login_attempts` table, written through a new repository (`login-attempt-repository.ts`, raw `fetch` + service-role key, matching `audit-repository.ts`'s exact pattern) and a new service (`login-throttle-service.ts`, matching `audit-service.ts`'s thin-wrapper pattern). `POST /api/auth/login` calls the service before and after each Supabase `signInWithPassword` call. Lockout state is derived from the last 5 attempt rows per identifier — no separate "locked_until" column, no new cron job beyond a housekeeping row-expiry job matching the existing `release-expired-reservations` pattern.

**Tech Stack:** TypeScript, Jest, Supabase Postgres + PostgREST + pg_cron, Next.js Route Handlers.

## Global Constraints

- Never reveal via response shape/status/message whether an account exists, whether the password was wrong, or whether the account is locked — every failure path (wrong password, unknown email, locked account) returns the exact same `401 {"error": "Invalid email or password"}` already used today.
- Do not touch the existing per-IP `checkRateLimit` call in `login/route.ts` — that stays exactly as-is.
- Send the "account locked" reset-link email at most once per lockout event (not on every subsequent blocked attempt), to avoid turning the lockout into an email-bombing vector against the real account holder.
- No new dependencies (no Upstash — Supabase table chosen per user decision).
- This migration must be applied manually in the Supabase SQL Editor by the user (no live DB access in this session) — call this out explicitly, matching the note already used for migration 007.

---

### Task 1: `login_attempts` table + cleanup cron

**Files:**
- Create: `supabase/migrations/009_login_attempts.sql`

```sql
-- supabase/migrations/009_login_attempts.sql
--
-- Backs AUTH_AUDIT.md Finding #4: the existing per-IP rate limiter
-- (src/lib/rate-limit.ts) is in-memory and resets per serverless instance,
-- so it's not a real ceiling. This table lets the login route enforce a
-- real per-account lockout (5 consecutive failures -> 15 min lock) that
-- survives cold starts, matching the audit-logs table's access pattern
-- (service-role only, no anon/authenticated access).

CREATE TABLE IF NOT EXISTS public.login_attempts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  identifier TEXT NOT NULL,
  ip TEXT NOT NULL,
  succeeded BOOLEAN NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_login_attempts_identifier_created
  ON public.login_attempts (identifier, created_at DESC);

ALTER TABLE public.login_attempts ENABLE ROW LEVEL SECURITY;

-- No policies: service-role key bypasses RLS entirely (same pattern as audit_logs).
-- REVOKE ensures anon/authenticated can never read or write attempt history directly.
REVOKE ALL ON public.login_attempts FROM PUBLIC, anon, authenticated;

-- Housekeeping: attempt rows are only ever queried within the last 5 rows /
-- 15 minutes per identifier, so anything older than 24h is dead weight.
-- Matches the release-expired-reservations cron pattern from migration 004.
CREATE OR REPLACE FUNCTION public.cleanup_old_login_attempts()
RETURNS void AS $$
BEGIN
  DELETE FROM public.login_attempts WHERE created_at < NOW() - INTERVAL '24 hours';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

SELECT cron.schedule(
  'cleanup-old-login-attempts',
  '0 * * * *',
  $$SELECT public.cleanup_old_login_attempts();$$
);
```

- [ ] **Step 1: Create the migration file** with the exact contents above.

- [ ] **Step 2: Manual application (cannot be done from this session)**

Tell the user: paste this migration into the Supabase SQL Editor and run it, same as migration 007/008. `pg_cron` extension is already enabled (migration 004), so `cron.schedule` will work without re-creating the extension.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/009_login_attempts.sql
git commit -m "feat: add login_attempts table + cleanup cron for account lockout"
```

---

### Task 2: `login-attempt-repository.ts`

**Files:**
- Create: `src/lib/repositories/login-attempt-repository.ts`
- Test: `src/lib/repositories/login-attempt-repository.test.ts`

**Interfaces:**
- Produces:
  - `recordLoginAttempt(input: { identifier: string; ip: string; succeeded: boolean }): Promise<void>`
  - `getRecentAttempts(identifier: string, limit: number): Promise<Array<{ succeeded: boolean; created_at: string }>>`

- [ ] **Step 1: Write the failing tests**

```typescript
// src/lib/repositories/login-attempt-repository.test.ts
const originalFetch = global.fetch;

import { recordLoginAttempt, getRecentAttempts } from "./login-attempt-repository";

describe("recordLoginAttempt", () => {
  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it("POSTs to the login_attempts REST endpoint with the given fields", async () => {
    const mockFetch = jest.fn().mockResolvedValue({ ok: true });
    global.fetch = mockFetch as unknown as typeof fetch;

    await recordLoginAttempt({ identifier: "a@b.com", ip: "1.2.3.4", succeeded: false });

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/rest/v1/login_attempts"),
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ identifier: "a@b.com", ip: "1.2.3.4", succeeded: false }),
      })
    );
  });

  it("throws when the insert fails, so the caller can decide how to handle it", async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 500 }) as unknown as typeof fetch;
    await expect(
      recordLoginAttempt({ identifier: "a@b.com", ip: "1.2.3.4", succeeded: false })
    ).rejects.toThrow();
  });
});

describe("getRecentAttempts", () => {
  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it("GETs the last N attempts for an identifier, ordered newest first", async () => {
    const rows = [
      { succeeded: false, created_at: "2026-07-21T10:05:00Z" },
      { succeeded: false, created_at: "2026-07-21T10:04:00Z" },
    ];
    const mockFetch = jest.fn().mockResolvedValue({ ok: true, json: async () => rows });
    global.fetch = mockFetch as unknown as typeof fetch;

    const result = await getRecentAttempts("a@b.com", 5);

    expect(result).toEqual(rows);
    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toContain("identifier=eq.a%40b.com");
    expect(url).toContain("order=created_at.desc");
    expect(url).toContain("limit=5");
  });

  it("returns an empty array when the request fails", async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false }) as unknown as typeof fetch;
    expect(await getRecentAttempts("a@b.com", 5)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest src/lib/repositories/login-attempt-repository.test.ts`
Expected: FAIL — module `./login-attempt-repository` doesn't exist yet.

- [ ] **Step 3: Implement the repository**

```typescript
// src/lib/repositories/login-attempt-repository.ts
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;

export interface RecordLoginAttemptInput {
  identifier: string;
  ip: string;
  succeeded: boolean;
}

export async function recordLoginAttempt(input: RecordLoginAttemptInput): Promise<void> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/login_attempts`, {
    method: "POST",
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(`Failed to record login attempt: ${res.status}`);
}

export interface LoginAttemptRow {
  succeeded: boolean;
  created_at: string;
}

export async function getRecentAttempts(identifier: string, limit: number): Promise<LoginAttemptRow[]> {
  const params = new URLSearchParams();
  params.set("identifier", `eq.${identifier}`);
  params.set("select", "succeeded,created_at");
  params.set("order", "created_at.desc");
  params.set("limit", String(limit));

  const res = await fetch(`${SUPABASE_URL}/rest/v1/login_attempts?${params.toString()}`, {
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
    cache: "no-store",
  });
  if (!res.ok) return [];
  return res.json();
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest src/lib/repositories/login-attempt-repository.test.ts`
Expected: PASS — all 4 tests green.

- [ ] **Step 5: Commit**

```bash
git add src/lib/repositories/login-attempt-repository.ts src/lib/repositories/login-attempt-repository.test.ts
git commit -m "feat: add login_attempts repository"
```

---

### Task 3: `login-throttle-service.ts`

**Files:**
- Create: `src/lib/services/login-throttle-service.ts`
- Test: `src/lib/services/login-throttle-service.test.ts`

**Interfaces:**
- Consumes: `getRecentAttempts`, `recordLoginAttempt` from Task 2 (`@/lib/repositories/login-attempt-repository`).
- Produces:
  - `isLocked(identifier: string): Promise<boolean>` — true iff the last 5 attempts for this identifier all failed AND the most recent one was within the last 15 minutes.
  - `getProgressiveDelayMs(identifier: string): Promise<number>` — delay scaled to the current trailing-consecutive-failure count (0 fails -> 0ms, 1 -> 300ms, 2 -> 700ms, 3 -> 1500ms, 4+ -> 3000ms), computed from the same last-5 lookup.
  - `recordAttemptResult(identifier: string, ip: string, succeeded: boolean): Promise<void>` — thin pass-through to `recordLoginAttempt`, never throws (matches `recordAuditLog`'s "must not break the caller" contract).

Lockout window and thresholds are named constants, not magic numbers:

```typescript
const LOCKOUT_THRESHOLD = 5;
const LOCKOUT_WINDOW_MS = 15 * 60 * 1000;
const DELAY_SCHEDULE_MS = [0, 300, 700, 1500, 3000];
```

- [ ] **Step 1: Write the failing tests**

```typescript
// src/lib/services/login-throttle-service.test.ts
const mockGetRecentAttempts = jest.fn();
const mockRecordLoginAttempt = jest.fn();
jest.mock("@/lib/repositories/login-attempt-repository", () => ({
  getRecentAttempts: (...args: unknown[]) => mockGetRecentAttempts(...args),
  recordLoginAttempt: (...args: unknown[]) => mockRecordLoginAttempt(...args),
}));

import { isLocked, getProgressiveDelayMs, recordAttemptResult } from "./login-throttle-service";

afterEach(() => jest.clearAllMocks());

describe("isLocked", () => {
  it("false when fewer than 5 attempts exist", async () => {
    mockGetRecentAttempts.mockResolvedValue([
      { succeeded: false, created_at: new Date().toISOString() },
    ]);
    expect(await isLocked("a@b.com")).toBe(false);
  });

  it("false when the last 5 include a success", async () => {
    const now = Date.now();
    mockGetRecentAttempts.mockResolvedValue([
      { succeeded: true, created_at: new Date(now).toISOString() },
      { succeeded: false, created_at: new Date(now - 1000).toISOString() },
      { succeeded: false, created_at: new Date(now - 2000).toISOString() },
      { succeeded: false, created_at: new Date(now - 3000).toISOString() },
      { succeeded: false, created_at: new Date(now - 4000).toISOString() },
    ]);
    expect(await isLocked("a@b.com")).toBe(false);
  });

  it("true when the last 5 are all failures within the last 15 minutes", async () => {
    const now = Date.now();
    mockGetRecentAttempts.mockResolvedValue(
      Array.from({ length: 5 }, (_, i) => ({
        succeeded: false,
        created_at: new Date(now - i * 1000).toISOString(),
      }))
    );
    expect(await isLocked("a@b.com")).toBe(true);
  });

  it("false when the last 5 are all failures but the most recent is older than 15 minutes", async () => {
    const old = Date.now() - 16 * 60 * 1000;
    mockGetRecentAttempts.mockResolvedValue(
      Array.from({ length: 5 }, (_, i) => ({
        succeeded: false,
        created_at: new Date(old - i * 1000).toISOString(),
      }))
    );
    expect(await isLocked("a@b.com")).toBe(false);
  });
});

describe("getProgressiveDelayMs", () => {
  it("0ms with no prior failures", async () => {
    mockGetRecentAttempts.mockResolvedValue([]);
    expect(await getProgressiveDelayMs("a@b.com")).toBe(0);
  });

  it("scales up with trailing consecutive failures", async () => {
    const now = Date.now();
    mockGetRecentAttempts.mockResolvedValue([
      { succeeded: false, created_at: new Date(now).toISOString() },
      { succeeded: false, created_at: new Date(now - 1000).toISOString() },
    ]);
    expect(await getProgressiveDelayMs("a@b.com")).toBe(700);
  });

  it("stops counting at the most recent success", async () => {
    const now = Date.now();
    mockGetRecentAttempts.mockResolvedValue([
      { succeeded: false, created_at: new Date(now).toISOString() },
      { succeeded: true, created_at: new Date(now - 1000).toISOString() },
      { succeeded: false, created_at: new Date(now - 2000).toISOString() },
    ]);
    expect(await getProgressiveDelayMs("a@b.com")).toBe(300);
  });

  it("caps at the last entry in the delay schedule", async () => {
    const now = Date.now();
    mockGetRecentAttempts.mockResolvedValue(
      Array.from({ length: 5 }, (_, i) => ({
        succeeded: false,
        created_at: new Date(now - i * 1000).toISOString(),
      }))
    );
    expect(await getProgressiveDelayMs("a@b.com")).toBe(3000);
  });
});

describe("recordAttemptResult", () => {
  it("never throws even when the repository write fails", async () => {
    mockRecordLoginAttempt.mockRejectedValue(new Error("db down"));
    await expect(recordAttemptResult("a@b.com", "1.2.3.4", false)).resolves.toBeUndefined();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest src/lib/services/login-throttle-service.test.ts`
Expected: FAIL — module doesn't exist yet.

- [ ] **Step 3: Implement the service**

```typescript
// src/lib/services/login-throttle-service.ts
import { getRecentAttempts, recordLoginAttempt } from "@/lib/repositories/login-attempt-repository";

const LOCKOUT_THRESHOLD = 5;
const LOCKOUT_WINDOW_MS = 15 * 60 * 1000;
const DELAY_SCHEDULE_MS = [0, 300, 700, 1500, 3000];

/**
 * Counts trailing consecutive failures from most-recent backward, stopping at the
 * first success or the end of the list. This is "consecutive" lockout semantics,
 * not a rolling-window count — a single success resets the streak immediately.
 */
function countTrailingFailures(attempts: Array<{ succeeded: boolean }>): number {
  let count = 0;
  for (const attempt of attempts) {
    if (attempt.succeeded) break;
    count += 1;
  }
  return count;
}

export async function isLocked(identifier: string): Promise<boolean> {
  const attempts = await getRecentAttempts(identifier, LOCKOUT_THRESHOLD);
  if (attempts.length < LOCKOUT_THRESHOLD) return false;
  if (attempts.some((a) => a.succeeded)) return false;

  const mostRecent = new Date(attempts[0].created_at).getTime();
  return Date.now() - mostRecent < LOCKOUT_WINDOW_MS;
}

export async function getProgressiveDelayMs(identifier: string): Promise<number> {
  const attempts = await getRecentAttempts(identifier, LOCKOUT_THRESHOLD);
  const streak = countTrailingFailures(attempts);
  const index = Math.min(streak, DELAY_SCHEDULE_MS.length - 1);
  return DELAY_SCHEDULE_MS[index];
}

/**
 * Never throws — a failed attempt-history write must not break the login flow itself,
 * matching recordAuditLog's contract in audit-service.ts.
 */
export async function recordAttemptResult(
  identifier: string,
  ip: string,
  succeeded: boolean
): Promise<void> {
  try {
    await recordLoginAttempt({ identifier, ip, succeeded });
  } catch (error) {
    console.error("Failed to record login attempt", error);
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest src/lib/services/login-throttle-service.test.ts`
Expected: PASS — all 9 tests green.

- [ ] **Step 5: Commit**

```bash
git add src/lib/services/login-throttle-service.ts src/lib/services/login-throttle-service.test.ts
git commit -m "feat: add login-throttle-service (lockout + progressive delay)"
```

---

### Task 4: Wire lockout + delay into `POST /api/auth/login`

**Files:**
- Modify: `src/app/api/auth/login/route.ts`
- Modify: `src/app/api/auth/login/auth-routes.test.ts` (extend existing login tests)

**Interfaces:**
- Consumes: `isLocked`, `getProgressiveDelayMs`, `recordAttemptResult` from Task 3 (`@/lib/services/login-throttle-service`).

Current code:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { recordAuditLog } from "@/lib/services/audit-service";
import { loginSchema } from "@/lib/validation/auth";

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for") ?? "unknown";
  const rl = checkRateLimit(`auth-login:${ip}`, 10, 60_000);
  if (!rl.allowed) return rateLimitResponse(rl.resetAt);

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    json = null;
  }

  const parsed = loginSchema.safeParse(json);
  if (!parsed.success) {
    console.warn("auth.login validation failed", {
      ip,
      fields: parsed.error.issues.map((i) => i.path.join(".")),
    });
    await recordAuditLog({
      action: "auth.validation_failed",
      tableName: "auth",
      newValues: { ip, route: "login" },
    });
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error) {
    await recordAuditLog({
      action: "auth.login_failed",
      tableName: "auth",
      newValues: { ip },
    });
    return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
  }

  return NextResponse.json({ success: true });
}
```

- [ ] **Step 1: Write the failing tests** (append to `src/app/api/auth/login/auth-routes.test.ts`)

Add these mocks alongside the existing ones at the top of the file:

```typescript
const mockIsLocked = jest.fn();
const mockGetProgressiveDelayMs = jest.fn();
const mockRecordAttemptResult = jest.fn();
jest.mock("@/lib/services/login-throttle-service", () => ({
  isLocked: (...args: unknown[]) => mockIsLocked(...args),
  getProgressiveDelayMs: (...args: unknown[]) => mockGetProgressiveDelayMs(...args),
  recordAttemptResult: (...args: unknown[]) => mockRecordAttemptResult(...args),
}));

const mockResetPasswordForEmail = jest.fn();
```

Update the existing `@/lib/supabase/server` mock to include `resetPasswordForEmail`:

```typescript
jest.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: {
      signInWithPassword: (...args: unknown[]) => mockSignIn(...args),
      signUp: (...args: unknown[]) => mockSignUp(...args),
      resetPasswordForEmail: (...args: unknown[]) => mockResetPasswordForEmail(...args),
    },
  }),
}));
```

Add `mockIsLocked.mockResolvedValue(false)` and `mockGetProgressiveDelayMs.mockResolvedValue(0)` to the existing `beforeEach` so pre-existing tests keep passing unchanged:

```typescript
beforeEach(() => {
  mockCheckRateLimit.mockReturnValue({ allowed: true, remaining: 9, resetAt: Date.now() + 60_000 });
  mockIsLocked.mockResolvedValue(false);
  mockGetProgressiveDelayMs.mockResolvedValue(0);
});
```

Add these new test cases inside `describe("POST /api/auth/login", ...)`:

```typescript
  it("401 generic error when the account is locked, without calling signInWithPassword", async () => {
    mockIsLocked.mockResolvedValue(true);
    const response = await login(req("login", { email: "a@b.com", password: "whatever1" }));
    const body = await response.json();
    expect(response.status).toBe(401);
    expect(body).toEqual({ error: "Invalid email or password" });
    expect(mockSignIn).not.toHaveBeenCalled();
    expect(mockRecordAttemptResult).toHaveBeenCalledWith("a@b.com", expect.any(String), false);
  });

  it("does not resend the lockout email on repeated blocked attempts while already locked", async () => {
    mockIsLocked.mockResolvedValue(true);
    await login(req("login", { email: "a@b.com", password: "whatever1" }));
    expect(mockResetPasswordForEmail).not.toHaveBeenCalled();
  });

  it("sends a reset-link email exactly once when a failed attempt newly triggers lockout", async () => {
    mockIsLocked.mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    mockSignIn.mockResolvedValue({ error: { message: "Invalid login credentials" } });
    await login(req("login", { email: "a@b.com", password: "wrongpass" }));
    expect(mockResetPasswordForEmail).toHaveBeenCalledTimes(1);
    expect(mockResetPasswordForEmail).toHaveBeenCalledWith("a@b.com");
  });

  it("does not send a lockout email on an ordinary (non-locking) failed attempt", async () => {
    mockIsLocked.mockResolvedValue(false);
    mockSignIn.mockResolvedValue({ error: { message: "Invalid login credentials" } });
    await login(req("login", { email: "a@b.com", password: "wrongpass" }));
    expect(mockResetPasswordForEmail).not.toHaveBeenCalled();
  });

  it("records a successful attempt on successful login", async () => {
    mockSignIn.mockResolvedValue({ error: null });
    await login(req("login", { email: "a@b.com", password: "secret1" }));
    expect(mockRecordAttemptResult).toHaveBeenCalledWith("a@b.com", expect.any(String), true);
  });
```

- [ ] **Step 2: Run tests to verify the new ones fail**

Run: `npx jest src/app/api/auth/login/auth-routes.test.ts`
Expected: FAIL on the 5 new tests — `login-throttle-service` isn't wired into the route yet.

- [ ] **Step 3: Implement the route changes**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { recordAuditLog } from "@/lib/services/audit-service";
import { loginSchema } from "@/lib/validation/auth";
import { isLocked, getProgressiveDelayMs, recordAttemptResult } from "@/lib/services/login-throttle-service";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Server-side login. Validates on the server regardless of client checks,
 * returns only generic errors (no field-level detail, no user enumeration),
 * and sets the Supabase session cookies via the SSR client.
 *
 * Per-account lockout (5 consecutive failures / 15 min) is layered on top of
 * the existing per-IP rate limit below — the two guard different things and
 * neither replaces the other. See AUTH_AUDIT.md Finding #4.
 */
export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for") ?? "unknown";
  const rl = checkRateLimit(`auth-login:${ip}`, 10, 60_000);
  if (!rl.allowed) return rateLimitResponse(rl.resetAt);

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    json = null;
  }

  const parsed = loginSchema.safeParse(json);
  if (!parsed.success) {
    console.warn("auth.login validation failed", {
      ip,
      fields: parsed.error.issues.map((i) => i.path.join(".")),
    });
    await recordAuditLog({
      action: "auth.validation_failed",
      tableName: "auth",
      newValues: { ip, route: "login" },
    });
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const { email, password } = parsed.data;
  const supabase = await createClient();

  if (await isLocked(email)) {
    await sleep(await getProgressiveDelayMs(email));
    await recordAttemptResult(email, ip, false);
    await recordAuditLog({
      action: "auth.login_blocked_locked",
      tableName: "auth",
      newValues: { ip },
    });
    // Same generic message as any other failure — never reveal lockout state.
    return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
  }

  await sleep(await getProgressiveDelayMs(email));

  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    await recordAttemptResult(email, ip, false);
    await recordAuditLog({
      action: "auth.login_failed",
      tableName: "auth",
      newValues: { ip },
    });

    // If this failure just pushed the account into lockout, send the reset-link
    // email exactly once (not on every subsequent blocked attempt — see the
    // isLocked() branch above, which never reaches this code path).
    if (await isLocked(email)) {
      try {
        await supabase.auth.resetPasswordForEmail(email);
      } catch (resetError) {
        console.error("Failed to send lockout reset email", resetError);
      }
    }

    return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
  }

  await recordAttemptResult(email, ip, true);
  return NextResponse.json({ success: true });
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest src/app/api/auth/login/auth-routes.test.ts`
Expected: PASS — all tests green (5 new + all pre-existing ones unchanged).

- [ ] **Step 5: Full suite + type-check**

Run: `npx jest --silent` and `npx tsc --noEmit`
Expected: all suites pass, zero type errors.

- [ ] **Step 6: Manual verification**

Run: `npm run dev`. Using a throwaway test account:
1. Fail login 4 times with the wrong password — each response should take slightly longer than the last (visible in Network tab timing), still returning the same generic message.
2. Fail a 5th time — same generic message, but confirm (via Supabase dashboard Auth logs or the test inbox) that a password-reset email was sent.
3. Immediately try again with the *correct* password — still rejected with the same generic message (account is locked, credentials aren't even checked).
4. Wait 15 minutes (or manually delete the account's rows from `login_attempts` in the Supabase table editor to simulate the window passing), then log in correctly — should succeed normally.

- [ ] **Step 7: Commit**

```bash
git add "src/app/api/auth/login/route.ts" "src/app/api/auth/login/auth-routes.test.ts"
git commit -m "feat: enforce per-account lockout and progressive delay on login"
```

---

### Task 5: Update `SECURITY.md` and `AUTH_AUDIT.md`

**Files:**
- Modify: `SECURITY.md`
- Modify: `AUTH_AUDIT.md`
- Modify: `TASKS.md` (note the manual migration-application step, matching the existing note for migration 007)

- [ ] **Step 1: Add to `SECURITY.md`'s Rate limiting section**

```markdown
**Account lockout:** `login_attempts` table (migration 009) + `login-throttle-service.ts` — 5 consecutive failed logins for the same email lock it for 15 minutes, independent of and in addition to the per-IP limiter above. Locked and wrong-password responses are byte-identical (`401 {"error": "Invalid email or password"}`) — never reveal lockout state. On the failure that triggers lockout, a Supabase password-reset email is sent to the account once (not resent on subsequent blocked attempts).
```

- [ ] **Step 2: Add a row to `SECURITY.md`'s fixed-vulnerabilities table**

```markdown
| 2026-07-21 | No per-account brute-force ceiling (only a soft per-IP, per-instance limiter) | `login_attempts` table + `login-throttle-service.ts`: 5-consecutive-failure / 15-min lockout with progressive delay |
```

- [ ] **Step 3: Mark Finding #4 resolved in `AUTH_AUDIT.md`**

Below Finding #4's "Fix direction" line, add:

```markdown
**Status: fixed 2026-07-21** — `login_attempts` table (migration 009) + `login-throttle-service.ts` add a real per-account lockout (5 consecutive failures / 15 min) with progressive delay, layered on top of the unchanged per-IP limiter. See `SECURITY.md`.
```

- [ ] **Step 4: Add a `TASKS.md` note**

Below the existing note about migration 007, add:

```markdown
> **Migration 009** (`login_attempts` table + cleanup cron) must be applied in the Supabase SQL Editor before account lockout works live — same manual-apply step as migration 007.
```

- [ ] **Step 5: Commit**

```bash
git add SECURITY.md AUTH_AUDIT.md TASKS.md
git commit -m "docs: record login lockout implementation in SECURITY.md, AUTH_AUDIT.md, TASKS.md"
```

---

## Self-Review

**Spec coverage:** Rate limiting (existing, untouched) + account lockout (Task 1-4) + progressive delay (Task 3-4) + "never reveal locked/wrong/nonexistent" (Task 4's identical response shape) + "send reset email after lockout" (Task 4's `isLocked` check post-failure) — all of Finding #4's requirements from the original Phase 4 spec are covered. Upstash was explicitly declined by the user in favor of a Supabase table.

**Placeholder scan:** No TBD/TODO. Task 4 Step 6 (manual verification) spells out exact steps including how to simulate the 15-minute window passing without waiting.

**Type consistency:** `isLocked(identifier: string): Promise<boolean>`, `getProgressiveDelayMs(identifier: string): Promise<number>`, `recordAttemptResult(identifier: string, ip: string, succeeded: boolean): Promise<void>` are used with identical signatures in Task 3's implementation and Task 4's route wiring. `getRecentAttempts(identifier: string, limit: number): Promise<LoginAttemptRow[]>` matches between Task 2 and Task 3.
