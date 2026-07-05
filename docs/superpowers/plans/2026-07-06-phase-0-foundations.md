# Phase 0 — Foundations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the shared foundations every later phase depends on: the `banners`/`contact_messages` tables and `products` schema additions, a centralized `MediaService` for all file uploads, a real `AuditService`, a shared rate limiter, and `CatalogService` (category tree/breadcrumb) — plus scaffold the four new project docs (`API.md`, `DATABASE.md`, `ROADMAP.md`, `AI_MEMORY.md`) with accurate current-state content.

**Architecture:** Follows the layered pattern from `docs/superpowers/specs/2026-07-06-platform-architecture-design.md` (repository → service → route, one file per responsibility). This phase touches no customer-facing behavior — it is pure plumbing that Phase 1 (checkout security fix) and Phase 2 (Banners) both require.

**Tech Stack:** Next.js 16.2.9 App Router, TypeScript, Supabase (Postgres + Storage), Zod, Jest + Testing Library, `sharp` (already a dependency).

## Global Constraints

- Repositories (`src/lib/repositories/`) do pure data access only — no business rules, no validation, no auth checks. Services (`src/lib/services/`) hold business rules and call repositories; they never call `fetch`/Supabase directly.
- Admin API routes authenticate via `requireAdmin()` from `src/lib/supabase/admin-auth.ts` — do not reimplement auth checks inline.
- Server-side Supabase calls that must bypass RLS use `createAdminClient()` from `src/lib/supabase/server.ts` (already fixed to guarantee the service-role key is used, never a signed-in admin's own JWT).
- Migrations in this repo are applied manually via the Supabase dashboard SQL Editor — there is no Supabase CLI/local config. Follow the exact convention established by `supabase/migrations/001_initial_schema.sql` and `002_faqs.sql`.
- `Database` type in `src/types/supabase.ts` and the re-exported types in `src/types/index.ts` are the canonical type reference, even though query code uses explicit casts rather than the `Database` generic (existing project convention — do not change this).
- Toast feedback via `sonner` (`import { toast } from "sonner"`), matching existing admin components.
- No new UI framework or dependency beyond what's already in `package.json` (`sharp` is already listed).
- File upload validation: allowed types PNG/JPG/JPEG/WEBP (MIME types `image/png`, `image/jpeg`, `image/webp`), 2MB max size, hard-reject on either failure (not a warning).
- Dimension mismatches (e.g. a banner not exactly 728×90) are a **warning returned to the caller**, never a rejection.

---

### Task 1: Database migration — `banners`, `contact_messages`, `products` additions

**Files:**
- Create: `supabase/migrations/003_platform_foundations.sql`
- Modify: `src/types/supabase.ts`
- Modify: `src/types/index.ts`

**Interfaces:**
- Produces: `public.banners` table, `public.contact_messages` table, `products.rarity`/`products.condition`/`products.reserved_quantity` columns, a public `banners` Supabase Storage bucket. TypeScript types `Banner` and `ContactMessage` importable from `@/types`; `Product`'s existing type gains `rarity`, `condition`, `reserved_quantity` fields.

- [ ] **Step 1: Write the migration**

```sql
-- supabase/migrations/003_platform_foundations.sql

-- ============================================================
-- BANNERS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.banners (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  description TEXT,
  image_url TEXT NOT NULL,
  category_id UUID NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  display_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_banners_display_order ON public.banners(display_order) WHERE deleted_at IS NULL;
CREATE INDEX idx_banners_is_active ON public.banners(is_active) WHERE deleted_at IS NULL;
CREATE INDEX idx_banners_category_id ON public.banners(category_id);
CREATE UNIQUE INDEX idx_banners_display_order_unique ON public.banners(display_order) WHERE deleted_at IS NULL;

ALTER TABLE public.banners ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active banners" ON public.banners
  FOR SELECT USING (is_active = TRUE AND deleted_at IS NULL);

CREATE TRIGGER update_banners_updated_at BEFORE UPDATE ON public.banners
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- CONTACT MESSAGES
-- ============================================================
CREATE TABLE IF NOT EXISTS public.contact_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new','read','replied')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_contact_messages_status ON public.contact_messages(status);

ALTER TABLE public.contact_messages ENABLE ROW LEVEL SECURITY;
-- Deliberately no public SELECT policy: rows are written only via the service-role-backed
-- POST /api/contact route (Phase 5); admin reads use the service-role key directly.

-- ============================================================
-- PRODUCTS: collectible metadata + inventory reservation
-- ============================================================
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS rarity TEXT,
  ADD COLUMN IF NOT EXISTS condition TEXT,
  ADD COLUMN IF NOT EXISTS reserved_quantity INTEGER NOT NULL DEFAULT 0;

-- ============================================================
-- STORAGE: banners bucket
-- ============================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('banners', 'banners', true)
ON CONFLICT (id) DO NOTHING;
```

- [ ] **Step 2: Apply it to the live Supabase project**

Open the Supabase dashboard SQL Editor for the Legacy Mania project, paste the contents of `supabase/migrations/003_platform_foundations.sql`, and run it (same manual-apply convention used for `001_initial_schema.sql`/`002_faqs.sql`).
Verify: `select count(*) from public.banners;` returns `0`. `select count(*) from public.contact_messages;` returns `0`. `select rarity, condition, reserved_quantity from public.products limit 1;` runs without error. `select * from storage.buckets where id = 'banners';` returns one row with `public = true`.

- [ ] **Step 3: Add `banners` and `contact_messages` to the `Database` type**

In `src/types/supabase.ts`, add these two entries inside `Tables`, alongside the existing `faqs` entry (insert after the `faqs` block, before `products`):

```ts
      banners: {
        Row: {
          id: string;
          title: string;
          description: string | null;
          image_url: string;
          category_id: string;
          display_order: number;
          is_active: boolean;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          title: string;
          description?: string | null;
          image_url: string;
          category_id: string;
          display_order?: number;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Update: {
          title?: string;
          description?: string | null;
          image_url?: string;
          category_id?: string;
          display_order?: number;
          is_active?: boolean;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Relationships: [];
      };
      contact_messages: {
        Row: {
          id: string;
          name: string;
          email: string;
          message: string;
          status: "new" | "read" | "replied";
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          email: string;
          message: string;
          status?: "new" | "read" | "replied";
          created_at?: string;
        };
        Update: {
          status?: "new" | "read" | "replied";
        };
        Relationships: [];
      };
```

- [ ] **Step 4: Add the new columns to the `products` entry**

In `src/types/supabase.ts`, in the existing `products` block, add `rarity`, `condition`, `reserved_quantity` to `Row`, `Insert`, and `Update`:

In `Row` (after `collection: string | null;`):
```ts
          collection: string | null;
          rarity: string | null;
          condition: string | null;
          reserved_quantity: number;
```

In `Insert` (after `collection?: string | null;`):
```ts
          collection?: string | null;
          rarity?: string | null;
          condition?: string | null;
          reserved_quantity?: number;
```

In `Update` (after `collection?: string | null;`):
```ts
          collection?: string | null;
          rarity?: string | null;
          condition?: string | null;
          reserved_quantity?: number;
```

- [ ] **Step 5: Export the app-level types**

In `src/types/index.ts`, add after the existing `export type AuditLog = ...` line:

```ts
export type Banner = Database["public"]["Tables"]["banners"]["Row"];
export type ContactMessage = Database["public"]["Tables"]["contact_messages"]["Row"];
```

- [ ] **Step 6: Verify the project still typechecks**

Run: `npm run type-check`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations/003_platform_foundations.sql src/types/supabase.ts src/types/index.ts
git commit -m "feat: add banners, contact_messages tables and product collectible/reservation columns"
```

---

### Task 2: Shared rate limiter

**Files:**
- Create: `src/lib/rate-limit.ts`
- Test: `src/lib/rate-limit.test.ts`

**Interfaces:**
- Produces: `checkRateLimit(key: string, limit: number, windowMs: number): RateLimitResult` where `RateLimitResult = { allowed: boolean; remaining: number; resetAt: number }`, and `rateLimitResponse(resetAt: number): NextResponse` (a `429` JSON response with a `Retry-After` header). Consumed by Task 5's media upload route and every later phase's public/admin mutation routes.

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/rate-limit.test.ts
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";

describe("checkRateLimit", () => {
  it("allows requests up to the limit within the window", () => {
    const key = `test-allow-${Date.now()}`;
    expect(checkRateLimit(key, 3, 60_000).allowed).toBe(true);
    expect(checkRateLimit(key, 3, 60_000).allowed).toBe(true);
    expect(checkRateLimit(key, 3, 60_000).allowed).toBe(true);
  });

  it("blocks the request after the limit is reached within the same window", () => {
    const key = `test-block-${Date.now()}`;
    checkRateLimit(key, 2, 60_000);
    checkRateLimit(key, 2, 60_000);
    const third = checkRateLimit(key, 2, 60_000);
    expect(third.allowed).toBe(false);
    expect(third.remaining).toBe(0);
  });

  it("decrements remaining on each allowed call", () => {
    const key = `test-remaining-${Date.now()}`;
    expect(checkRateLimit(key, 3, 60_000).remaining).toBe(2);
    expect(checkRateLimit(key, 3, 60_000).remaining).toBe(1);
    expect(checkRateLimit(key, 3, 60_000).remaining).toBe(0);
  });

  it("resets the count once the window has fully elapsed", async () => {
    const key = `test-reset-${Date.now()}`;
    checkRateLimit(key, 1, 50);
    expect(checkRateLimit(key, 1, 50).allowed).toBe(false);
    await new Promise((resolve) => setTimeout(resolve, 60));
    expect(checkRateLimit(key, 1, 50).allowed).toBe(true);
  });

  it("tracks separate keys independently", () => {
    const keyA = `test-a-${Date.now()}`;
    const keyB = `test-b-${Date.now()}`;
    checkRateLimit(keyA, 1, 60_000);
    expect(checkRateLimit(keyA, 1, 60_000).allowed).toBe(false);
    expect(checkRateLimit(keyB, 1, 60_000).allowed).toBe(true);
  });
});

describe("rateLimitResponse", () => {
  it("returns a 429 response with a Retry-After header", async () => {
    const resetAt = Date.now() + 5000;
    const response = rateLimitResponse(resetAt);
    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBeDefined();
    const body = await response.json();
    expect(body.error).toBe("Too many requests");
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test -- rate-limit.test`
Expected: FAIL — `Cannot find module '@/lib/rate-limit'`.

- [ ] **Step 3: Implement the rate limiter**

```ts
// src/lib/rate-limit.ts
import { NextResponse } from "next/server";

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

/**
 * Soft, per-instance sliding-window rate limiter. Resets on cold start and is not shared
 * across serverless instances — a best-effort deterrent, not a hard guarantee. See
 * docs/superpowers/specs/2026-07-06-platform-architecture-design.md section 7.
 */
export function checkRateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  const existing = buckets.get(key);

  if (!existing || existing.resetAt <= now) {
    const resetAt = now + windowMs;
    buckets.set(key, { count: 1, resetAt });
    return { allowed: true, remaining: limit - 1, resetAt };
  }

  if (existing.count >= limit) {
    return { allowed: false, remaining: 0, resetAt: existing.resetAt };
  }

  existing.count += 1;
  return { allowed: true, remaining: limit - existing.count, resetAt: existing.resetAt };
}

export function rateLimitResponse(resetAt: number): NextResponse {
  const retryAfterSeconds = Math.max(1, Math.ceil((resetAt - Date.now()) / 1000));
  return NextResponse.json(
    { error: "Too many requests" },
    { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } }
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- rate-limit.test`
Expected: PASS — 6 passed tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/rate-limit.ts src/lib/rate-limit.test.ts
git commit -m "feat: add shared rate limiter"
```

---

### Task 3: `AuditService` + `audit-repository`

**Files:**
- Create: `src/lib/repositories/audit-repository.ts`
- Create: `src/lib/services/audit-service.ts`
- Test: `src/lib/services/audit-service.test.ts`

**Interfaces:**
- Produces: `recordAuditLog(input: RecordAuditLogInput): Promise<void>` (never throws — swallows repository failures so a broken audit write never breaks the calling mutation) and `queryAuditLog(filters: QueryAuditLogsFilters): Promise<AuditLogRow[]>`, both from `@/lib/services/audit-service`. Consumed by every admin service in later phases.

- [ ] **Step 1: Write the repository (no test — pure `fetch` wrapper, exercised indirectly through the service test's mock)**

```ts
// src/lib/repositories/audit-repository.ts
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;

export interface AuditLogRow {
  id: string;
  user_id: string | null;
  action: string;
  table_name: string;
  record_id: string | null;
  old_values: unknown;
  new_values: unknown;
  ip_address: string | null;
  created_at: string;
}

export interface InsertAuditLogInput {
  userId: string;
  action: string;
  tableName: string;
  recordId?: string;
  oldValues?: unknown;
  newValues?: unknown;
}

export async function insertAuditLog(input: InsertAuditLogInput): Promise<void> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/audit_logs`, {
    method: "POST",
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify({
      user_id: input.userId,
      action: input.action,
      table_name: input.tableName,
      record_id: input.recordId ?? null,
      old_values: input.oldValues ?? null,
      new_values: input.newValues ?? null,
    }),
  });
  if (!res.ok) throw new Error(`Failed to write audit log: ${res.status}`);
}

export interface QueryAuditLogsFilters {
  userId?: string;
  tableName?: string;
  action?: string;
  dateFrom?: string;
  dateTo?: string;
}

export async function queryAuditLogs(filters: QueryAuditLogsFilters): Promise<AuditLogRow[]> {
  const params = new URLSearchParams();
  params.set("select", "*");
  params.set("order", "created_at.desc");
  if (filters.userId) params.append("user_id", `eq.${filters.userId}`);
  if (filters.tableName) params.append("table_name", `eq.${filters.tableName}`);
  if (filters.action) params.append("action", `eq.${filters.action}`);
  if (filters.dateFrom) params.append("created_at", `gte.${filters.dateFrom}`);
  if (filters.dateTo) params.append("created_at", `lte.${filters.dateTo}`);

  const res = await fetch(`${SUPABASE_URL}/rest/v1/audit_logs?${params.toString()}`, {
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Failed to query audit logs: ${res.status}`);
  return res.json();
}
```

- [ ] **Step 2: Write the failing service test**

```ts
// src/lib/services/audit-service.test.ts
const mockInsertAuditLog = jest.fn();
const mockQueryAuditLogs = jest.fn();

