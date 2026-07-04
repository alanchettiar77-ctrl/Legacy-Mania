# FAQ System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the hardcoded `/faq` page with a database-driven FAQ system (Supabase table + RLS,
REST API routes, admin CRUD/reorder UI, public accordion page).

**Architecture:** A new `faqs` Postgres table (RLS: public reads active rows; all writes via
service-role-backed API routes). `GET /api/faqs` feeds the public page; `POST/PATCH/DELETE
/api/admin/faqs[/:id]` back the admin table, guarded by a shared `requireAdmin()` helper. Frontend
uses Radix Accordion (already a dependency) styled with the app's existing Tailwind design tokens.

**Tech Stack:** Next.js 16 (App Router) + TypeScript, Tailwind, `@supabase/ssr` /
`@supabase/supabase-js`, `@radix-ui/react-accordion`, `react-hook-form` + `zod`, `sonner` toasts,
Jest + Testing Library, Playwright + `@axe-core/playwright`.

## Global Constraints

- Follow existing conventions exactly: SQL in `UPPERCASE` keywords with `public.` schema prefix and
  `uuid_generate_v4()` (see `supabase/migrations/001_initial_schema.sql`).
- Supabase query results use explicit type casts (`as any` + local interfaces), not the `Database`
  generic on the client instance — but `src/types/supabase.ts` / `src/types/index.ts` are still kept
  in sync as the canonical type reference (they're consumed elsewhere via `@/types`).
- Admin API routes must implement their own auth guard — `/api/admin/*` is **not** covered by
  `src/lib/supabase/middleware.ts` (that middleware only matches paths starting with `/admin`, i.e.
  page routes, not `/api/admin/*`).
- Toast feedback via `sonner` (`import { toast } from "sonner"`), matching current admin components.
- No new UI framework: style Radix primitives directly with existing Tailwind tokens
  (`bg-card`, `border-border`, `text-foreground`, `text-muted-foreground`, `btn-primary`) — no
  shadcn scaffold.
- Do not modify `src/app/api/admin/admins/route.ts` — it stays exactly as-is.
- The 12 FAQ Q&As (verbatim text below) fully replace the old hardcoded array — no old content is
  kept.

---

### Task 1: Test infrastructure (Jest + Playwright)

No `jest.config.js` or `playwright.config.ts` exist yet, even though both are listed as
`devDependencies` and `package.json` already has `"test": "jest"` / `"test:e2e": "playwright test"`
scripts. This task wires up both runners so every later task's tests can actually execute.

**Files:**
- Create: `jest.config.js`
- Create: `jest.setup.ts`
- Create: `src/lib/utils.smoke.test.ts`
- Create: `playwright.config.ts`
- Create: `e2e/smoke.spec.ts`
- Modify: `package.json` (no script changes needed — scripts already exist)

**Interfaces:**
- Produces: a working `npm test` (Jest, `jsdom` environment by default, `@/*` path alias resolved)
  and a working `npm run test:e2e` (Playwright, against `next dev` on port 3000) that every
  subsequent task's tests build on.

- [ ] **Step 1: Create `jest.config.js`**

```js
const nextJest = require("next/jest");

const createJestConfig = nextJest({ dir: "./" });

/** @type {import('jest').Config} */
const customJestConfig = {
  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
  testEnvironment: "jest-environment-jsdom",
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
  },
  testPathIgnorePatterns: ["<rootDir>/.next/", "<rootDir>/node_modules/", "<rootDir>/e2e/"],
};

module.exports = createJestConfig(customJestConfig);
```

- [ ] **Step 2: Create `jest.setup.ts`**

```ts
import "@testing-library/jest-dom";
```

- [ ] **Step 3: Write a smoke test to verify Jest runs at all**

```ts
// src/lib/utils.smoke.test.ts
import { cn } from "@/lib/utils";

describe("jest infrastructure smoke test", () => {
  it("resolves the @/ path alias and runs a basic assertion", () => {
    expect(cn("a", false && "b", "c")).toBe("a c");
  });
});
```

- [ ] **Step 4: Run it**

Run: `npm test -- utils.smoke`
Expected: PASS — 1 passed test.

- [ ] **Step 5: Create `playwright.config.ts`**

```ts
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  retries: 0,
  reporter: "list",
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: true,
    timeout: 120_000,
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 5"] } },
  ],
});
```

- [ ] **Step 6: Write a Playwright smoke test**

```ts
// e2e/smoke.spec.ts
import { test, expect } from "@playwright/test";

test("homepage loads", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/Legacy Mania/i);
});
```

- [ ] **Step 7: Install Playwright's browser binaries (one-time) and run the smoke test**

Run: `npx playwright install --with-deps chromium`
Run: `npm run test:e2e -- smoke`
Expected: PASS — 2 passed tests (chromium + mobile projects), Next dev server auto-started.

- [ ] **Step 8: Commit**

```bash
git add jest.config.js jest.setup.ts src/lib/utils.smoke.test.ts playwright.config.ts e2e/smoke.spec.ts
git commit -m "test: add Jest and Playwright infrastructure"
```

---

### Task 2: Database migration + types

**Files:**
- Create: `supabase/migrations/002_faqs.sql`
- Modify: `src/types/supabase.ts`
- Modify: `src/types/index.ts`

**Interfaces:**
- Produces: `public.faqs` table (columns: `id`, `question`, `answer`, `display_order`, `is_active`,
  `created_at`, `updated_at`); TypeScript type `Faq` importable from `@/types`.

- [ ] **Step 1: Write the migration**

```sql
-- supabase/migrations/002_faqs.sql

-- ============================================================
-- FAQS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.faqs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.faqs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active faqs" ON public.faqs
  FOR SELECT USING (is_active = TRUE);

CREATE TRIGGER update_faqs_updated_at BEFORE UPDATE ON public.faqs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed FAQ content
INSERT INTO public.faqs (question, answer, display_order) VALUES
  ('What products does Legacy Mania sell?', 'Legacy Mania specializes in authentic collectible trading cards, anime merchandise, gaming collectibles, and pop culture memorabilia.', 0),
  ('Are all your products genuine?', 'Yes. Every product listed on Legacy Mania is carefully sourced and inspected before being listed for sale.', 1),
  ('Do you offer Cash on Delivery (COD)?', 'Currently, we only accept prepaid payments through supported payment methods.', 2),
  ('What payment methods do you accept?', 'We currently accept UPI payments and other payment methods that are displayed during checkout.', 3),
  ('How long does shipping take?', 'Orders are generally processed within 1-3 business days. Delivery timelines depend on your location and courier service.', 4),
  ('Can I cancel my order?', 'Orders can only be cancelled before they have been packed or dispatched. Please contact us immediately if you wish to cancel.', 5),
  ('Do you accept returns or refunds?', 'As Legacy Mania is an early-stage startup, we currently do not offer standard returns or refunds once an order has been placed. However, customer satisfaction is extremely important to us. If you have received the wrong item, a damaged product, or have any concerns regarding your order, please contact us directly on WhatsApp. Every request will be reviewed individually, and our team will do our best to assist you on a case-by-case basis.', 6),
  ('How can I contact Legacy Mania?', 'You can reach us through our Contact Us page or directly via WhatsApp for faster assistance.', 7),
  ('Are your trading cards original?', 'Yes. Product authenticity will always be mentioned in the product listing wherever applicable.', 8),
  ('Do you restock sold-out products?', 'Popular products may be restocked depending on supplier availability. Follow our social media channels for updates.', 9),
  ('Can I request specific collectibles?', 'Absolutely. Reach out to us through WhatsApp, and we''ll try our best to source the collectible you''re looking for.', 10),
  ('How can I stay updated?', 'Follow Legacy Mania on Instagram, Facebook, and YouTube for the latest launches, offers, and collectibles.', 11);
```

- [ ] **Step 2: Apply it to the live Supabase project**

Open the Supabase dashboard SQL Editor for the Legacy Mania project, paste the contents of
`supabase/migrations/002_faqs.sql`, and run it (same manual-apply convention used for
`001_initial_schema.sql` — there is no local Supabase CLI/config in this repo).
Verify: `select count(*) from public.faqs;` returns `12`.

- [ ] **Step 3: Add the `faqs` table to the `Database` type**

In `src/types/supabase.ts`, add a new entry alongside the existing `categories` entry (same shape
convention):

```ts
      faqs: {
        Row: {
          id: string;
          question: string;
          answer: string;
          display_order: number;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          question: string;
          answer: string;
          display_order?: number;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          question?: string;
          answer?: string;
          display_order?: number;
          is_active?: boolean;
          updated_at?: string;
        };
        Relationships: [];
      };
```

- [ ] **Step 4: Export the app-level type**

In `src/types/index.ts`, add next to the other `export type X = Database[...]` lines:

```ts
export type Faq = Database["public"]["Tables"]["faqs"]["Row"];
```

- [ ] **Step 5: Verify the project still typechecks**

Run: `npm run type-check`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/002_faqs.sql src/types/supabase.ts src/types/index.ts
git commit -m "feat: add faqs table, RLS policy, and seed data"
```

---

### Task 3: Shared FAQ validation schema

**Files:**
- Create: `src/lib/validation/faq.ts`
- Test: `src/lib/validation/faq.test.ts`

**Interfaces:**
- Produces: `faqCreateSchema` (Zod schema, `{ question: string; answer: string; display_order?: number }`),
  `faqUpdateSchema` (Zod schema, all fields optional: `{ question?, answer?, display_order?, is_active? }`),
  and inferred types `FaqCreateInput`, `FaqUpdateInput`. Consumed by both the API routes (Task 6/7)
  and the admin form (Task 10).

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/validation/faq.test.ts
import { faqCreateSchema, faqUpdateSchema } from "@/lib/validation/faq";

describe("faqCreateSchema", () => {
  it("accepts a valid question/answer pair", () => {
    const result = faqCreateSchema.safeParse({
      question: "Do you ship internationally?",
      answer: "Currently we only ship within India.",
    });
    expect(result.success).toBe(true);
  });

  it("rejects an empty question", () => {
    const result = faqCreateSchema.safeParse({ question: "  ", answer: "Some answer" });
    expect(result.success).toBe(false);
  });

  it("rejects an empty answer", () => {
    const result = faqCreateSchema.safeParse({ question: "Some question?", answer: "" });
    expect(result.success).toBe(false);
  });

  it("rejects a question over 500 characters", () => {
    const result = faqCreateSchema.safeParse({
      question: "a".repeat(501),
      answer: "Some answer",
    });
    expect(result.success).toBe(false);
  });
});

describe("faqUpdateSchema", () => {
  it("accepts a partial update with only is_active", () => {
    const result = faqUpdateSchema.safeParse({ is_active: false });
    expect(result.success).toBe(true);
  });

  it("accepts a partial update with only display_order", () => {
    const result = faqUpdateSchema.safeParse({ display_order: 3 });
    expect(result.success).toBe(true);
  });

  it("rejects a negative display_order", () => {
    const result = faqUpdateSchema.safeParse({ display_order: -1 });
    expect(result.success).toBe(false);
  });

  it("accepts an empty object (no-op update)", () => {
    const result = faqUpdateSchema.safeParse({});
    expect(result.success).toBe(true);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test -- faq.test`
Expected: FAIL — `Cannot find module '@/lib/validation/faq'`.

- [ ] **Step 3: Implement the schema**

```ts
// src/lib/validation/faq.ts
import { z } from "zod";

export const faqCreateSchema = z.object({
  question: z.string().trim().min(1, "Question is required").max(500, "Question is too long"),
  answer: z.string().trim().min(1, "Answer is required").max(5000, "Answer is too long"),
  display_order: z.number().int().min(0).optional(),
});

export const faqUpdateSchema = z.object({
  question: z.string().trim().min(1, "Question is required").max(500, "Question is too long").optional(),
  answer: z.string().trim().min(1, "Answer is required").max(5000, "Answer is too long").optional(),
  display_order: z.number().int().min(0).optional(),
  is_active: z.boolean().optional(),
});

export type FaqCreateInput = z.infer<typeof faqCreateSchema>;
export type FaqUpdateInput = z.infer<typeof faqUpdateSchema>;
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- faq.test`
Expected: PASS — 9 passed tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/validation/faq.ts src/lib/validation/faq.test.ts
git commit -m "feat: add shared FAQ validation schema"
```

---

### Task 4: `requireAdmin()` shared auth helper

Extracted from the auth-guard pattern already used in `src/app/api/admin/admins/route.ts` (not
modifying that file — new routes adopt this helper instead).

**Files:**
- Create: `src/lib/supabase/admin-auth.ts`
- Test: `src/lib/supabase/admin-auth.test.ts`

**Interfaces:**
- Produces:
```ts
type RequireAdminResult =
  | { ok: true; userId: string }
  | { ok: false; response: NextResponse };

export async function requireAdmin(): Promise<RequireAdminResult>
```
  Consumed by Task 6 and Task 7's route handlers as:
  ```ts
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;
  // auth.userId is available here
  ```

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/supabase/admin-auth.test.ts

const mockGetUser = jest.fn();
jest.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getUser: mockGetUser } }),
}));

const originalFetch = global.fetch;

import { requireAdmin } from "@/lib/supabase/admin-auth";

describe("requireAdmin", () => {
  afterEach(() => {
    jest.clearAllMocks();
    global.fetch = originalFetch;
  });

  it("returns ok:false with a 401 response when there is no session user", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });

    const result = await requireAdmin();

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(401);
    }
  });

  it("returns ok:false with a 403 response when the user is not an admin", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => [{ role: "customer" }],
    }) as unknown as typeof fetch;

    const result = await requireAdmin();

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(403);
    }
  });

  it("returns ok:true with the userId when the user is an admin", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "admin-1" } } });
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => [{ role: "admin" }],
    }) as unknown as typeof fetch;

    const result = await requireAdmin();

    expect(result).toEqual({ ok: true, userId: "admin-1" });
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test -- admin-auth.test`
Expected: FAIL — `Cannot find module '@/lib/supabase/admin-auth'`.

- [ ] **Step 3: Implement the helper**

```ts
// src/lib/supabase/admin-auth.ts
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;

type RequireAdminResult =
  | { ok: true; userId: string }
  | { ok: false; response: NextResponse };

async function getCallerRole(userId: string): Promise<string | null> {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}&select=role&limit=1`,
    { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` }, cache: "no-store" }
  );
  const rows = res.ok ? await res.json() : [];
  return rows?.[0]?.role ?? null;
}

export async function requireAdmin(): Promise<RequireAdminResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const role = await getCallerRole(user.id);
  if (role !== "admin") {
    return { ok: false, response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }

  return { ok: true, userId: user.id };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- admin-auth.test`
Expected: PASS — 3 passed tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/supabase/admin-auth.ts src/lib/supabase/admin-auth.test.ts
git commit -m "feat: add shared requireAdmin auth-guard helper"
```

---

### Task 5: `GET /api/faqs` (public)

**Files:**
- Create: `src/app/api/faqs/route.ts`
- Test: `src/app/api/faqs/route.test.ts`

**Interfaces:**
- Produces: `GET /api/faqs` → `200` with `Faq[]` body (active only, ordered by `display_order` asc),
  or `500` with `{ error: string }` on failure. No auth required.

- [ ] **Step 1: Write the failing test**

```ts
/**
 * @jest-environment node
 */
// src/app/api/faqs/route.test.ts

const mockOrder = jest.fn();
const mockEq = jest.fn(() => ({ order: mockOrder }));
const mockSelect = jest.fn(() => ({ eq: mockEq }));
const mockFrom = jest.fn(() => ({ select: mockSelect }));

jest.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ from: mockFrom }),
}));