jest.mock("@/lib/repositories/audit-repository", () => ({
  insertAuditLog: (...args: unknown[]) => mockInsertAuditLog(...args),
  queryAuditLogs: (...args: unknown[]) => mockQueryAuditLogs(...args),
}));

import { recordAuditLog, queryAuditLog } from "@/lib/services/audit-service";

describe("recordAuditLog", () => {
  afterEach(() => jest.clearAllMocks());

  it("passes the input through to the repository", async () => {
    mockInsertAuditLog.mockResolvedValue(undefined);

    await recordAuditLog({
      userId: "admin-1",
      action: "create",
      tableName: "banners",
      recordId: "banner-1",
      newValues: { title: "Sale" },
    });

    expect(mockInsertAuditLog).toHaveBeenCalledWith({
      userId: "admin-1",
      action: "create",
      tableName: "banners",
      recordId: "banner-1",
      newValues: { title: "Sale" },
    });
  });

  it("never throws when the repository write fails", async () => {
    mockInsertAuditLog.mockRejectedValue(new Error("network down"));

    await expect(
      recordAuditLog({ userId: "admin-1", action: "create", tableName: "banners" })
    ).resolves.toBeUndefined();
  });
});

describe("queryAuditLog", () => {
  afterEach(() => jest.clearAllMocks());

  it("passes filters through and returns the repository result", async () => {
    const rows = [{ id: "log-1", action: "create", table_name: "banners" }];
    mockQueryAuditLogs.mockResolvedValue(rows);

    const result = await queryAuditLog({ tableName: "banners" });

    expect(mockQueryAuditLogs).toHaveBeenCalledWith({ tableName: "banners" });
    expect(result).toEqual(rows);
  });
});
```

- [ ] **Step 3: Run it to verify it fails**

Run: `npm test -- audit-service.test`
Expected: FAIL — `Cannot find module '@/lib/services/audit-service'`.

- [ ] **Step 4: Implement the service**

```ts
// src/lib/services/audit-service.ts
import {
  insertAuditLog,
  queryAuditLogs,
  type InsertAuditLogInput,
  type QueryAuditLogsFilters,
  type AuditLogRow,
} from "@/lib/repositories/audit-repository";

export type RecordAuditLogInput = InsertAuditLogInput;

/**
 * Records an audit log entry. Never throws — a failed audit write must not break the
 * calling mutation (e.g. a banner should still be created even if this insert fails).
 */
export async function recordAuditLog(input: RecordAuditLogInput): Promise<void> {
  try {
    await insertAuditLog(input);
  } catch (error) {
    console.error("Failed to record audit log", error);
  }
}

export async function queryAuditLog(filters: QueryAuditLogsFilters): Promise<AuditLogRow[]> {
  return queryAuditLogs(filters);
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm test -- audit-service.test`
Expected: PASS — 3 passed tests.

- [ ] **Step 6: Commit**

```bash
git add src/lib/repositories/audit-repository.ts src/lib/services/audit-service.ts src/lib/services/audit-service.test.ts
git commit -m "feat: add AuditService, giving the audit_logs table a real writer"
```

---

### Task 4: `MediaService`

**Files:**
- Create: `src/lib/services/media-service.ts`
- Test: `src/lib/services/media-service.test.ts`

**Interfaces:**
- Produces: `MEDIA_NAMESPACES` (config map), `MediaNamespace` (type), `validateFile(file: Buffer, mimeType: string, namespace: MediaNamespace): Promise<ValidationResult>`, `uploadMedia(file: Buffer, mimeType: string, namespace: MediaNamespace): Promise<UploadResult>`, `deleteMedia(path: string, namespace: MediaNamespace): Promise<void>`, `replaceMedia(newFile: Buffer, newMimeType: string, namespace: MediaNamespace, oldPath: string | null): Promise<UploadResult>`. Consumed by Task 5's API routes and Task 6's product form migration.

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/services/media-service.test.ts
const mockUpload = jest.fn();
const mockRemove = jest.fn();
const mockGetPublicUrl = jest.fn();
const mockFrom = jest.fn(() => ({
  upload: mockUpload,
  remove: mockRemove,
  getPublicUrl: mockGetPublicUrl,
}));

jest.mock("@/lib/supabase/server", () => ({
  createAdminClient: async () => ({ storage: { from: mockFrom } }),
}));

import {
  validateFile,
  uploadMedia,
  deleteMedia,
  replaceMedia,
} from "@/lib/services/media-service";

// A real 1x1 transparent PNG, used to exercise sharp's actual dimension detection.
const ONE_BY_ONE_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64"
);

describe("validateFile", () => {
  it("rejects an unsupported file type", async () => {
    const result = await validateFile(ONE_BY_ONE_PNG, "application/pdf", "banners");
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/unsupported/i);
  });

  it("rejects a file over 2MB", async () => {
    const oversized = Buffer.alloc(2 * 1024 * 1024 + 1);
    const result = await validateFile(oversized, "image/png", "banners");
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/2MB/i);
  });

  it("accepts a valid small PNG and reports its real dimensions", async () => {
    const result = await validateFile(ONE_BY_ONE_PNG, "image/png", "banners");
    expect(result.valid).toBe(true);
    expect(result.width).toBe(1);
    expect(result.height).toBe(1);
  });

  it("warns (but does not reject) when dimensions differ from the namespace recommendation", async () => {
    const result = await validateFile(ONE_BY_ONE_PNG, "image/png", "banners");
    expect(result.valid).toBe(true);
    expect(result.dimensionWarning).toMatch(/728x90/);
  });

  it("does not warn for namespaces with no recommended dimensions", async () => {
    const result = await validateFile(ONE_BY_ONE_PNG, "image/png", "products");
    expect(result.valid).toBe(true);
    expect(result.dimensionWarning).toBeUndefined();
  });
});

describe("uploadMedia", () => {
  afterEach(() => jest.clearAllMocks());

  it("uploads to the namespace's configured bucket and returns the public URL", async () => {
    mockUpload.mockResolvedValue({ error: null });
    mockGetPublicUrl.mockReturnValue({ data: { publicUrl: "https://example.com/banners/x.png" } });

    const result = await uploadMedia(ONE_BY_ONE_PNG, "image/png", "banners");

    expect(mockFrom).toHaveBeenCalledWith("banners");
    expect(result.publicUrl).toBe("https://example.com/banners/x.png");
    expect(result.path).toMatch(/^banners\/.+\.png$/);
  });

  it("throws when the storage upload fails", async () => {
    mockUpload.mockResolvedValue({ error: { message: "quota exceeded" } });

    await expect(uploadMedia(ONE_BY_ONE_PNG, "image/png", "banners")).rejects.toThrow(
      /quota exceeded/
    );
  });
});

describe("deleteMedia", () => {
  afterEach(() => jest.clearAllMocks());

  it("removes the given path from the namespace's bucket", async () => {
    mockRemove.mockResolvedValue({ error: null });

    await deleteMedia("banners/old.png", "banners");

    expect(mockFrom).toHaveBeenCalledWith("banners");
    expect(mockRemove).toHaveBeenCalledWith(["banners/old.png"]);
  });
});

describe("replaceMedia", () => {
  afterEach(() => jest.clearAllMocks());

  it("uploads the new file and deletes the old one afterward", async () => {
    mockUpload.mockResolvedValue({ error: null });
    mockGetPublicUrl.mockReturnValue({ data: { publicUrl: "https://example.com/banners/new.png" } });
    mockRemove.mockResolvedValue({ error: null });

    const result = await replaceMedia(ONE_BY_ONE_PNG, "image/png", "banners", "banners/old.png");

    expect(result.publicUrl).toBe("https://example.com/banners/new.png");
    expect(mockRemove).toHaveBeenCalledWith(["banners/old.png"]);
  });

  it("skips deletion when there is no old path", async () => {
    mockUpload.mockResolvedValue({ error: null });
    mockGetPublicUrl.mockReturnValue({ data: { publicUrl: "https://example.com/banners/new.png" } });

    await replaceMedia(ONE_BY_ONE_PNG, "image/png", "banners", null);

    expect(mockRemove).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test -- media-service.test`
Expected: FAIL — `Cannot find module '@/lib/services/media-service'`.

- [ ] **Step 3: Implement the service**

```ts
// src/lib/services/media-service.ts
import { randomUUID } from "crypto";
import sharp from "sharp";
import { createAdminClient } from "@/lib/supabase/server";

const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/webp"];
const MAX_BYTES = 2 * 1024 * 1024;

export const MEDIA_NAMESPACES = {
  banners: { bucket: "banners", recommendedWidth: 728, recommendedHeight: 90 },
  products: { bucket: "products", recommendedWidth: null, recommendedHeight: null },
} as const;

export type MediaNamespace = keyof typeof MEDIA_NAMESPACES;

export interface ValidationResult {
  valid: boolean;
  error?: string;
  dimensionWarning?: string;
  width?: number;
  height?: number;
}

export async function validateFile(
  file: Buffer,
  mimeType: string,
  namespace: MediaNamespace
): Promise<ValidationResult> {
  if (!ALLOWED_TYPES.includes(mimeType)) {
    return { valid: false, error: `Unsupported file type: ${mimeType}. Allowed: PNG, JPG, JPEG, WEBP.` };
  }
  if (file.byteLength > MAX_BYTES) {
    return { valid: false, error: "File exceeds the 2MB maximum size." };
  }

  const metadata = await sharp(file).metadata();
  const { width, height } = metadata;
  const config = MEDIA_NAMESPACES[namespace];

  let dimensionWarning: string | undefined;
  if (config.recommendedWidth && config.recommendedHeight && width && height) {
    if (width !== config.recommendedWidth || height !== config.recommendedHeight) {
      dimensionWarning = `Recommended size is ${config.recommendedWidth}x${config.recommendedHeight}, uploaded image is ${width}x${height}.`;
    }
  }

  return { valid: true, dimensionWarning, width, height };
}

export interface UploadResult {
  path: string;
  publicUrl: string;
}

function extensionForMimeType(mimeType: string): string {
  if (mimeType === "image/png") return "png";
  if (mimeType === "image/webp") return "webp";
  return "jpg";
}

export async function uploadMedia(
  file: Buffer,
  mimeType: string,
  namespace: MediaNamespace
): Promise<UploadResult> {
  const config = MEDIA_NAMESPACES[namespace];
  const path = `${namespace}/${randomUUID()}-${Date.now()}.${extensionForMimeType(mimeType)}`;

  const supabase = await createAdminClient();
  const { error } = await supabase.storage.from(config.bucket).upload(path, file, {
    contentType: mimeType,
    upsert: false,
  });
  if (error) throw new Error(`Upload failed: ${error.message}`);

  const { data } = supabase.storage.from(config.bucket).getPublicUrl(path);
  return { path, publicUrl: data.publicUrl };
}

export async function deleteMedia(path: string, namespace: MediaNamespace): Promise<void> {
  const config = MEDIA_NAMESPACES[namespace];
  const supabase = await createAdminClient();
  await supabase.storage.from(config.bucket).remove([path]);
}

export async function replaceMedia(
  newFile: Buffer,
  newMimeType: string,
  namespace: MediaNamespace,
  oldPath: string | null
): Promise<UploadResult> {
  const result = await uploadMedia(newFile, newMimeType, namespace);
  if (oldPath) {
    await deleteMedia(oldPath, namespace);
  }
  return result;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- media-service.test`
Expected: PASS — 11 passed tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/services/media-service.ts src/lib/services/media-service.test.ts
git commit -m "feat: add centralized MediaService for upload/replace/delete/validate"
```

---

### Task 5: Media API routes

**Files:**
- Create: `src/app/api/media/upload/route.ts`
- Create: `src/app/api/media/[...path]/route.ts`
- Test: `src/app/api/media/upload/route.test.ts`
- Test: `src/app/api/media/[...path]/route.test.ts`

**Interfaces:**
- Consumes: `requireAdmin()` (Task 4's admin-auth), `checkRateLimit`/`rateLimitResponse` (Task 2), `validateFile`/`uploadMedia`/`deleteMedia`/`MEDIA_NAMESPACES` (Task 4).
- Produces: `POST /api/media/upload` → `201` with `{ path, publicUrl, dimensionWarning }`, `400` on validation failure, `401`/`403` from `requireAdmin()`, `429` when rate-limited. `DELETE /api/media/:namespace/:filename` → `200` with `{ success: true }`, `400` on an invalid namespace, `401`/`403`/`429`.

- [ ] **Step 1: Write the failing test for the upload route**

```ts
/**
 * @jest-environment node
 */
// src/app/api/media/upload/route.test.ts

const mockRequireAdmin = jest.fn();
jest.mock("@/lib/supabase/admin-auth", () => ({
  requireAdmin: () => mockRequireAdmin(),
}));

const mockCheckRateLimit = jest.fn();
jest.mock("@/lib/rate-limit", () => {
  const actual = jest.requireActual("@/lib/rate-limit");
  return { ...actual, checkRateLimit: (...args: unknown[]) => mockCheckRateLimit(...args) };
});

const mockValidateFile = jest.fn();
const mockUploadMedia = jest.fn();
jest.mock("@/lib/services/media-service", () => {
  const actual = jest.requireActual("@/lib/services/media-service");
  return {
    ...actual,
    validateFile: (...args: unknown[]) => mockValidateFile(...args),
    uploadMedia: (...args: unknown[]) => mockUploadMedia(...args),
  };
});

import { NextRequest } from "next/server";
import { POST } from "@/app/api/media/upload/route";

function makeUploadRequest(fileContent: string, namespace: string | null, fileName = "test.png") {
  const formData = new FormData();
  if (fileContent) {
    formData.append("file", new Blob([fileContent], { type: "image/png" }), fileName);
  }
  if (namespace !== null) {
    formData.append("namespace", namespace);
  }
  return new NextRequest("http://localhost/api/media/upload", { method: "POST", body: formData });
}

describe("POST /api/media/upload", () => {
  afterEach(() => jest.clearAllMocks());

  it("returns the requireAdmin response when not authorized", async () => {
    const { NextResponse } = await import("next/server");
    mockRequireAdmin.mockResolvedValue({
      ok: false,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    });

    const response = await POST(makeUploadRequest("data", "banners"));

    expect(response.status).toBe(401);
  });

  it("returns 429 when rate-limited", async () => {
    mockRequireAdmin.mockResolvedValue({ ok: true, userId: "admin-1" });
    mockCheckRateLimit.mockReturnValue({ allowed: false, remaining: 0, resetAt: Date.now() + 1000 });

    const response = await POST(makeUploadRequest("data", "banners"));

    expect(response.status).toBe(429);
  });

  it("returns 400 when no file is provided", async () => {
    mockRequireAdmin.mockResolvedValue({ ok: true, userId: "admin-1" });
    mockCheckRateLimit.mockReturnValue({ allowed: true, remaining: 10, resetAt: Date.now() + 1000 });

    const response = await POST(makeUploadRequest("", null));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toMatch(/file is required/i);
  });

  it("returns 400 for an invalid namespace", async () => {
    mockRequireAdmin.mockResolvedValue({ ok: true, userId: "admin-1" });
    mockCheckRateLimit.mockReturnValue({ allowed: true, remaining: 10, resetAt: Date.now() + 1000 });

    const response = await POST(makeUploadRequest("data", "not-a-real-namespace"));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toMatch(/namespace/i);
  });

  it("returns 400 when validation fails", async () => {
    mockRequireAdmin.mockResolvedValue({ ok: true, userId: "admin-1" });
    mockCheckRateLimit.mockReturnValue({ allowed: true, remaining: 10, resetAt: Date.now() + 1000 });
    mockValidateFile.mockResolvedValue({ valid: false, error: "Unsupported file type" });

    const response = await POST(makeUploadRequest("data", "banners"));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe("Unsupported file type");
  });

  it("uploads and returns 201 with the result when valid", async () => {
    mockRequireAdmin.mockResolvedValue({ ok: true, userId: "admin-1" });
    mockCheckRateLimit.mockReturnValue({ allowed: true, remaining: 10, resetAt: Date.now() + 1000 });
    mockValidateFile.mockResolvedValue({ valid: true, dimensionWarning: undefined });
    mockUploadMedia.mockResolvedValue({ path: "banners/x.png", publicUrl: "https://example.com/x.png" });

    const response = await POST(makeUploadRequest("data", "banners"));
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.path).toBe("banners/x.png");
    expect(body.publicUrl).toBe("https://example.com/x.png");
    expect(body.dimensionWarning).toBeNull();
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test -- "media/upload/route.test"`
Expected: FAIL — `Cannot find module '@/app/api/media/upload/route'`.

- [ ] **Step 3: Implement the upload route**

```ts
// src/app/api/media/upload/route.ts
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/supabase/admin-auth";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { validateFile, uploadMedia, MEDIA_NAMESPACES, type MediaNamespace } from "@/lib/services/media-service";

function isValidNamespace(value: string): value is MediaNamespace {
  return value in MEDIA_NAMESPACES;
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const rateLimit = checkRateLimit(`media-upload:${auth.userId}`, 30, 60_000);
  if (!rateLimit.allowed) return rateLimitResponse(rateLimit.resetAt);

  const formData = await req.formData();
  const file = formData.get("file");
  const namespaceRaw = formData.get("namespace");

  if (!(file instanceof Blob) || file.size === 0) {
    return NextResponse.json({ error: "A file is required" }, { status: 400 });
  }
  if (typeof namespaceRaw !== "string" || !isValidNamespace(namespaceRaw)) {
    return NextResponse.json({ error: "A valid namespace is required" }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const mimeType = file.type;

  const validation = await validateFile(buffer, mimeType, namespaceRaw);
  if (!validation.valid) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  const result = await uploadMedia(buffer, mimeType, namespaceRaw);
  return NextResponse.json(
    { ...result, dimensionWarning: validation.dimensionWarning ?? null },
    { status: 201 }
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- "media/upload/route.test"`
Expected: PASS — 6 passed tests.

- [ ] **Step 5: Write the failing test for the delete route**

```ts
/**
 * @jest-environment node
 */
// src/app/api/media/[...path]/route.test.ts

const mockRequireAdmin = jest.fn();
jest.mock("@/lib/supabase/admin-auth", () => ({
  requireAdmin: () => mockRequireAdmin(),
}));

const mockDeleteMedia = jest.fn();
jest.mock("@/lib/services/media-service", () => {
  const actual = jest.requireActual("@/lib/services/media-service");
  return { ...actual, deleteMedia: (...args: unknown[]) => mockDeleteMedia(...args) };
});

import { NextRequest, NextResponse } from "next/server";
import { DELETE } from "@/app/api/media/[...path]/route";

function makeRequest(path: string[]) {
  const req = new NextRequest(`http://localhost/api/media/${path.join("/")}`, { method: "DELETE" });
  return { req, params: Promise.resolve({ path }) };
}

describe("DELETE /api/media/:path", () => {
  afterEach(() => jest.clearAllMocks());

  it("returns the requireAdmin response when not authorized", async () => {
    const forbidden = NextResponse.json({ error: "Forbidden" }, { status: 403 });
    mockRequireAdmin.mockResolvedValue({ ok: false, response: forbidden });

    const { req, params } = makeRequest(["banners", "x.png"]);
    const response = await DELETE(req, { params });

    expect(response.status).toBe(403);
  });

  it("returns 400 for an invalid namespace segment", async () => {
    mockRequireAdmin.mockResolvedValue({ ok: true, userId: "admin-1" });

    const { req, params } = makeRequest(["not-a-namespace", "x.png"]);
    const response = await DELETE(req, { params });

    expect(response.status).toBe(400);
  });

  it("returns 400 when there is no filename segment", async () => {
    mockRequireAdmin.mockResolvedValue({ ok: true, userId: "admin-1" });

    const { req, params } = makeRequest(["banners"]);
    const response = await DELETE(req, { params });

    expect(response.status).toBe(400);
  });

  it("deletes the file and returns success", async () => {
    mockRequireAdmin.mockResolvedValue({ ok: true, userId: "admin-1" });
    mockDeleteMedia.mockResolvedValue(undefined);

    const { req, params } = makeRequest(["banners", "x.png"]);
    const response = await DELETE(req, { params });
    const body = await response.json();

    expect(mockDeleteMedia).toHaveBeenCalledWith("banners/x.png", "banners");
    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
  });
});
```

- [ ] **Step 6: Run it to verify it fails**

Run: `npm test -- "media/\[...path\]/route.test"`
Expected: FAIL — `Cannot find module '@/app/api/media/[...path]/route'`.

- [ ] **Step 7: Implement the delete route**

```ts
// src/app/api/media/[...path]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/supabase/admin-auth";
import { deleteMedia, MEDIA_NAMESPACES, type MediaNamespace } from "@/lib/services/media-service";

type RouteParams = { params: Promise<{ path: string[] }> };

function isValidNamespace(value: string): value is MediaNamespace {
  return value in MEDIA_NAMESPACES;
}

export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const { path } = await params;
  const [namespace, ...rest] = path;

  if (!namespace || !isValidNamespace(namespace)) {
    return NextResponse.json({ error: "Invalid media namespace" }, { status: 400 });
  }
  if (rest.length === 0) {
    return NextResponse.json({ error: "A file path is required" }, { status: 400 });
  }

  await deleteMedia(path.join("/"), namespace);
  return NextResponse.json({ success: true });
}
```

- [ ] **Step 8: Run the test to verify it passes**

Run: `npm test -- "media/\[...path\]/route.test"`
Expected: PASS — 4 passed tests.

- [ ] **Step 9: Commit**

```bash
git add "src/app/api/media/upload/route.ts" "src/app/api/media/upload/route.test.ts" "src/app/api/media/[...path]/route.ts" "src/app/api/media/[...path]/route.test.ts"
git commit -m "feat: add POST /api/media/upload and DELETE /api/media/:path routes"
```

---

### Task 6: Migrate `product-form.tsx` to `MediaService`

**Note on scope:** the architecture spec calls for migrating both `product-form.tsx` and
`category-form.tsx`'s uploads to `MediaService`. Checking `category-form.tsx` directly shows it
has **no image upload at all** — `categories.image_url` exists as a column but no admin UI
currently populates it. There is nothing to migrate there, so this task only touches
`product-form.tsx`. Adding image upload to the category form would be new functionality, not a
migration of existing behavior, so it's out of scope for this task.

**Files:**
- Modify: `src/components/admin/product-form.tsx`
- Test: `src/components/admin/product-form-upload.test.tsx`

**Interfaces:**
- Consumes: `POST /api/media/upload` (Task 5).

- [ ] **Step 1: Write the failing test for the new upload behavior**

```tsx
// src/components/admin/product-form-upload.test.tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ProductForm from "@/components/admin/product-form";

const originalFetch = global.fetch;

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn(), refresh: jest.fn() }),
}));

describe("ProductForm image upload", () => {
  afterEach(() => {
    jest.clearAllMocks();
    global.fetch = originalFetch;
  });

  it("uploads a selected file through POST /api/media/upload with the products namespace", async () => {
    const user = userEvent.setup();
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ path: "products/x.png", publicUrl: "https://example.com/x.png", dimensionWarning: null }),
    }) as unknown as typeof fetch;

    render(<ProductForm categories={[]} />);

    const file = new File(["data"], "card.png", { type: "image/png" });
    const input = screen.getByLabelText(/upload images/i, { selector: "input" });
    await user.upload(input, file);

    expect(global.fetch).toHaveBeenCalledWith(
      "/api/media/upload",
      expect.objectContaining({ method: "POST" })
    );
    const [, options] = (global.fetch as jest.Mock).mock.calls[0];
    const sentFormData = options.body as FormData;
    expect(sentFormData.get("namespace")).toBe("products");
    expect(await screen.findByAltText("Image 1")).toBeInTheDocument();
  });

  it("shows an error toast when the upload API returns an error", async () => {
    const user = userEvent.setup();
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: "File exceeds the 2MB maximum size." }),
    }) as unknown as typeof fetch;

    render(<ProductForm categories={[]} />);

    const file = new File(["data"], "card.png", { type: "image/png" });
    const input = screen.getByLabelText(/upload images/i, { selector: "input" });
    await user.upload(input, file);

    expect(await screen.findByText(/File exceeds the 2MB maximum size\./)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test -- product-form-upload.test`
Expected: FAIL — the current `handleImageUpload` calls `supabase.storage` directly, so `global.fetch` is never invoked and the first assertion fails.

- [ ] **Step 3: Replace the upload handler**

In `src/components/admin/product-form.tsx`, replace the existing `handleImageUpload` function (currently calling `supabase.storage.from("products").upload(...)` directly) with:

```tsx
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    setUploading(true);
    try {
      const urls: string[] = [];
      for (const file of files) {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("namespace", "products");
        const res = await fetch("/api/media/upload", { method: "POST", body: formData });
        const body = await res.json();
        if (!res.ok) throw new Error(body.error || "Upload failed");
        urls.push(body.publicUrl);
      }
      setImages((prev) => [...prev, ...urls]);
      toast.success(`${urls.length} image(s) uploaded`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Image upload failed");
    } finally {
      setUploading(false);
    }
  };
```

Add a `htmlFor`/`id` pairing so the file input is reachable via `getByLabelText` in the test: change the upload `<label>` to `<label htmlFor="product-image-upload" ...>` and the `<input type="file" ... />` to include `id="product-image-upload"`.

Note: the `createClient` import from `@/lib/supabase/client` stays — `onSubmit` still uses it to write the product row directly (that CRUD hardening is Phase 3, not this task).

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- product-form-upload.test`
Expected: PASS — 2 passed tests.

- [ ] **Step 5: Run the full unit test suite to confirm no regressions**

Run: `npm test`
Expected: all suites pass.

- [ ] **Step 6: Commit**

```bash
git add src/components/admin/product-form.tsx src/components/admin/product-form-upload.test.tsx
git commit -m "refactor: migrate product image uploads to MediaService"
```

---

### Task 7: `category-repository` + `CatalogService`

**Files:**
- Create: `src/lib/repositories/category-repository.ts`
- Create: `src/lib/services/catalog-service.ts`
- Test: `src/lib/services/catalog-service.test.ts`

**Interfaces:**
- Consumes: `Category`, `CategoryWithChildren` types from `@/types` (already defined — `CategoryWithChildren = Category & { children?: CategoryWithChildren[] }`).
- Produces: `getFlatCategories(): Promise<Category[]>`, `getCategoryTree(): Promise<CategoryWithChildren[]>`, `getBreadcrumb(categoryId: string): Promise<Category[]>` from `@/lib/services/catalog-service`. Consumed by Task 8's API routes and, in later phases, product breadcrumbs.

- [ ] **Step 1: Write the repository**

```ts
// src/lib/repositories/category-repository.ts
import type { Category } from "@/types";

const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;

export async function listActiveCategories(): Promise<Category[]> {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/categories?select=*&is_active=eq.true&order=display_order.asc`,
    { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` }, cache: "no-store" }
  );
  if (!res.ok) throw new Error(`Failed to fetch categories: ${res.status}`);
  return res.json();
}
```

- [ ] **Step 2: Write the failing service test**

```ts
// src/lib/services/catalog-service.test.ts
const mockListActiveCategories = jest.fn();

jest.mock("@/lib/repositories/category-repository", () => ({
  listActiveCategories: () => mockListActiveCategories(),
}));

import { getFlatCategories, getCategoryTree, getBreadcrumb } from "@/lib/services/catalog-service";
import type { Category } from "@/types";

const pokemon: Category = {
  id: "pokemon",
  name: "Pokémon",
  slug: "pokemon",
  description: null,
  image_url: null,
  parent_id: null,
  display_order: 0,
  is_active: true,
  meta_title: null,
  meta_description: null,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

const indigoLeague: Category = {
  ...pokemon,
  id: "indigo-league",
  name: "Indigo League",
  slug: "pokemon-indigo-league",
  parent_id: "pokemon",
};

const dbz: Category = {
  ...pokemon,
  id: "dbz",
  name: "Dragon Ball Z",
  slug: "dragon-ball-z",
  parent_id: null,
};

describe("getFlatCategories", () => {
  afterEach(() => jest.clearAllMocks());

  it("returns the repository's category list unchanged", async () => {
    mockListActiveCategories.mockResolvedValue([pokemon, dbz]);
    const result = await getFlatCategories();
    expect(result).toEqual([pokemon, dbz]);
  });
});

describe("getCategoryTree", () => {
  afterEach(() => jest.clearAllMocks());

  it("nests children under their parent and leaves top-level categories as roots", async () => {
    mockListActiveCategories.mockResolvedValue([pokemon, indigoLeague, dbz]);

    const tree = await getCategoryTree();

    expect(tree).toHaveLength(2);
    const pokemonNode = tree.find((node) => node.id === "pokemon");
    expect(pokemonNode?.children).toHaveLength(1);
    expect(pokemonNode?.children?.[0].id).toBe("indigo-league");
    const dbzNode = tree.find((node) => node.id === "dbz");
    expect(dbzNode?.children).toHaveLength(0);
  });
});

describe("getBreadcrumb", () => {
  afterEach(() => jest.clearAllMocks());

  it("returns the ancestor chain from root to the given category, inclusive", async () => {
    mockListActiveCategories.mockResolvedValue([pokemon, indigoLeague, dbz]);

    const breadcrumb = await getBreadcrumb("indigo-league");

    expect(breadcrumb.map((cat) => cat.id)).toEqual(["pokemon", "indigo-league"]);
  });

  it("returns a single-element breadcrumb for a top-level category", async () => {
    mockListActiveCategories.mockResolvedValue([pokemon, indigoLeague, dbz]);

    const breadcrumb = await getBreadcrumb("dbz");

    expect(breadcrumb.map((cat) => cat.id)).toEqual(["dbz"]);
  });

  it("returns an empty array for an unknown category id", async () => {
    mockListActiveCategories.mockResolvedValue([pokemon, indigoLeague, dbz]);

    const breadcrumb = await getBreadcrumb("does-not-exist");

    expect(breadcrumb).toEqual([]);
  });
});
```

- [ ] **Step 3: Run it to verify it fails**

Run: `npm test -- catalog-service.test`
Expected: FAIL — `Cannot find module '@/lib/services/catalog-service'`.

- [ ] **Step 4: Implement the service**

```ts
// src/lib/services/catalog-service.ts
import type { Category, CategoryWithChildren } from "@/types";
import { listActiveCategories } from "@/lib/repositories/category-repository";

export async function getFlatCategories(): Promise<Category[]> {
  return listActiveCategories();
}

export async function getCategoryTree(): Promise<CategoryWithChildren[]> {
  const categories = await listActiveCategories();
  const byId = new Map<string, CategoryWithChildren>();
  categories.forEach((cat) => byId.set(cat.id, { ...cat, children: [] }));

  const roots: CategoryWithChildren[] = [];
  byId.forEach((node) => {
    if (node.parent_id && byId.has(node.parent_id)) {
      byId.get(node.parent_id)!.children!.push(node);
    } else {
      roots.push(node);
    }
  });

  return roots;
}

export async function getBreadcrumb(categoryId: string): Promise<Category[]> {
  const categories = await listActiveCategories();
  const byId = new Map(categories.map((cat) => [cat.id, cat]));
  const trail: Category[] = [];

  let current = byId.get(categoryId);
  while (current) {
    trail.unshift(current);
    current = current.parent_id ? byId.get(current.parent_id) : undefined;
  }

  return trail;
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm test -- catalog-service.test`
Expected: PASS — 6 passed tests.

- [ ] **Step 6: Commit**

```bash
git add src/lib/repositories/category-repository.ts src/lib/services/catalog-service.ts src/lib/services/catalog-service.test.ts
git commit -m "feat: add CatalogService for category tree and breadcrumb resolution"
```

---

### Task 8: Categories API routes

**Files:**
- Create: `src/app/api/categories/route.ts`
- Create: `src/app/api/categories/tree/route.ts`
- Test: `src/app/api/categories/route.test.ts`
- Test: `src/app/api/categories/tree/route.test.ts`

**Interfaces:**
- Consumes: `getFlatCategories`, `getCategoryTree` (Task 7).
- Produces: `GET /api/categories` → `200` with `Category[]`, `500` on failure. `GET /api/categories/tree` → `200` with `CategoryWithChildren[]`, `500` on failure. No auth required (public).

- [ ] **Step 1: Write the failing test for the flat list route**

```ts
/**
 * @jest-environment node
 */
// src/app/api/categories/route.test.ts

const mockGetFlatCategories = jest.fn();
jest.mock("@/lib/services/catalog-service", () => ({
  getFlatCategories: () => mockGetFlatCategories(),
}));

import { GET } from "@/app/api/categories/route";

describe("GET /api/categories", () => {
  afterEach(() => jest.clearAllMocks());

  it("returns the flat category list", async () => {
    mockGetFlatCategories.mockResolvedValue([{ id: "1", name: "Pokémon" }]);

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toHaveLength(1);
  });

  it("returns a 500 with an error message when the service throws", async () => {
    mockGetFlatCategories.mockRejectedValue(new Error("db down"));

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toBe("db down");
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test -- "api/categories/route.test"`
Expected: FAIL — `Cannot find module '@/app/api/categories/route'`.

- [ ] **Step 3: Implement the flat list route**

```ts
// src/app/api/categories/route.ts
import { NextResponse } from "next/server";
import { getFlatCategories } from "@/lib/services/catalog-service";

export async function GET() {
  try {
    const categories = await getFlatCategories();
    return NextResponse.json(categories);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch categories";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- "api/categories/route.test"`
Expected: PASS — 2 passed tests.

- [ ] **Step 5: Write the failing test for the tree route**

```ts
/**
 * @jest-environment node
 */
// src/app/api/categories/tree/route.test.ts

const mockGetCategoryTree = jest.fn();
jest.mock("@/lib/services/catalog-service", () => ({
  getCategoryTree: () => mockGetCategoryTree(),
}));

import { GET } from "@/app/api/categories/tree/route";

describe("GET /api/categories/tree", () => {
  afterEach(() => jest.clearAllMocks());

  it("returns the nested category tree", async () => {
    mockGetCategoryTree.mockResolvedValue([{ id: "1", name: "Pokémon", children: [] }]);

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body[0].children).toEqual([]);
  });

  it("returns a 500 with an error message when the service throws", async () => {
    mockGetCategoryTree.mockRejectedValue(new Error("db down"));

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toBe("db down");
  });
});
```

- [ ] **Step 6: Run it to verify it fails**

Run: `npm test -- "api/categories/tree/route.test"`
Expected: FAIL — `Cannot find module '@/app/api/categories/tree/route'`.

- [ ] **Step 7: Implement the tree route**

```ts
// src/app/api/categories/tree/route.ts
import { NextResponse } from "next/server";
import { getCategoryTree } from "@/lib/services/catalog-service";

export async function GET() {
  try {
    const tree = await getCategoryTree();
    return NextResponse.json(tree);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch category tree";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
```

- [ ] **Step 8: Run the test to verify it passes**

Run: `npm test -- "api/categories/tree/route.test"`
Expected: PASS — 2 passed tests.

- [ ] **Step 9: Commit**

```bash
git add src/app/api/categories/route.ts src/app/api/categories/route.test.ts src/app/api/categories/tree/route.ts src/app/api/categories/tree/route.test.ts
git commit -m "feat: add public GET /api/categories and /api/categories/tree routes"
```

---

### Task 9: Documentation scaffolding

**Files:**
- Create: `API.md`
- Create: `DATABASE.md`
- Create: `ROADMAP.md`
- Create: `AI_MEMORY.md`

**Interfaces:**
- None — these are documentation deliverables, not code. Content must reflect the real state of the codebase as of the end of this task (existing routes/tables plus what Tasks 1–8 just added), not aspirational future state.

- [ ] **Step 1: Create `API.md`**

```markdown
# API.md — Legacy Mania Endpoint Reference

Reflects the actual routes present in `src/app/api/` as of Phase 0. Routes planned for later
phases are tracked in `ROADMAP.md`, not documented here until they exist.

## Public (no auth)

| Method | Path | Description |
|---|---|---|
| GET | `/api/banners` | *(not yet built — Phase 2)* |
| GET | `/api/faqs` | Active FAQs, ordered by `display_order` |
| GET | `/api/products` | Product listing |
| GET | `/api/categories` | Flat list of active categories |
| GET | `/api/categories/tree` | Nested category tree (parent → children) |
| POST | `/api/newsletter` | Newsletter signup |
| POST | `/api/media/upload` | **Admin-only**, see below — listed here because the route lives under `/api/media`, not `/api/admin` |

## Customer (authenticated)

| Method | Path | Description |
|---|---|---|
| PATCH | `/api/account/profile` | Update the signed-in user's profile |

## Admin (`requireAdmin()` required)

| Method | Path | Description |
|---|---|---|
| GET/POST/DELETE | `/api/admin/admins` | Manage admin accounts |
| GET | `/api/admin/analytics` | Analytics overview data |
| POST | `/api/admin/faqs` | Create a FAQ |
| PATCH/DELETE | `/api/admin/faqs/:id` | Update/delete a FAQ |
| POST | `/api/media/upload` | Upload a file. Form fields: `file` (binary), `namespace` (`"banners"` \| `"products"`). Returns `201` with `{ path, publicUrl, dimensionWarning }`. Rate-limited (30/min per admin). |
| DELETE | `/api/media/:namespace/:filename` | Delete an uploaded file by its storage path. |

## Known dead/removed code (not yet cleaned up — scheduled for Phase 1)

- `POST /api/orders` — dead code, unused by the real checkout flow (which currently writes to Supabase directly from the browser). Removed in Phase 1 alongside the checkout security fix.
- `/api/setup/` — empty directory, no route file.

## Reserved (not implemented)

`POST /api/scan`, `GET /api/cards/:id` — names reserved for a future QR/collectible phase. See `ROADMAP.md`.
```

- [ ] **Step 2: Create `DATABASE.md`**

```markdown
# DATABASE.md — Legacy Mania Schema Reference

Reflects the actual live schema as of `supabase/migrations/003_platform_foundations.sql`.

## Tables

- **profiles** — id (PK, FK→auth.users), email, full_name, phone, avatar_url, role (`customer`|`admin`), created_at, updated_at
- **addresses** — id (PK), user_id (FK→profiles), label, name, phone, street, city, state, pincode, is_default, timestamps
- **categories** — id (PK), name, slug (unique), description, image_url, parent_id (self-referential FK, `ON DELETE SET NULL`), display_order, is_active, meta_title, meta_description, timestamps. Self-referential `parent_id` supports arbitrary-depth hierarchy (e.g. Pokémon → Indigo League) — this is the platform's "catalog," there is no separate Catalog table.
- **products** — id (PK), name, slug (unique), description, price, compare_price, images (text[]), category_id (FK→categories, `SET NULL`), series, saga, collection, **rarity, condition** (added in `003`), stock_quantity, **reserved_quantity** (added in `003`, default 0 — available-to-sell stock is always `stock_quantity - reserved_quantity`), sku (unique), is_active, is_featured, is_new, tags (text[]), meta_title, meta_description, timestamps
- **wishlists** — id (PK), user_id (FK→profiles), product_id (FK→products), created_at, unique(user_id, product_id)
- **orders** — id (PK), order_number (unique), user_id (FK→profiles, `SET NULL`), guest_email, status (`pending`|`payment_verification`|`confirmed`|`processing`|`shipped`|`delivered`|`cancelled`|`refunded`), subtotal, shipping_cost, total, shipping_* fields, notes, timestamps
- **order_items** — id (PK), order_id (FK→orders, cascade), product_id (FK→products, `SET NULL`), product_name, product_image, quantity, unit_price, total_price
- **payments** — id (PK), order_id (FK→orders, cascade, **unique** — 1:1), amount, payment_method, status (`pending`|`verified`|`rejected`), screenshot_url, upi_ref, verified_by (FK→profiles), verified_at, timestamps
- **settings** — id (PK), key (unique), value (jsonb), description, updated_by (FK→profiles), updated_at — generic key-value store
- **audit_logs** — id (PK), user_id (FK→profiles), action, table_name, record_id, old_values/new_values (jsonb), ip_address, created_at. **Now has a real writer as of Phase 0** — `AuditService.recordAuditLog()`.
- **analytics_events** — id (PK), event_type, user_id, session_id, product_id, category_id, order_id, metadata (jsonb), created_at. Still has no writer as of Phase 0 — scheduled for Phase 6.
- **newsletter_subscribers** — id (PK), email (unique), subscribed_at
- **faqs** — id (PK), question, answer, display_order, is_active, timestamps
- **banners** *(new in `003`)* — id (PK), title, description, image_url, category_id (FK→categories, `ON DELETE CASCADE`), display_order (partial-unique where `deleted_at IS NULL`), is_active, timestamps, deleted_at (soft delete). Public RLS: `is_active = TRUE AND deleted_at IS NULL`.
- **contact_messages** *(new in `003`)* — id (PK), name, email, message, status (`new`|`read`|`replied`), created_at. No public SELECT policy — insert-only via the service-role-backed `/api/contact` route (Phase 5).

## Storage buckets

- `products` (public)
- `payments` (private)
- `settings` (public)
- `banners` (public) *(new in `003`)*

## Known inconsistency (not yet fixed — scheduled for Phase 1)

`payments.screenshot_url` currently stores a public URL despite the bucket being private; the checkout code calls `getPublicUrl()` on a private bucket. Target fix: store the storage path instead, generate signed URLs server-side via `PaymentService`.
```

- [ ] **Step 3: Create `ROADMAP.md`**

```markdown
# ROADMAP.md — Legacy Mania Platform Roadmap

Full design rationale lives in `docs/superpowers/specs/2026-07-06-platform-architecture-design.md`.
This file tracks phase-level progress; day-to-day granular tasks stay in `TASKS.md`.

| Phase | Scope | Status |
|---|---|---|
| 0 — Foundations | Banners/contact_messages/products schema, MediaService, AuditService, rate limiter, CatalogService, doc scaffolding | **In progress** |
| 1 — Checkout/Order/Payment/Inventory integrity | Server-side price truth, guarded order state machine, payment verify/reject, inventory reservation + expiry, remove dead checkout code | Not started |
| 2 — Banners | Full banner feature (admin CRUD/reorder, homepage carousel) | Not started |
| 3 — Product/Category hardening | Full server-side CRUD, `/api/products/:slug` + `/search`, rarity/condition in admin form, navbar catalog tree | Not started |
| 4 — WhatsApp/SEO/Settings | Settings-table-sourced WhatsApp/SEO (fixes env-var disconnect), tabbed Settings page | Not started |
| 5 — Users/Contact/Support/Notifications | Customer Orders API, Contact form + inbox, UserService, NotificationService | Not started |
| 6 — Analytics | Real event capture wired into Phase 1–5 touchpoints | Not started |
| 7 — Audit API + full-suite polish + launch content | Audit query API, full test suites, real products/UPI QR/WhatsApp number | Not started |
| 8 — Future (reserved) | QR/Collectible system | Documented only, not built |
```

- [ ] **Step 4: Create `AI_MEMORY.md`**

```markdown
# AI_MEMORY.md — Read This First

Project-local, git-tracked onboarding doc for any AI (or human) starting work on Legacy Mania.
Distinct from any assistant-specific private memory system — this file travels with the repo.

## Session ritual

Before writing code, read in this order: `README.md` → `PROJECT_CONTEXT.md` → this file →
`CHANGELOG.md` → `TASKS.md` → `ROADMAP.md`. After a module ships, update whichever of these
actually changed.

## Architecture

Full platform design: `docs/superpowers/specs/2026-07-06-platform-architecture-design.md`.
Layered pattern: `src/lib/repositories/` (pure data access) → `src/lib/services/` (business
rules) → `src/app/api/**/route.ts` (thin — auth, validate, call one service method).

## Known gotchas (update this list as things are fixed or discovered)

- **Checkout writes directly from the browser** (`checkout-client.tsx`) with client-supplied
  prices/totals — no server-side recomputation yet. Real security gap. Fix is Phase 1
  (`CheckoutService` + `POST /api/checkout`).
- **`order-status-updater.tsx`** also writes directly from the browser with no guard on status
  transitions (any status → any status). Same Phase 1 fix.
- **WhatsApp number / GA4 / GTM IDs** are editable in Admin → Settings but the app currently
  reads hardcoded env vars at every call site instead of the `settings` table — so admin edits
  silently do nothing today. Fix is Phase 4 (`WhatsAppService`/`SEOService`).
- **`payments.screenshot_url`** stores a public URL despite the bucket being documented private.
  Fix is Phase 1 (store the path, generate signed URLs via `PaymentService`).
- **`analytics_events`** has no writer yet (Phase 6 adds one via `AnalyticsService`).
- **As of Phase 0:** `audit_logs` has a real writer (`AuditService`), file uploads for
  Banners/Products go through the centralized `MediaService` (`POST /api/media/upload`), and
  `categories`' existing self-referential `parent_id` is the platform's "catalog" — there is no
  separate Catalog table; `CatalogService` just reads that same tree.
- **Migrations are applied manually** via the Supabase dashboard SQL Editor — there is no
  Supabase CLI/local config in this repo.
```

- [ ] **Step 5: Commit**

```bash
git add API.md DATABASE.md ROADMAP.md AI_MEMORY.md
git commit -m "docs: scaffold API.md, DATABASE.md, ROADMAP.md, AI_MEMORY.md"
```

---

### Task 10: Phase 0 verification and TASKS.md/CHANGELOG.md sync

**Files:**
- Modify: `TASKS.md`
- Modify: `CHANGELOG.md`

**Interfaces:** None — verification and documentation-sync task.

- [ ] **Step 1: Run the full test suite**

Run: `npm test`
Expected: all suites pass (existing FAQ suites + all suites added in Tasks 2–8 of this plan).

- [ ] **Step 2: Run the typecheck**

Run: `npm run type-check`
Expected: no errors.

- [ ] **Step 3: Manually verify the two new public routes against the dev server**

Run: `npm run dev`, then in a separate terminal:
```bash
curl http://localhost:3000/api/categories
curl http://localhost:3000/api/categories/tree
```
Expected: both return `200` with real category JSON (the seeded Pokémon/DBZ/etc. categories), the `tree` response showing `children` arrays nested correctly (e.g. Pokémon's children include Indigo League, Orange Islands, Johto, Hoenn, Sinnoh).

- [ ] **Step 4: Update `TASKS.md`**

Add a new entry under a "Phase 0 — Foundations" heading (create the heading if it doesn't exist) marking as complete: banners/contact_messages schema, MediaService, AuditService, rate limiter, CatalogService + categories API, product-form MediaService migration, and the four new doc files.

- [ ] **Step 5: Update `CHANGELOG.md`**

Add a dated entry (today's date) summarizing: new `banners`/`contact_messages` tables and `products` collectible/reservation columns; centralized `MediaService` now backing product image uploads; `AuditService` giving `audit_logs` its first real writer; shared rate limiter; `CatalogService` + public `/api/categories`/`/api/categories/tree`; new `API.md`/`DATABASE.md`/`ROADMAP.md`/`AI_MEMORY.md` docs.

- [ ] **Step 6: Commit**

```bash
git add TASKS.md CHANGELOG.md
git commit -m "docs: sync TASKS.md and CHANGELOG.md after Phase 0"
```