import { GET } from "@/app/api/faqs/route";

describe("GET /api/faqs", () => {
  afterEach(() => jest.clearAllMocks());

  it("returns active faqs ordered by display_order", async () => {
    mockOrder.mockResolvedValue({
      data: [{ id: "1", question: "Q1", answer: "A1", display_order: 0, is_active: true }],
      error: null,
    });

    const response = await GET();
    const body = await response.json();

    expect(mockFrom).toHaveBeenCalledWith("faqs");
    expect(mockEq).toHaveBeenCalledWith("is_active", true);
    expect(mockOrder).toHaveBeenCalledWith("display_order", { ascending: true });
    expect(response.status).toBe(200);
    expect(body).toHaveLength(1);
  });

  it("returns a 500 with an error message when the query fails", async () => {
    mockOrder.mockResolvedValue({ data: null, error: { message: "db down" } });

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toBe("db down");
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test -- api/faqs/route.test`
Expected: FAIL — `Cannot find module '@/app/api/faqs/route'`.

- [ ] **Step 3: Implement the route**

```ts
// src/app/api/faqs/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;

  const { data, error } = await db
    .from("faqs")
    .select("*")
    .eq("is_active", true)
    .order("display_order", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data ?? []);
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- api/faqs/route.test`
Expected: PASS — 2 passed tests.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/faqs/route.ts src/app/api/faqs/route.test.ts
git commit -m "feat: add public GET /api/faqs route"
```

---

### Task 6: `POST /api/admin/faqs`

**Files:**
- Create: `src/app/api/admin/faqs/route.ts`
- Test: `src/app/api/admin/faqs/route.test.ts`

**Interfaces:**
- Consumes: `requireAdmin()` from Task 4, `faqCreateSchema` from Task 3.
- Produces: `POST /api/admin/faqs` → `201` with the created `Faq` row, `400` on validation failure,
  `401`/`403` from `requireAdmin()`, `500` on DB failure.

- [ ] **Step 1: Write the failing test**

```ts
/**
 * @jest-environment node
 */
// src/app/api/admin/faqs/route.test.ts

const mockRequireAdmin = jest.fn();
jest.mock("@/lib/supabase/admin-auth", () => ({
  requireAdmin: () => mockRequireAdmin(),
}));

const originalFetch = global.fetch;

import { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { POST } from "@/app/api/admin/faqs/route";

function makeRequest(body: unknown) {
  return new NextRequest("http://localhost/api/admin/faqs", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

describe("POST /api/admin/faqs", () => {
  afterEach(() => {
    jest.clearAllMocks();
    global.fetch = originalFetch;
  });

  it("returns the requireAdmin response when not authorized", async () => {
    const forbidden = NextResponse.json({ error: "Forbidden" }, { status: 403 });
    mockRequireAdmin.mockResolvedValue({ ok: false, response: forbidden });

    const response = await POST(makeRequest({ question: "Q?", answer: "A" }));

    expect(response.status).toBe(403);
  });

  it("returns 400 when the body fails validation", async () => {
    mockRequireAdmin.mockResolvedValue({ ok: true, userId: "admin-1" });

    const response = await POST(makeRequest({ question: "", answer: "A" }));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBeDefined();
  });

  it("creates a faq with the next display_order when valid", async () => {
    mockRequireAdmin.mockResolvedValue({ ok: true, userId: "admin-1" });
    global.fetch = jest
      .fn()
      // 1st call: fetch max display_order
      .mockResolvedValueOnce({ ok: true, json: async () => [{ display_order: 4 }] })
      // 2nd call: insert
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [{ id: "new-id", question: "Q?", answer: "A", display_order: 5, is_active: true }],
      }) as unknown as typeof fetch;

    const response = await POST(makeRequest({ question: "Q?", answer: "A" }));
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.display_order).toBe(5);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test -- api/admin/faqs/route.test`
Expected: FAIL — `Cannot find module '@/app/api/admin/faqs/route'`.

- [ ] **Step 3: Implement the route**

```ts
// src/app/api/admin/faqs/route.ts
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/supabase/admin-auth";
import { faqCreateSchema } from "@/lib/validation/faq";

const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const HEADERS = {
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
  "Content-Type": "application/json",
  Prefer: "return=representation",
};

export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const json = await req.json();
  const parsed = faqCreateSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  let displayOrder = parsed.data.display_order;
  if (displayOrder === undefined) {
    const maxRes = await fetch(
      `${SUPABASE_URL}/rest/v1/faqs?select=display_order&order=display_order.desc&limit=1`,
      { headers: HEADERS, cache: "no-store" }
    );
    const maxRows = maxRes.ok ? await maxRes.json() : [];
    displayOrder = (maxRows?.[0]?.display_order ?? -1) + 1;
  }

  const insertRes = await fetch(`${SUPABASE_URL}/rest/v1/faqs`, {
    method: "POST",
    headers: HEADERS,
    body: JSON.stringify({
      question: parsed.data.question,
      answer: parsed.data.answer,
      display_order: displayOrder,
    }),
  });

  if (!insertRes.ok) {
    return NextResponse.json({ error: "Failed to create FAQ" }, { status: 500 });
  }

  const created = await insertRes.json();
  return NextResponse.json(created[0], { status: 201 });
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- api/admin/faqs/route.test`
Expected: PASS — 3 passed tests.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/admin/faqs/route.ts src/app/api/admin/faqs/route.test.ts
git commit -m "feat: add POST /api/admin/faqs route"
```

---

### Task 7: `PATCH` / `DELETE` `/api/admin/faqs/:id`

**Files:**
- Create: `src/app/api/admin/faqs/[id]/route.ts`
- Test: `src/app/api/admin/faqs/[id]/route.test.ts`

**Interfaces:**
- Consumes: `requireAdmin()` (Task 4), `faqUpdateSchema` (Task 3).
- Produces: `PATCH /api/admin/faqs/:id` → `200` with updated `Faq`, `400`/`401`/`403`/`404`/`500`.
  `DELETE /api/admin/faqs/:id` → `200` with `{ success: true }`, `401`/`403`/`404`/`500`.

- [ ] **Step 1: Write the failing test**

```ts
/**
 * @jest-environment node
 */
// src/app/api/admin/faqs/[id]/route.test.ts

const mockRequireAdmin = jest.fn();
jest.mock("@/lib/supabase/admin-auth", () => ({
  requireAdmin: () => mockRequireAdmin(),
}));

const originalFetch = global.fetch;

import { NextRequest, NextResponse } from "next/server";
import { PATCH, DELETE } from "@/app/api/admin/faqs/[id]/route";

function makeRequest(method: string, body?: unknown) {
  return new NextRequest("http://localhost/api/admin/faqs/faq-1", {
    method,
    body: body ? JSON.stringify(body) : undefined,
  });
}

describe("PATCH /api/admin/faqs/:id", () => {
  afterEach(() => {
    jest.clearAllMocks();
    global.fetch = originalFetch;
  });

  it("returns the requireAdmin response when not authorized", async () => {
    const unauthorized = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    mockRequireAdmin.mockResolvedValue({ ok: false, response: unauthorized });

    const response = await PATCH(makeRequest("PATCH", { is_active: false }), {
      params: Promise.resolve({ id: "faq-1" }),
    });

    expect(response.status).toBe(401);
  });

  it("returns 400 on invalid body", async () => {
    mockRequireAdmin.mockResolvedValue({ ok: true, userId: "admin-1" });

    const response = await PATCH(makeRequest("PATCH", { display_order: -1 }), {
      params: Promise.resolve({ id: "faq-1" }),
    });

    expect(response.status).toBe(400);
  });

  it("updates the faq and returns 200", async () => {
    mockRequireAdmin.mockResolvedValue({ ok: true, userId: "admin-1" });
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => [{ id: "faq-1", question: "Q", answer: "A", display_order: 0, is_active: false }],
    }) as unknown as typeof fetch;

    const response = await PATCH(makeRequest("PATCH", { is_active: false }), {
      params: Promise.resolve({ id: "faq-1" }),
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.is_active).toBe(false);
  });

  it("returns 404 when the faq does not exist", async () => {
    mockRequireAdmin.mockResolvedValue({ ok: true, userId: "admin-1" });
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => [] }) as unknown as typeof fetch;

    const response = await PATCH(makeRequest("PATCH", { is_active: false }), {
      params: Promise.resolve({ id: "missing" }),
    });

    expect(response.status).toBe(404);
  });
});

describe("DELETE /api/admin/faqs/:id", () => {
  afterEach(() => {
    jest.clearAllMocks();
    global.fetch = originalFetch;
  });

  it("returns the requireAdmin response when not authorized", async () => {
    const forbidden = NextResponse.json({ error: "Forbidden" }, { status: 403 });
    mockRequireAdmin.mockResolvedValue({ ok: false, response: forbidden });

    const response = await DELETE(makeRequest("DELETE"), { params: Promise.resolve({ id: "faq-1" }) });

    expect(response.status).toBe(403);
  });

  it("deletes the faq and returns success", async () => {
    mockRequireAdmin.mockResolvedValue({ ok: true, userId: "admin-1" });
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => [{ id: "faq-1" }],
    }) as unknown as typeof fetch;

    const response = await DELETE(makeRequest("DELETE"), { params: Promise.resolve({ id: "faq-1" }) });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test -- "api/admin/faqs/\[id\]/route.test"`
Expected: FAIL — `Cannot find module '@/app/api/admin/faqs/[id]/route'`.

- [ ] **Step 3: Implement the route**

```ts
// src/app/api/admin/faqs/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/supabase/admin-auth";
import { faqUpdateSchema } from "@/lib/validation/faq";

const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const HEADERS = {
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
  "Content-Type": "application/json",
  Prefer: "return=representation",
};

type RouteParams = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const json = await req.json();
  const parsed = faqUpdateSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const res = await fetch(`${SUPABASE_URL}/rest/v1/faqs?id=eq.${id}`, {
    method: "PATCH",
    headers: HEADERS,
    body: JSON.stringify(parsed.data),
  });

  if (!res.ok) {
    return NextResponse.json({ error: "Failed to update FAQ" }, { status: 500 });
  }

  const rows = await res.json();
  if (!rows.length) {
    return NextResponse.json({ error: "FAQ not found" }, { status: 404 });
  }

  return NextResponse.json(rows[0]);
}

export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const { id } = await params;

  const res = await fetch(`${SUPABASE_URL}/rest/v1/faqs?id=eq.${id}`, {
    method: "DELETE",
    headers: HEADERS,
  });

  if (!res.ok) {
    return NextResponse.json({ error: "Failed to delete FAQ" }, { status: 500 });
  }

  const rows = await res.json();
  if (!rows.length) {
    return NextResponse.json({ error: "FAQ not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- "api/admin/faqs/\[id\]/route.test"`
Expected: PASS — 6 passed tests.

- [ ] **Step 5: Commit**

```bash
git add "src/app/api/admin/faqs/[id]/route.ts" "src/app/api/admin/faqs/[id]/route.test.ts"
git commit -m "feat: add PATCH and DELETE /api/admin/faqs/:id routes"
```

---

### Task 8: `FAQItem` + `FAQAccordion` components

**Files:**
- Create: `src/components/faq/FAQItem.tsx`
- Create: `src/components/faq/FAQAccordion.tsx`
- Test: `src/components/faq/FAQAccordion.test.tsx`

**Interfaces:**
- Consumes: `Faq` type from `@/types` (Task 2).
- Produces: `FAQAccordion({ faqs }: { faqs: Pick<Faq, "id" | "question" | "answer">[] })` — default
  export, client component. Consumed by Task 9's `/faq` page.

- [ ] **Step 1: Install the Radix accordion primitive (already a listed dependency, just confirm)**

Run: `npm ls @radix-ui/react-accordion`
Expected: shows the installed version (already in `package.json`) — no install needed.

- [ ] **Step 2: Write the failing test**

```tsx
// src/components/faq/FAQAccordion.test.tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import FAQAccordion from "@/components/faq/FAQAccordion";

const faqs = [
  { id: "1", question: "What products does Legacy Mania sell?", answer: "Collectibles and memorabilia." },
  { id: "2", question: "Do you offer Cash on Delivery (COD)?", answer: "No, prepaid only." },
];

describe("FAQAccordion", () => {
  it("renders every question", () => {
    render(<FAQAccordion faqs={faqs} />);
    expect(screen.getByText("What products does Legacy Mania sell?")).toBeInTheDocument();
    expect(screen.getByText("Do you offer Cash on Delivery (COD)?")).toBeInTheDocument();
  });

  it("hides answers until their question is clicked, then shows it", async () => {
    const user = userEvent.setup();
    render(<FAQAccordion faqs={faqs} />);

    expect(screen.queryByText("Collectibles and memorabilia.")).not.toBeVisible();

    await user.click(screen.getByText("What products does Legacy Mania sell?"));

    expect(screen.getByText("Collectibles and memorabilia.")).toBeVisible();
  });

  it("exposes accordion triggers as buttons for keyboard/AT accessibility", () => {
    render(<FAQAccordion faqs={faqs} />);
    expect(screen.getAllByRole("button")).toHaveLength(2);
  });
});
```

- [ ] **Step 3: Run it to verify it fails**

Run: `npm test -- FAQAccordion.test`
Expected: FAIL — `Cannot find module '@/components/faq/FAQAccordion'`.

- [ ] **Step 4: Implement `FAQItem`**

```tsx
// src/components/faq/FAQItem.tsx
"use client";

import * as Accordion from "@radix-ui/react-accordion";
import { ChevronDown } from "lucide-react";

interface FAQItemProps {
  id: string;
  question: string;
  answer: string;
}

export default function FAQItem({ id, question, answer }: FAQItemProps) {
  return (
    <Accordion.Item
      value={id}
      className="bg-card border border-border rounded-2xl overflow-hidden"
    >
      <Accordion.Header>
        <Accordion.Trigger className="group flex w-full items-center justify-between gap-4 px-6 py-4 font-semibold text-foreground hover:text-primary transition-colors">
          {question}
          <ChevronDown className="w-5 h-5 flex-shrink-0 transition-transform duration-200 group-data-[state=open]:rotate-180" />
        </Accordion.Trigger>
      </Accordion.Header>
      <Accordion.Content className="overflow-hidden data-[state=open]:animate-accordion-down data-[state=closed]:animate-accordion-up">
        <div className="px-6 pb-5 text-sm text-muted-foreground leading-relaxed border-t border-border pt-4">
          {answer}
        </div>
      </Accordion.Content>
    </Accordion.Item>
  );
}
```

- [ ] **Step 5: Implement `FAQAccordion`**

```tsx
// src/components/faq/FAQAccordion.tsx
"use client";

import * as Accordion from "@radix-ui/react-accordion";
import FAQItem from "@/components/faq/FAQItem";

interface FAQAccordionProps {
  faqs: { id: string; question: string; answer: string }[];
}

export default function FAQAccordion({ faqs }: FAQAccordionProps) {
  return (
    <Accordion.Root type="multiple" className="space-y-3">
      {faqs.map((faq) => (
        <FAQItem key={faq.id} id={faq.id} question={faq.question} answer={faq.answer} />
      ))}
    </Accordion.Root>
  );
}
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `npm test -- FAQAccordion.test`
Expected: PASS — 3 passed tests.

- [ ] **Step 7: Commit**

```bash
git add src/components/faq/FAQItem.tsx src/components/faq/FAQAccordion.tsx src/components/faq/FAQAccordion.test.tsx
git commit -m "feat: add FAQItem and FAQAccordion components"
```

---

### Task 9: Public `/faq` page

**Files:**
- Modify: `src/app/(shop)/faq/page.tsx` (full rewrite of the hardcoded content)
- Create: `e2e/faq.spec.ts`

**Interfaces:**
- Consumes: `FAQAccordion` (Task 8), `Faq` type (Task 2).

- [ ] **Step 1: Rewrite the page as an async server component**

```tsx
// src/app/(shop)/faq/page.tsx
import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import FAQAccordion from "@/components/faq/FAQAccordion";

export const metadata: Metadata = {
  title: "FAQ — Frequently Asked Questions",
  description:
    "Answers to common questions about products, payments, shipping, and returns at Legacy Mania.",
};

export default async function FAQPage() {
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;
  const { data: faqs } = await db
    .from("faqs")
    .select("*")
    .eq("is_active", true)
    .order("display_order", { ascending: true });

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: (faqs ?? []).map((faq: { question: string; answer: string }) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: { "@type": "Answer", text: faq.answer },
    })),
  };

  return (
    <div className="section-padding">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <div className="container-max px-4 md:px-8">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold text-foreground mb-3">
              Frequently Asked Questions
            </h1>
            <p className="text-muted-foreground">
              Everything you need to know about shopping at Legacy Mania.
            </p>
          </div>

          {faqs && faqs.length > 0 ? (
            <FAQAccordion faqs={faqs} />
          ) : (
            <p className="text-center text-muted-foreground py-12">
              No FAQs yet — check back soon, or contact us with your question.
            </p>
          )}

          <div className="mt-12 text-center bg-accent rounded-2xl p-8">
            <p className="font-semibold text-foreground mb-2">
              Still have questions?
            </p>
            <p className="text-sm text-muted-foreground mb-4">
              Our team is available on WhatsApp 10 AM – 8 PM, Mon–Sat.
            </p>
            <Link href="/contact" className="btn-primary px-6 py-2.5 text-sm">
              Contact Us
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Write the E2E test (rendering, expand/collapse, accessibility, mobile)**

```bash
npm install --save-dev @axe-core/playwright
```

```ts
// e2e/faq.spec.ts
import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test.describe("FAQ page", () => {
  test("renders seeded questions", async ({ page }) => {
    await page.goto("/faq");
    await expect(page.getByText("What products does Legacy Mania sell?")).toBeVisible();
    await expect(page.getByText("How can I stay updated?")).toBeVisible();
  });

  test("expands and collapses an answer on click", async ({ page }) => {
    await page.goto("/faq");
    const question = page.getByRole("button", { name: /Do you offer Cash on Delivery/i });
    const answer = page.getByText(/we only accept prepaid payments/i);

    await expect(answer).not.toBeVisible();
    await question.click();
    await expect(answer).toBeVisible();
    await question.click();
    await expect(answer).not.toBeVisible();
  });

  test("has no detectable accessibility violations", async ({ page }) => {
    await page.goto("/faq");
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });

  test("renders correctly on a mobile viewport", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/faq");
    const heading = page.getByRole("heading", { name: "Frequently Asked Questions" });
    await expect(heading).toBeVisible();
    const box = await heading.boundingBox();
    expect(box?.width).toBeLessThanOrEqual(375);
  });
});
```

- [ ] **Step 3: Run the E2E tests**

Run: `npm run test:e2e -- faq.spec`
Expected: PASS — all `faq.spec.ts` tests pass across chromium and mobile projects (requires the
`002_faqs.sql` migration to have been applied to the Supabase project the dev server points at —
see Task 2, Step 2).

- [ ] **Step 4: Commit**

```bash
git add "src/app/(shop)/faq/page.tsx" e2e/faq.spec.ts package.json package-lock.json
git commit -m "feat: rewire /faq page to fetch from the database"
```

---

### Task 10: Admin FAQ management (`/admin/faqs`)

**Files:**
- Modify: `src/components/admin/admin-sidebar.tsx`
- Create: `src/app/admin/faqs/page.tsx`
- Create: `src/app/admin/faqs/faqs-table.tsx`
- Create: `e2e/admin-faqs.spec.ts`

**Interfaces:**
- Consumes: `Faq` type (Task 2), `/api/admin/faqs` + `/api/admin/faqs/:id` routes (Tasks 6-7).

- [ ] **Step 1: Add the sidebar nav entry**

In `src/components/admin/admin-sidebar.tsx`, add the `HelpCircle` icon import and a new nav item
after `"Categories"`:

```ts
import {
  LayoutDashboard, Package, Tag, ShoppingBag,
  Users, BarChart3, Settings, Zap, ChevronRight, Shield, HelpCircle
} from "lucide-react";
```

```ts
const navItems = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/admin/orders", label: "Orders", icon: ShoppingBag },
  { href: "/admin/products", label: "Products", icon: Package },
  { href: "/admin/categories", label: "Categories", icon: Tag },
  { href: "/admin/faqs", label: "FAQs", icon: HelpCircle },
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/admin/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/admin/admins", label: "Admin Access", icon: Shield },
  { href: "/admin/settings", label: "Settings", icon: Settings },
];
```

- [ ] **Step 2: Create the admin page (server component)**

`/admin/*` is already gated by `src/lib/supabase/middleware.ts` (redirects non-admins before this
component ever renders), so it can safely read every row — active and inactive — with the regular
session-scoped server client, exactly like `src/app/admin/products/page.tsx` does.

```tsx
// src/app/admin/faqs/page.tsx
import { createClient } from "@/lib/supabase/server";
import FaqsTable from "./faqs-table";

export default async function AdminFaqsPage() {
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;
  const { data: faqsRaw } = await db
    .from("faqs")
    .select("*")
    .order("display_order", { ascending: true });

  const faqs = (faqsRaw ?? []) as Array<{
    id: string;
    question: string;
    answer: string;
    display_order: number;
    is_active: boolean;
  }>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">FAQs</h1>
        <p className="text-muted-foreground text-sm">{faqs.length} FAQs total</p>
      </div>
      <FaqsTable initialFaqs={faqs} />
    </div>
  );
}
```

- [ ] **Step 3: Create the client table + modal form**

```tsx
// src/app/admin/faqs/faqs-table.tsx
"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, X, ArrowUp, ArrowDown, HelpCircle } from "lucide-react";
import { faqCreateSchema, type FaqCreateInput } from "@/lib/validation/faq";

interface Faq {
  id: string;
  question: string;
  answer: string;
  display_order: number;
  is_active: boolean;
}

async function apiRequest(path: string, options?: RequestInit) {
  const res = await fetch(path, {
    ...options,
    headers: { "Content-Type": "application/json", ...options?.headers },
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body.error || "Request failed");
  return body;
}

export default function FaqsTable({ initialFaqs }: { initialFaqs: Faq[] }) {
  const [faqs, setFaqs] = useState(initialFaqs);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Faq | null>(null);

  const form = useForm<FaqCreateInput>({
    resolver: zodResolver(faqCreateSchema),
    defaultValues: { question: "", answer: "" },
  });

  const openAdd = () => {
    form.reset({ question: "", answer: "" });
    setEditing(null);
    setShowForm(true);
  };

  const openEdit = (faq: Faq) => {
    form.reset({ question: faq.question, answer: faq.answer });
    setEditing(faq);
    setShowForm(true);
  };

  const onSubmit = async (data: FaqCreateInput) => {
    try {
      if (editing) {
        const updated = await apiRequest(`/api/admin/faqs/${editing.id}`, {
          method: "PATCH",
          body: JSON.stringify(data),
        });
        setFaqs((prev) => prev.map((f) => (f.id === editing.id ? updated : f)));
        toast.success("FAQ updated");
      } else {
        const created = await apiRequest("/api/admin/faqs", {
          method: "POST",
          body: JSON.stringify(data),
        });
        setFaqs((prev) => [...prev, created].sort((a, b) => a.display_order - b.display_order));
        toast.success("FAQ created");
      }
      setShowForm(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save FAQ");
    }
  };

  const toggleActive = async (faq: Faq) => {
    try {
      const updated = await apiRequest(`/api/admin/faqs/${faq.id}`, {
        method: "PATCH",
        body: JSON.stringify({ is_active: !faq.is_active }),
      });
      setFaqs((prev) => prev.map((f) => (f.id === faq.id ? updated : f)));
      toast.success(updated.is_active ? "FAQ activated" : "FAQ hidden");
    } catch {
      toast.error("Failed to update status");
    }
  };

  const deleteFaq = async (faq: Faq) => {
    if (!confirm(`Delete "${faq.question}"? This cannot be undone.`)) return;
    try {
      await apiRequest(`/api/admin/faqs/${faq.id}`, { method: "DELETE" });
      setFaqs((prev) => prev.filter((f) => f.id !== faq.id));
      toast.success("FAQ deleted");
    } catch {
      toast.error("Failed to delete FAQ");
    }
  };

  const move = async (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= faqs.length) return;

    const current = faqs[index];
    const other = faqs[target];

    try {
      const [updatedCurrent, updatedOther] = await Promise.all([
        apiRequest(`/api/admin/faqs/${current.id}`, {
          method: "PATCH",
          body: JSON.stringify({ display_order: other.display_order }),
        }),
        apiRequest(`/api/admin/faqs/${other.id}`, {
          method: "PATCH",
          body: JSON.stringify({ display_order: current.display_order }),
        }),
      ]);

      setFaqs((prev) => {
        const next = [...prev];
        next[index] = updatedOther;
        next[target] = updatedCurrent;
        return next.sort((a, b) => a.display_order - b.display_order);
      });
    } catch {
      toast.error("Failed to reorder");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={openAdd} className="btn-primary flex items-center gap-2 text-sm py-2 px-4">
          <Plus className="w-4 h-4" />
          Add FAQ
        </button>
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-bold text-lg">{editing ? "Edit FAQ" : "Add FAQ"}</h2>
              <button onClick={() => setShowForm(false)} className="p-1 rounded-lg hover:bg-accent">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1.5">Question *</label>
                <input
                  {...form.register("question")}
                  placeholder="e.g., Do you ship internationally?"
                  className="w-full px-4 py-3 rounded-xl bg-background border border-border focus:border-primary focus:outline-none text-sm"
                />
                {form.formState.errors.question && (
                  <p className="text-red-500 text-xs mt-1">{form.formState.errors.question.message}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">Answer *</label>
                <textarea
                  {...form.register("answer")}
                  rows={4}
                  placeholder="Give a clear, complete answer"
                  className="w-full px-4 py-3 rounded-xl bg-background border border-border focus:border-primary focus:outline-none text-sm resize-none"
                />
                {form.formState.errors.answer && (
                  <p className="text-red-500 text-xs mt-1">{form.formState.errors.answer.message}</p>
                )}
              </div>
              <button
                type="submit"
                disabled={form.formState.isSubmitting}
                className="w-full btn-primary py-3 text-sm disabled:opacity-70"
              >
                {form.formState.isSubmitting ? "Saving..." : editing ? "Update FAQ" : "Add FAQ"}
              </button>
            </form>
          </div>
        </div>
      )}

      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left p-4 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Order</th>
                <th className="text-left p-4 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Question</th>
                <th className="text-left p-4 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Status</th>
                <th className="text-right p-4 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Actions</th>
              </tr>
            </thead>
            <tbody>
              {faqs.map((faq, index) => (
                <tr
                  key={faq.id}
                  className={`border-b border-border last:border-0 hover:bg-accent/20 transition-colors ${!faq.is_active ? "opacity-50" : ""}`}
                >
                  <td className="p-4">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => move(index, -1)}
                        disabled={index === 0}
                        className="p-1 rounded hover:bg-accent disabled:opacity-30 disabled:cursor-not-allowed"
                        aria-label="Move up"
                      >
                        <ArrowUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => move(index, 1)}
                        disabled={index === faqs.length - 1}
                        className="p-1 rounded hover:bg-accent disabled:opacity-30 disabled:cursor-not-allowed"
                        aria-label="Move down"
                      >
                        <ArrowDown className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                  <td className="p-4 text-sm text-foreground max-w-md truncate">{faq.question}</td>
                  <td className="p-4">
                    <span
                      className={`text-xs font-semibold px-2 py-1 rounded-full ${
                        faq.is_active
                          ? "bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300"
                          : "bg-gray-100 dark:bg-gray-800 text-gray-500"
                      }`}
                    >
                      {faq.is_active ? "Active" : "Hidden"}
                    </span>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => openEdit(faq)}
                        className="p-1.5 rounded-lg hover:bg-accent transition-colors text-muted-foreground hover:text-foreground"
                        title="Edit"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => toggleActive(faq)}
                        className="p-1.5 rounded-lg hover:bg-accent transition-colors text-muted-foreground hover:text-foreground"
                        title={faq.is_active ? "Hide" : "Activate"}
                      >
                        <HelpCircle className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => deleteFaq(faq)}
                        className="p-1.5 rounded-lg hover:bg-red-500/10 transition-colors text-muted-foreground hover:text-red-500"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {faqs.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <p>No FAQs yet.</p>
              <button onClick={openAdd} className="text-primary hover:underline text-sm mt-1">
                Add your first FAQ
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Write the E2E admin flow test**

This test needs to authenticate as an admin. Follow whatever login helper pattern is used by any
existing Playwright auth setup in this repo; if none exists yet, log in via the UI form directly
using a real admin test account's credentials read from environment variables
(`E2E_ADMIN_EMAIL` / `E2E_ADMIN_PASSWORD`), which must be set in `.env.local` before running this
test (do not hardcode credentials in the spec file).

```ts
// e2e/admin-faqs.spec.ts
import { test, expect } from "@playwright/test";

test.describe("Admin FAQ management", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel(/email/i).fill(process.env.E2E_ADMIN_EMAIL!);
    await page.getByLabel(/password/i).fill(process.env.E2E_ADMIN_PASSWORD!);
    await page.getByRole("button", { name: /log in|sign in/i }).click();
    await page.waitForURL("**/admin**");
    await page.goto("/admin/faqs");
  });

  test("adds, edits, reorders, deactivates, and deletes a FAQ", async ({ page }) => {
    // Add
    await page.getByRole("button", { name: "Add FAQ" }).click();
    await page.getByLabel(/question/i).fill("Do you ship to Nepal?");
    await page.getByLabel(/answer/i).fill("Not yet, but we're working on it.");
    await page.getByRole("button", { name: "Add FAQ" }).click();
    await expect(page.getByText("Do you ship to Nepal?")).toBeVisible();

    const row = page.locator("tr", { hasText: "Do you ship to Nepal?" });

    // Edit
    await row.getByTitle("Edit").click();
    await page.getByLabel(/question/i).fill("Do you ship internationally?");
    await page.getByRole("button", { name: "Update FAQ" }).click();
    await expect(page.getByText("Do you ship internationally?")).toBeVisible();

    // Reorder (move up)
    const updatedRow = page.locator("tr", { hasText: "Do you ship internationally?" });
    await updatedRow.getByLabel("Move up").click();

    // Deactivate
    await updatedRow.getByTitle("Hide").click();
    await expect(updatedRow.getByText("Hidden")).toBeVisible();

    // Delete
    page.once("dialog", (dialog) => dialog.accept());
    await updatedRow.getByTitle("Delete").click();
    await expect(page.getByText("Do you ship internationally?")).not.toBeVisible();
  });
});
```

- [ ] **Step 5: Run the E2E tests**

Run: `npm run test:e2e -- admin-faqs.spec`
Expected: PASS (requires `E2E_ADMIN_EMAIL` / `E2E_ADMIN_PASSWORD` set to a real admin account in
`.env.local`).

- [ ] **Step 6: Run the full test suite one last time**

Run: `npm test && npm run type-check && npm run test:e2e`
Expected: all unit, integration, and E2E tests pass; no TypeScript errors.

- [ ] **Step 7: Commit**

```bash
git add src/components/admin/admin-sidebar.tsx src/app/admin/faqs/page.tsx src/app/admin/faqs/faqs-table.tsx e2e/admin-faqs.spec.ts
git commit -m "feat: add admin FAQ management page"
```

---

## Post-implementation

Update `update.md` and `TASKS.md` (per this project's existing convention of logging shipped work)
to mark FAQ management as complete and note the new `/admin/faqs` page and `faqs` table.
