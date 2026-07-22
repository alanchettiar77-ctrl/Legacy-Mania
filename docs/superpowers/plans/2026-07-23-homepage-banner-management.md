# Homepage Banner Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the admin a full CRUD, schedulable, reorderable homepage banner carousel (Marketing → Homepage Banners), rendered below the existing static hero, without touching hero-section.tsx.

**Architecture:** Service → Repository → API → UI, identical layering to the existing `homepage_notifications` feature (migration 007). Repository does raw PostgREST `fetch` calls with the service-role key; service holds business rules; routes are thin (rate-limit → requireAdmin → validate → one service call → audit log → respond); admin UI mirrors `notifications-table.tsx`'s native-HTML5-drag-and-drop table pattern, split into a table file and a form-dialog file for size.

**Tech Stack:** Next.js 16 App Router, Supabase Postgres (REST via service-role key, no ORM), Zod validation, Jest + `@jest-environment node` for API/repo/service tests, React Testing Library for the carousel component, existing `MediaService` (Sharp validation, Supabase Storage) for image uploads via the already-generic `/api/media/upload` route — **no new upload endpoint needed**, correcting the spec's mention of a dedicated `/image` route.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-07-23-homepage-banner-management-design.md`
- Drop and recreate the `banners` table (migration `010_banner_management.sql`) — old table has zero rows and no code references.
- Active-today fields: `alt_text` (required), `aria_label`, `image_title`. Future-ready-only fields (stored, admin-editable, never rendered): `seo_meta_title`, `seo_meta_description`, `seo_keywords`, `og_title`, `og_description`, `og_image_url`, `canonical_url`, `schema_type`.
- CTA: both `category_id` (optional FK) and `cta_url` (freeform) supported; explicit `cta_url` wins if both are set.
- Image dimensions: desktop 1600×600, mobile 750×1000 (warning only, not a hard block).
- All admin routes: rate-limited, `requireAdmin`-gated, audit-logged — no exceptions.
- Migration must be manually applied via Supabase SQL Editor and curl-verified afterward (no CLI in this environment) — this is an operational step for the user, not a code task, and is called out at the end of this plan.
- Every module gets tests before being considered done (TDD: write the failing test first).

---

### Task 1: Migration file

**Files:**
- Create: `supabase/migrations/010_banner_management.sql`

**Interfaces:**
- Produces: `public.banners` table with columns exactly as listed below — every later task's repository/validation code depends on these exact column names and types.

- [ ] **Step 1: Write the migration**

```sql
-- supabase/migrations/010_banner_management.sql
-- Homepage banner carousel (admin-managed, below the static hero).
-- Apply manually via Supabase SQL Editor, then verify via PostgREST curl (see DATABASE.md).
--
-- The old `banners` table (from 003_platform_foundations.sql) is dead schema: zero live rows,
-- no code in src/ references it, required category_id FK that doesn't fit this feature's needs.
-- Safe to drop and recreate cleanly rather than chain ALTERs.

DROP TABLE IF EXISTS public.banners CASCADE;

CREATE TABLE public.banners (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  subtitle TEXT,
  cta_text TEXT,
  cta_url TEXT,
  category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  desktop_image_url TEXT NOT NULL,
  mobile_image_url TEXT,
  alt_text TEXT NOT NULL,
  aria_label TEXT,
  image_title TEXT,
  overlay_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  overlay_opacity NUMERIC(3,2) NOT NULL DEFAULT 0.40 CHECK (overlay_opacity BETWEEN 0 AND 1),
  banner_type TEXT NOT NULL DEFAULT 'image' CHECK (banner_type IN ('image','video','promotional','seasonal')),
  video_url TEXT,
  display_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  start_date TIMESTAMPTZ,
  end_date TIMESTAMPTZ,
  seo_meta_title TEXT,
  seo_meta_description TEXT,
  seo_keywords TEXT,
  og_title TEXT,
  og_description TEXT,
  og_image_url TEXT,
  canonical_url TEXT,
  schema_type TEXT,
  created_by UUID REFERENCES public.profiles(id),
  updated_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  CONSTRAINT banners_schedule_valid CHECK (start_date IS NULL OR end_date IS NULL OR end_date > start_date)
);

CREATE INDEX idx_banners_active_order ON public.banners (is_active, display_order) WHERE deleted_at IS NULL;
CREATE INDEX idx_banners_category_id ON public.banners (category_id);

ALTER TABLE public.banners ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view live banners" ON public.banners
  FOR SELECT USING (
    is_active = TRUE AND deleted_at IS NULL
    AND (start_date IS NULL OR start_date <= NOW())
    AND (end_date IS NULL OR end_date >= NOW())
  );

CREATE POLICY "Admins can view all banners" ON public.banners
  FOR SELECT USING (public.is_admin());
-- No INSERT/UPDATE/DELETE policy: writes are service-role-only, same as homepage_notifications.

CREATE TRIGGER update_banners_updated_at BEFORE UPDATE ON public.banners
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
```

- [ ] **Step 2: Commit**

```bash
git add supabase/migrations/010_banner_management.sql
git commit -m "feat: add banner_management migration (010) for homepage banner CRUD"
```

(This migration is NOT applied to the live database as part of this plan — that happens in the final "Manual deployment step" section after all code tasks pass their tests.)

---

### Task 2: MediaService banner namespaces

**Files:**
- Modify: `src/lib/services/media-service.ts:8-18`
- Test: `src/lib/services/media-service.test.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: `MEDIA_NAMESPACES` keys `"banner-desktop"` and `"banner-mobile"`, each `{ bucket: "banners", recommendedWidth, recommendedHeight, public: true }`. Later tasks (admin UI upload) pass these namespace strings to the existing `/api/media/upload` route.

- [ ] **Step 1: Write the failing test**

Add to `src/lib/services/media-service.test.ts` (find the existing `describe("validateFile"` or top-level describe block and add a new `it` inside it, or a new top-level block if the file doesn't group by function):

```typescript
describe("banner namespaces", () => {
  it("exposes banner-desktop and banner-mobile with the banners bucket", () => {
    expect(MEDIA_NAMESPACES["banner-desktop"]).toEqual({
      bucket: "banners",
      recommendedWidth: 1600,
      recommendedHeight: 600,
      public: true,
    });
    expect(MEDIA_NAMESPACES["banner-mobile"]).toEqual({
      bucket: "banners",
      recommendedWidth: 750,
      recommendedHeight: 1000,
      public: true,
    });
  });
});
```

Make sure `MEDIA_NAMESPACES` is imported at the top of the test file (it likely already is — check the existing `import` line and add it if missing).

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/lib/services/media-service.test.ts -t "banner namespaces"`
Expected: FAIL — `MEDIA_NAMESPACES["banner-desktop"]` is `undefined`.

- [ ] **Step 3: Update MEDIA_NAMESPACES**

Replace the existing stale `banners` entry in `src/lib/services/media-service.ts`:

```typescript
export const MEDIA_NAMESPACES = {
  // Full-width homepage banner carousel (Phase 1 CMS). Desktop/mobile are separate
  // uploads since they're different aspect ratios, not just responsive resizes.
  "banner-desktop": { bucket: "banners", recommendedWidth: 1600, recommendedHeight: 600, public: true },
  "banner-mobile": { bucket: "banners", recommendedWidth: 750, recommendedHeight: 1000, public: true },
  products: { bucket: "products", recommendedWidth: null, recommendedHeight: null, public: true },
  payments: { bucket: "payments", recommendedWidth: null, recommendedHeight: null, public: false },
  // Brand assets (logos, favicons, category icons). Reuses the public banners bucket —
  // paths are prefixed "branding/" so no new storage bucket/policy is needed.
  branding: { bucket: "banners", recommendedWidth: null, recommendedHeight: null, public: true },
  // UPI QR code. Reuses the public banners bucket — paths are prefixed "upi/" so no new
  // storage bucket/policy is needed, same rationale as the branding namespace above.
  upi: { bucket: "banners", recommendedWidth: null, recommendedHeight: null, public: true },
} as const;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/lib/services/media-service.test.ts`
Expected: PASS, all tests in the file green (confirms nothing else referenced the old `banners` namespace key — if something did, it'll fail here and needs updating to `banner-desktop`/`banner-mobile`).

- [ ] **Step 5: Commit**

```bash
git add src/lib/services/media-service.ts src/lib/services/media-service.test.ts
git commit -m "feat: add banner-desktop/banner-mobile media namespaces"
```

---

### Task 3: Validation schema

**Files:**
- Create: `src/lib/validation/banner.ts`
- Test: `src/lib/validation/banner.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `bannerCreateSchema`, `bannerUpdateSchema`, `bannerReorderSchema`, and types `BannerCreateInput`, `BannerUpdateInput` — consumed by Task 5 (service) and Tasks 6-9 (routes).

- [ ] **Step 1: Write the failing test**

```typescript
// src/lib/validation/banner.test.ts
import { bannerCreateSchema, bannerUpdateSchema, bannerReorderSchema } from "@/lib/validation/banner";

const validBanner = {
  title: "Summer Sale",
  desktop_image_url: "https://example.com/desktop.webp",
  alt_text: "Summer sale banner",
};

describe("bannerCreateSchema", () => {
  it("accepts a minimal valid banner", () => {
    const result = bannerCreateSchema.safeParse(validBanner);
    expect(result.success).toBe(true);
  });

  it("rejects a banner with no title", () => {
    const result = bannerCreateSchema.safeParse({ ...validBanner, title: "" });
    expect(result.success).toBe(false);
  });

  it("rejects a banner with no alt_text", () => {
    const { alt_text: _unused, ...rest } = validBanner;
    const result = bannerCreateSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it("rejects end_date before start_date", () => {
    const result = bannerCreateSchema.safeParse({
      ...validBanner,
      start_date: "2026-08-01T00:00:00Z",
      end_date: "2026-07-01T00:00:00Z",
    });
    expect(result.success).toBe(false);
  });

  it("rejects overlay_opacity outside 0-1", () => {
    const result = bannerCreateSchema.safeParse({ ...validBanner, overlay_opacity: 1.5 });
    expect(result.success).toBe(false);
  });

  it("rejects a cta_url that isn't relative or http(s)", () => {
    const result = bannerCreateSchema.safeParse({ ...validBanner, cta_url: "javascript:alert(1)" });
    expect(result.success).toBe(false);
  });

  it("accepts a relative cta_url", () => {
    const result = bannerCreateSchema.safeParse({ ...validBanner, cta_url: "/catalog/pokemon" });
    expect(result.success).toBe(true);
  });
});

describe("bannerUpdateSchema", () => {
  it("accepts a partial patch", () => {
    const result = bannerUpdateSchema.safeParse({ is_active: false });
    expect(result.success).toBe(true);
  });

  it("rejects an empty patch", () => {
    const result = bannerUpdateSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});

describe("bannerReorderSchema", () => {
  it("accepts an array of uuids", () => {
    const result = bannerReorderSchema.safeParse({
      ids: ["550e8400-e29b-41d4-a716-446655440000"],
    });
    expect(result.success).toBe(true);
  });

  it("rejects an empty array", () => {
    const result = bannerReorderSchema.safeParse({ ids: [] });
    expect(result.success).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/lib/validation/banner.test.ts`
Expected: FAIL — cannot find module `@/lib/validation/banner`.

- [ ] **Step 3: Write the schema**

```typescript
// src/lib/validation/banner.ts
import { z } from "zod";

export const BANNER_TYPES = ["image", "video", "promotional", "seasonal"] as const;

const isoDate = z.string().refine((v) => !Number.isNaN(Date.parse(v)), "Invalid date");

// Relative path ("/catalog/pokemon") or absolute http(s) URL — same rule as notifications' cta_url.
const ctaUrl = z
  .string()
  .max(500)
  .refine(
    (v) => v.startsWith("/") || /^https?:\/\/.+/.test(v),
    "CTA link must be a relative path or an http(s) URL"
  );

const baseFields = {
  title: z.string().min(1, "Title is required").max(120),
  subtitle: z.string().max(200).nullish(),
  cta_text: z.string().max(40).nullish(),
  cta_url: ctaUrl.nullish(),
  category_id: z.string().uuid().nullish(),
  desktop_image_url: z.string().min(1, "Desktop image is required"),
  mobile_image_url: z.string().nullish(),
  alt_text: z.string().min(1, "Alt text is required").max(200),
  aria_label: z.string().max(200).nullish(),
  image_title: z.string().max(200).nullish(),
  overlay_enabled: z.boolean().default(false),
  overlay_opacity: z.number().min(0).max(1).default(0.4),
  banner_type: z.enum(BANNER_TYPES).default("image"),
  video_url: z.string().max(500).nullish(),
  display_order: z.number().int().min(0).optional(),
  is_active: z.boolean().default(true),
  start_date: isoDate.nullish(),
  end_date: isoDate.nullish(),
  // Future-ready SEO fields — stored and admin-editable, never rendered on the frontend yet.
  seo_meta_title: z.string().max(200).nullish(),
  seo_meta_description: z.string().max(300).nullish(),
  seo_keywords: z.string().max(300).nullish(),
  og_title: z.string().max(200).nullish(),
  og_description: z.string().max(300).nullish(),
  og_image_url: z.string().max(500).nullish(),
  canonical_url: z.string().max(500).nullish(),
  schema_type: z.string().max(60).nullish(),
};

function scheduleValid(data: { start_date?: string | null; end_date?: string | null }) {
  if (!data.start_date || !data.end_date) return true;
  return Date.parse(data.end_date) > Date.parse(data.start_date);
}

export const bannerCreateSchema = z
  .object(baseFields)
  .refine(scheduleValid, { message: "End date must be after start date", path: ["end_date"] });

export const bannerUpdateSchema = z
  .object(baseFields)
  .partial()
  .refine((d) => Object.keys(d).length > 0, "No fields to update")
  .refine(scheduleValid, { message: "End date must be after start date", path: ["end_date"] });

export const bannerReorderSchema = z.object({
  ids: z.array(z.string().uuid()).min(1, "ids required"),
});

export type BannerCreateInput = z.infer<typeof bannerCreateSchema>;
export type BannerUpdateInput = z.infer<typeof bannerUpdateSchema>;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/lib/validation/banner.test.ts`
Expected: PASS, all tests green.

- [ ] **Step 5: Commit**

```bash
git add src/lib/validation/banner.ts src/lib/validation/banner.test.ts
git commit -m "feat: add banner validation schemas"
```

---

### Task 4: Repository layer

**Files:**
- Create: `src/lib/repositories/banner-repository.ts`
- Test: `src/lib/repositories/banner-repository.test.ts`

**Interfaces:**
- Consumes: `process.env.SUPABASE_SERVICE_ROLE_KEY`, `process.env.NEXT_PUBLIC_SUPABASE_URL` (same env vars every other repository uses).
- Produces: `BannerRow` type; `listBanners()`, `listActiveBanners(nowIso)`, `getBanner(id)`, `getMaxDisplayOrder()`, `insertBanner(values)`, `updateBanner(id, patch)`, `softDeleteBanner(id, userId)`, `reorderBanners(ids, userId)` — all consumed by Task 5 (service).

- [ ] **Step 1: Write the failing test**

```typescript
// src/lib/repositories/banner-repository.test.ts
/**
 * @jest-environment node
 */
const originalFetch = global.fetch;

beforeEach(() => {
  process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-key";
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
  global.fetch = jest.fn();
});

afterEach(() => {
  global.fetch = originalFetch;
  jest.resetModules();
});

describe("banner-repository", () => {
  it("listBanners requests non-deleted rows ordered by display_order", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => [{ id: "b1" }],
    });
    const { listBanners } = await import("@/lib/repositories/banner-repository");

    const rows = await listBanners();

    expect(rows).toEqual([{ id: "b1" }]);
    const [url] = (global.fetch as jest.Mock).mock.calls[0];
    expect(url).toContain("deleted_at=is.null");
    expect(url).toContain("order=display_order.asc");
  });

  it("listActiveBanners filters by is_active, schedule window, and deleted_at", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({ ok: true, json: async () => [] });
    const { listActiveBanners } = await import("@/lib/repositories/banner-repository");

    await listActiveBanners("2026-07-23T00:00:00Z");

    const [url] = (global.fetch as jest.Mock).mock.calls[0];
    expect(url).toContain("is_active=eq.true");
    expect(url).toContain("deleted_at=is.null");
  });

  it("insertBanner POSTs to the banners table and returns the created row", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => [{ id: "b1", title: "Sale" }],
    });
    const { insertBanner } = await import("@/lib/repositories/banner-repository");

    const row = await insertBanner({ title: "Sale" });

    expect(row).toEqual({ id: "b1", title: "Sale" });
    const [url, options] = (global.fetch as jest.Mock).mock.calls[0];
    expect(url).toContain("/rest/v1/banners");
    expect(options.method).toBe("POST");
  });

  it("reorderBanners PATCHes each id with its new display_order", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({ ok: true, json: async () => [{}] });
    const { reorderBanners } = await import("@/lib/repositories/banner-repository");

    await reorderBanners(["b1", "b2"], "admin-1");

    expect(global.fetch).toHaveBeenCalledTimes(2);
    const secondCallBody = JSON.parse((global.fetch as jest.Mock).mock.calls[1][1].body);
    expect(secondCallBody).toEqual({ display_order: 1, updated_by: "admin-1" });
  });

  it("throws when the PostgREST response is not ok", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({ ok: false, status: 500 });
    const { listBanners } = await import("@/lib/repositories/banner-repository");

    await expect(listBanners()).rejects.toThrow("Failed to list banners: 500");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/lib/repositories/banner-repository.test.ts`
Expected: FAIL — cannot find module `@/lib/repositories/banner-repository`.

- [ ] **Step 3: Write the repository**

```typescript
// src/lib/repositories/banner-repository.ts
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;

const HEADERS = {
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
  "Content-Type": "application/json",
};
const WRITE_HEADERS = { ...HEADERS, Prefer: "return=representation" };

const TABLE = `${SUPABASE_URL}/rest/v1/banners`;

export interface BannerRow {
  id: string;
  title: string;
  subtitle: string | null;
  cta_text: string | null;
  cta_url: string | null;
  category_id: string | null;
  desktop_image_url: string;
  mobile_image_url: string | null;
  alt_text: string;
  aria_label: string | null;
  image_title: string | null;
  overlay_enabled: boolean;
  overlay_opacity: number;
  banner_type: string;
  video_url: string | null;
  display_order: number;
  is_active: boolean;
  start_date: string | null;
  end_date: string | null;
  seo_meta_title: string | null;
  seo_meta_description: string | null;
  seo_keywords: string | null;
  og_title: string | null;
  og_description: string | null;
  og_image_url: string | null;
  canonical_url: string | null;
  schema_type: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

/** All non-deleted rows for the admin panel, in display order. */
export async function listBanners(): Promise<BannerRow[]> {
  const res = await fetch(`${TABLE}?deleted_at=is.null&order=display_order.asc`, {
    headers: HEADERS,
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Failed to list banners: ${res.status}`);
  return res.json();
}

/** Live rows for the storefront: active, not deleted, inside schedule window. */
export async function listActiveBanners(nowIso: string): Promise<BannerRow[]> {
  const params = new URLSearchParams();
  params.set("is_active", "eq.true");
  params.set("deleted_at", "is.null");
  params.append("or", `(start_date.is.null,start_date.lte.${nowIso})`);
  params.append("or", `(end_date.is.null,end_date.gte.${nowIso})`);
  params.set("order", "display_order.asc");

  const res = await fetch(`${TABLE}?${params.toString()}`, { headers: HEADERS, cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to list active banners: ${res.status}`);
  return res.json();
}

export async function getBanner(id: string): Promise<BannerRow | null> {
  const res = await fetch(`${TABLE}?id=eq.${encodeURIComponent(id)}&deleted_at=is.null&limit=1`, {
    headers: HEADERS,
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Failed to get banner: ${res.status}`);
  const rows = await res.json();
  return rows[0] ?? null;
}

export async function getMaxDisplayOrder(): Promise<number> {
  const res = await fetch(
    `${TABLE}?deleted_at=is.null&select=display_order&order=display_order.desc&limit=1`,
    { headers: HEADERS, cache: "no-store" }
  );
  const rows = res.ok ? await res.json() : [];
  return rows?.[0]?.display_order ?? -1;
}

export async function insertBanner(values: Record<string, unknown>): Promise<BannerRow> {
  const res = await fetch(TABLE, {
    method: "POST",
    headers: WRITE_HEADERS,
    body: JSON.stringify(values),
  });
  if (!res.ok) throw new Error(`Failed to insert banner: ${res.status}`);
  const rows = await res.json();
  return rows[0];
}

export async function updateBanner(
  id: string,
  patch: Record<string, unknown>
): Promise<BannerRow | null> {
  const res = await fetch(`${TABLE}?id=eq.${encodeURIComponent(id)}&deleted_at=is.null`, {
    method: "PATCH",
    headers: WRITE_HEADERS,
    body: JSON.stringify(patch),
  });
  if (!res.ok) throw new Error(`Failed to update banner: ${res.status}`);
  const rows = await res.json();
  return rows[0] ?? null;
}

export async function softDeleteBanner(id: string, userId: string): Promise<boolean> {
  const row = await updateBanner(id, { deleted_at: new Date().toISOString(), updated_by: userId });
  return row !== null;
}

/** Rewrites display_order to match the given id order (0..n-1). */
export async function reorderBanners(ids: string[], userId: string): Promise<void> {
  for (let i = 0; i < ids.length; i++) {
    const res = await fetch(`${TABLE}?id=eq.${encodeURIComponent(ids[i])}&deleted_at=is.null`, {
      method: "PATCH",
      headers: HEADERS,
      body: JSON.stringify({ display_order: i, updated_by: userId }),
    });
    if (!res.ok) throw new Error(`Failed to reorder banner ${ids[i]}: ${res.status}`);
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/lib/repositories/banner-repository.test.ts`
Expected: PASS, all tests green.

- [ ] **Step 5: Commit**

```bash
git add src/lib/repositories/banner-repository.ts src/lib/repositories/banner-repository.test.ts
git commit -m "feat: add banner repository"
```

---

### Task 5: Service layer

**Files:**
- Create: `src/lib/services/banner-service.ts`
- Test: `src/lib/services/banner-service.test.ts`

**Interfaces:**
- Consumes: everything from Task 4 (`banner-repository.ts`), types from Task 3 (`BannerCreateInput`, `BannerUpdateInput`).
- Produces: `getHomepageBanners()`, `listAllBanners()`, `createBanner(input, adminId)`, `updateBannerById(id, patch, adminId)`, `deleteBanner(id, adminId)`, `duplicateBanner(id, adminId)`, `reorder(ids, adminId)` — consumed by Tasks 6-9 (routes) and Task 11 (homepage page).

- [ ] **Step 1: Write the failing test**

```typescript
// src/lib/services/banner-service.test.ts
jest.mock("@/lib/repositories/banner-repository", () => ({
  listBanners: jest.fn(),
  listActiveBanners: jest.fn(),
  getBanner: jest.fn(),
  getMaxDisplayOrder: jest.fn(),
  insertBanner: jest.fn(),
  updateBanner: jest.fn(),
  softDeleteBanner: jest.fn(),
  reorderBanners: jest.fn(),
}));

import * as repo from "@/lib/repositories/banner-repository";
import {
  getHomepageBanners,
  createBanner,
  duplicateBanner,
  updateBannerById,
} from "@/lib/services/banner-service";

const mockRepo = repo as jest.Mocked<typeof repo>;

afterEach(() => jest.clearAllMocks());

describe("getHomepageBanners", () => {
  it("returns active banners", async () => {
    mockRepo.listActiveBanners.mockResolvedValue([{ id: "b1" }] as never);
    const result = await getHomepageBanners();
    expect(result).toEqual([{ id: "b1" }]);
  });

  it("never throws — returns an empty array if the repository fails", async () => {
    mockRepo.listActiveBanners.mockRejectedValue(new Error("db down"));
    const result = await getHomepageBanners();
    expect(result).toEqual([]);
  });
});

describe("createBanner", () => {
  it("assigns the next display_order and stamps created_by/updated_by", async () => {
    mockRepo.getMaxDisplayOrder.mockResolvedValue(2);
    mockRepo.insertBanner.mockResolvedValue({ id: "b1" } as never);

    await createBanner({ title: "Sale" } as never, "admin-1");

    expect(mockRepo.insertBanner).toHaveBeenCalledWith(
      expect.objectContaining({ display_order: 3, created_by: "admin-1", updated_by: "admin-1" })
    );
  });
});

describe("updateBannerById", () => {
  it("prefers an explicit cta_url over category_id when both are set", async () => {
    mockRepo.updateBanner.mockResolvedValue({ id: "b1" } as never);

    await updateBannerById("b1", { cta_url: "/sale", category_id: "cat-1" } as never, "admin-1");

    expect(mockRepo.updateBanner).toHaveBeenCalledWith(
      "b1",
      expect.objectContaining({ cta_url: "/sale", category_id: null })
    );
  });
});

describe("duplicateBanner", () => {
  it("copies the source with a (Copy) suffix, inactive, at the end of the order", async () => {
    mockRepo.getBanner.mockResolvedValue({
      id: "b1",
      title: "Sale",
      display_order: 0,
      is_active: true,
      created_at: "x",
      updated_at: "x",
      deleted_at: null,
      created_by: "admin-0",
      updated_by: "admin-0",
    } as never);
    mockRepo.getMaxDisplayOrder.mockResolvedValue(2);
    mockRepo.insertBanner.mockResolvedValue({ id: "b2" } as never);

    const result = await duplicateBanner("b1", "admin-1");

    expect(result).toEqual({ id: "b2" });
    expect(mockRepo.insertBanner).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Sale (Copy)",
        is_active: false,
        display_order: 3,
        created_by: "admin-1",
        updated_by: "admin-1",
      })
    );
  });

  it("returns null when the source doesn't exist", async () => {
    mockRepo.getBanner.mockResolvedValue(null);
    const result = await duplicateBanner("missing", "admin-1");
    expect(result).toBeNull();
    expect(mockRepo.insertBanner).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/lib/services/banner-service.test.ts`
Expected: FAIL — cannot find module `@/lib/services/banner-service`.

- [ ] **Step 3: Write the service**

```typescript
// src/lib/services/banner-service.ts
import {
  listBanners,
  listActiveBanners,
  getBanner,
  getMaxDisplayOrder,
  insertBanner,
  updateBanner as repoUpdate,
  softDeleteBanner,
  reorderBanners,
  type BannerRow,
} from "@/lib/repositories/banner-repository";
import type { BannerCreateInput, BannerUpdateInput } from "@/lib/validation/banner";

export type { BannerRow };

/** Storefront feed. Never throws — the homepage must render without banners if Supabase
 * is unreachable or the migration hasn't been applied yet (matches getHomepageNotifications). */
export async function getHomepageBanners(): Promise<BannerRow[]> {
  try {
    return await listActiveBanners(new Date().toISOString());
  } catch (error) {
    console.error("Failed to load homepage banners", error);
    return [];
  }
}

export async function listAllBanners(): Promise<BannerRow[]> {
  return listBanners();
}

/** If both cta_url and category_id are present, cta_url wins and category_id is cleared. */
function resolveCtaPrecedence<T extends { cta_url?: string | null; category_id?: string | null }>(
  fields: T
): T {
  if (fields.cta_url && fields.category_id) {
    return { ...fields, category_id: null };
  }
  return fields;
}

export async function createBanner(
  input: BannerCreateInput,
  adminId: string
): Promise<BannerRow> {
  const display_order = input.display_order ?? (await getMaxDisplayOrder()) + 1;
  return insertBanner({
    ...resolveCtaPrecedence(input),
    display_order,
    created_by: adminId,
    updated_by: adminId,
  });
}

export async function updateBannerById(
  id: string,
  patch: BannerUpdateInput,
  adminId: string
): Promise<BannerRow | null> {
  return repoUpdate(id, { ...resolveCtaPrecedence(patch), updated_by: adminId });
}

export async function deleteBanner(id: string, adminId: string): Promise<boolean> {
  return softDeleteBanner(id, adminId);
}

/** Copies an existing banner as an inactive draft appended at the end. */
export async function duplicateBanner(
  id: string,
  adminId: string
): Promise<BannerRow | null> {
  const source = await getBanner(id);
  if (!source) return null;
  const {
    id: _id,
    created_at: _c,
    updated_at: _u,
    deleted_at: _d,
    created_by: _cb,
    updated_by: _ub,
    display_order: _o,
    ...fields
  } = source;
  return insertBanner({
    ...fields,
    title: `${source.title} (Copy)`,
    is_active: false,
    display_order: (await getMaxDisplayOrder()) + 1,
    created_by: adminId,
    updated_by: adminId,
  });
}

export async function reorder(ids: string[], adminId: string): Promise<void> {
  return reorderBanners(ids, adminId);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/lib/services/banner-service.test.ts`
Expected: PASS, all tests green.

- [ ] **Step 5: Commit**

```bash
git add src/lib/services/banner-service.ts src/lib/services/banner-service.test.ts
git commit -m "feat: add banner service"
```

---

### Task 6: API route — list + create

**Files:**
- Create: `src/app/api/admin/banners/route.ts`
- Test: `src/app/api/admin/banners/route.test.ts`

**Interfaces:**
- Consumes: `requireAdmin` (`@/lib/supabase/admin-auth`), `checkRateLimit`/`rateLimitResponse` (`@/lib/rate-limit`), `recordAuditLog` (`@/lib/services/audit-service`), `bannerCreateSchema` (Task 3), `listAllBanners`/`createBanner` (Task 5).
- Produces: `GET`/`POST` handlers at `/api/admin/banners`.

- [ ] **Step 1: Write the failing test**

```typescript
// src/app/api/admin/banners/route.test.ts
/**
 * @jest-environment node
 */
const mockCheckRateLimit = jest.fn();
jest.mock("@/lib/rate-limit", () => {
  const actual = jest.requireActual("@/lib/rate-limit");
  return { ...actual, checkRateLimit: (...args: unknown[]) => mockCheckRateLimit(...args) };
});

const mockRequireAdmin = jest.fn();
jest.mock("@/lib/supabase/admin-auth", () => ({
  requireAdmin: () => mockRequireAdmin(),
}));

const mockRecordAuditLog = jest.fn();
jest.mock("@/lib/services/audit-service", () => ({
  recordAuditLog: (...args: unknown[]) => mockRecordAuditLog(...args),
}));

const mockListAllBanners = jest.fn();
const mockCreateBanner = jest.fn();
jest.mock("@/lib/services/banner-service", () => ({
  listAllBanners: (...args: unknown[]) => mockListAllBanners(...args),
  createBanner: (...args: unknown[]) => mockCreateBanner(...args),
}));

import { NextRequest } from "next/server";
import { GET, POST } from "@/app/api/admin/banners/route";

const validBody = {
  title: "Summer Sale",
  desktop_image_url: "https://example.com/desktop.webp",
  alt_text: "Summer sale banner",
};

function makeGet() {
  return new NextRequest("http://localhost/api/admin/banners");
}
function makePost(body: unknown) {
  return new NextRequest("http://localhost/api/admin/banners", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

const adminOk = { ok: true, userId: "admin-1" };

describe("GET /api/admin/banners", () => {
  afterEach(() => jest.clearAllMocks());

  it("returns 429 when rate-limited", async () => {
    mockCheckRateLimit.mockReturnValue({ allowed: false, remaining: 0, resetAt: Date.now() });
    const response = await GET(makeGet());
    expect(response.status).toBe(429);
  });

  it("returns 401-shaped response when not admin", async () => {
    mockCheckRateLimit.mockReturnValue({ allowed: true, remaining: 10, resetAt: Date.now() });
    const fakeResponse = new Response(null, { status: 401 });
    mockRequireAdmin.mockResolvedValue({ ok: false, response: fakeResponse });
    const response = await GET(makeGet());
    expect(response.status).toBe(401);
  });

  it("returns the banner list for an admin", async () => {
    mockCheckRateLimit.mockReturnValue({ allowed: true, remaining: 10, resetAt: Date.now() });
    mockRequireAdmin.mockResolvedValue(adminOk);
    mockListAllBanners.mockResolvedValue([{ id: "b1" }]);

    const response = await GET(makeGet());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual([{ id: "b1" }]);
  });
});

describe("POST /api/admin/banners", () => {
  afterEach(() => jest.clearAllMocks());

  it("returns 400 when the body fails validation", async () => {
    mockCheckRateLimit.mockReturnValue({ allowed: true, remaining: 10, resetAt: Date.now() });
    mockRequireAdmin.mockResolvedValue(adminOk);

    const response = await POST(makePost({ title: "" }));
    expect(response.status).toBe(400);
  });

  it("creates a banner and records an audit log entry", async () => {
    mockCheckRateLimit.mockReturnValue({ allowed: true, remaining: 10, resetAt: Date.now() });
    mockRequireAdmin.mockResolvedValue(adminOk);
    mockCreateBanner.mockResolvedValue({ id: "b1", ...validBody });

    const response = await POST(makePost(validBody));
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.id).toBe("b1");
    expect(mockRecordAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "admin-1", action: "banner.create", recordId: "b1" })
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/app/api/admin/banners/route.test.ts`
Expected: FAIL — cannot find module `@/app/api/admin/banners/route`.

- [ ] **Step 3: Write the route**

```typescript
// src/app/api/admin/banners/route.ts
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/supabase/admin-auth";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { recordAuditLog } from "@/lib/services/audit-service";
import { bannerCreateSchema } from "@/lib/validation/banner";
import { listAllBanners, createBanner } from "@/lib/services/banner-service";

export async function GET(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for") ?? "unknown";
  const rl = checkRateLimit(`banners:${ip}`, 60, 60_000);
  if (!rl.allowed) return rateLimitResponse(rl.resetAt);

  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  try {
    return NextResponse.json(await listAllBanners());
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for") ?? "unknown";
  const rl = checkRateLimit(`banners:${ip}`, 60, 60_000);
  if (!rl.allowed) return rateLimitResponse(rl.resetAt);

  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const parsed = bannerCreateSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  try {
    const created = await createBanner(parsed.data, auth.userId);
    await recordAuditLog({
      userId: auth.userId,
      action: "banner.create",
      tableName: "banners",
      recordId: created.id,
      newValues: parsed.data,
    });
    return NextResponse.json(created, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Failed to create banner" }, { status: 500 });
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/app/api/admin/banners/route.test.ts`
Expected: PASS, all tests green.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/admin/banners/route.ts src/app/api/admin/banners/route.test.ts
git commit -m "feat: add GET/POST /api/admin/banners"
```

---

### Task 7: API route — update + soft delete

**Files:**
- Create: `src/app/api/admin/banners/[id]/route.ts`
- Test: `src/app/api/admin/banners/[id]/route.test.ts`

**Interfaces:**
- Consumes: `bannerUpdateSchema` (Task 3), `updateBannerById`/`deleteBanner` (Task 5).
- Produces: `PATCH`/`DELETE` handlers at `/api/admin/banners/[id]`.

- [ ] **Step 1: Write the failing test**

```typescript
// src/app/api/admin/banners/[id]/route.test.ts
/**
 * @jest-environment node
 */
const mockCheckRateLimit = jest.fn();
jest.mock("@/lib/rate-limit", () => {
  const actual = jest.requireActual("@/lib/rate-limit");
  return { ...actual, checkRateLimit: (...args: unknown[]) => mockCheckRateLimit(...args) };
});

const mockRequireAdmin = jest.fn();
jest.mock("@/lib/supabase/admin-auth", () => ({ requireAdmin: () => mockRequireAdmin() }));

const mockRecordAuditLog = jest.fn();
jest.mock("@/lib/services/audit-service", () => ({
  recordAuditLog: (...args: unknown[]) => mockRecordAuditLog(...args),
}));

const mockUpdateBannerById = jest.fn();
const mockDeleteBanner = jest.fn();
jest.mock("@/lib/services/banner-service", () => ({
  updateBannerById: (...args: unknown[]) => mockUpdateBannerById(...args),
  deleteBanner: (...args: unknown[]) => mockDeleteBanner(...args),
}));

import { NextRequest } from "next/server";
import { PATCH, DELETE } from "@/app/api/admin/banners/[id]/route";

const adminOk = { ok: true, userId: "admin-1" };
const params = Promise.resolve({ id: "b1" });

function makePatch(body: unknown) {
  return new NextRequest("http://localhost/api/admin/banners/b1", {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}
function makeDelete() {
  return new NextRequest("http://localhost/api/admin/banners/b1", { method: "DELETE" });
}

describe("PATCH /api/admin/banners/[id]", () => {
  afterEach(() => jest.clearAllMocks());

  it("returns 404 when the banner doesn't exist", async () => {
    mockCheckRateLimit.mockReturnValue({ allowed: true, remaining: 10, resetAt: Date.now() });
    mockRequireAdmin.mockResolvedValue(adminOk);
    mockUpdateBannerById.mockResolvedValue(null);

    const response = await PATCH(makePatch({ is_active: false }), { params });
    expect(response.status).toBe(404);
  });

  it("updates and audit-logs the change", async () => {
    mockCheckRateLimit.mockReturnValue({ allowed: true, remaining: 10, resetAt: Date.now() });
    mockRequireAdmin.mockResolvedValue(adminOk);
    mockUpdateBannerById.mockResolvedValue({ id: "b1", is_active: false });

    const response = await PATCH(makePatch({ is_active: false }), { params });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.is_active).toBe(false);
    expect(mockRecordAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: "banner.update", recordId: "b1" })
    );
  });
});

describe("DELETE /api/admin/banners/[id]", () => {
  afterEach(() => jest.clearAllMocks());

  it("returns 404 when the banner doesn't exist", async () => {
    mockCheckRateLimit.mockReturnValue({ allowed: true, remaining: 10, resetAt: Date.now() });
    mockRequireAdmin.mockResolvedValue(adminOk);
    mockDeleteBanner.mockResolvedValue(false);

    const response = await DELETE(makeDelete(), { params });
    expect(response.status).toBe(404);
  });

  it("soft-deletes and audit-logs", async () => {
    mockCheckRateLimit.mockReturnValue({ allowed: true, remaining: 10, resetAt: Date.now() });
    mockRequireAdmin.mockResolvedValue(adminOk);
    mockDeleteBanner.mockResolvedValue(true);

    const response = await DELETE(makeDelete(), { params });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(mockRecordAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: "banner.delete", recordId: "b1" })
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest "src/app/api/admin/banners/\[id\]/route.test.ts"`
Expected: FAIL — cannot find module.

- [ ] **Step 3: Write the route**

```typescript
// src/app/api/admin/banners/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/supabase/admin-auth";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { recordAuditLog } from "@/lib/services/audit-service";
import { bannerUpdateSchema } from "@/lib/validation/banner";
import { updateBannerById, deleteBanner } from "@/lib/services/banner-service";

type RouteParams = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const ip = req.headers.get("x-forwarded-for") ?? "unknown";
  const rl = checkRateLimit(`banners:${ip}`, 60, 60_000);
  if (!rl.allowed) return rateLimitResponse(rl.resetAt);

  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const parsed = bannerUpdateSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  try {
    const updated = await updateBannerById(id, parsed.data, auth.userId);
    if (!updated) return NextResponse.json({ error: "Banner not found" }, { status: 404 });

    await recordAuditLog({
      userId: auth.userId,
      action: "banner.update",
      tableName: "banners",
      recordId: id,
      newValues: parsed.data,
    });
    return NextResponse.json(updated);
  } catch {
    return NextResponse.json({ error: "Failed to update banner" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: RouteParams) {
  const ip = req.headers.get("x-forwarded-for") ?? "unknown";
  const rl = checkRateLimit(`banners:${ip}`, 60, 60_000);
  if (!rl.allowed) return rateLimitResponse(rl.resetAt);

  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const { id } = await params;
  try {
    const deleted = await deleteBanner(id, auth.userId);
    if (!deleted) return NextResponse.json({ error: "Banner not found" }, { status: 404 });

    await recordAuditLog({
      userId: auth.userId,
      action: "banner.delete",
      tableName: "banners",
      recordId: id,
    });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Failed to delete banner" }, { status: 500 });
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest "src/app/api/admin/banners/\[id\]/route.test.ts"`
Expected: PASS, all tests green.

- [ ] **Step 5: Commit**

```bash
git add "src/app/api/admin/banners/[id]/route.ts" "src/app/api/admin/banners/[id]/route.test.ts"
git commit -m "feat: add PATCH/DELETE /api/admin/banners/[id]"
```

---

### Task 8: API route — duplicate

**Files:**
- Create: `src/app/api/admin/banners/[id]/duplicate/route.ts`
- Test: `src/app/api/admin/banners/[id]/duplicate/route.test.ts`

**Interfaces:**
- Consumes: `duplicateBanner` (Task 5).
- Produces: `POST` handler at `/api/admin/banners/[id]/duplicate`.

- [ ] **Step 1: Write the failing test**

```typescript
// src/app/api/admin/banners/[id]/duplicate/route.test.ts
/**
 * @jest-environment node
 */
const mockCheckRateLimit = jest.fn();
jest.mock("@/lib/rate-limit", () => {
  const actual = jest.requireActual("@/lib/rate-limit");
  return { ...actual, checkRateLimit: (...args: unknown[]) => mockCheckRateLimit(...args) };
});

const mockRequireAdmin = jest.fn();
jest.mock("@/lib/supabase/admin-auth", () => ({ requireAdmin: () => mockRequireAdmin() }));

const mockRecordAuditLog = jest.fn();
jest.mock("@/lib/services/audit-service", () => ({
  recordAuditLog: (...args: unknown[]) => mockRecordAuditLog(...args),
}));

const mockDuplicateBanner = jest.fn();
jest.mock("@/lib/services/banner-service", () => ({
  duplicateBanner: (...args: unknown[]) => mockDuplicateBanner(...args),
}));

import { NextRequest } from "next/server";
import { POST } from "@/app/api/admin/banners/[id]/duplicate/route";

const adminOk = { ok: true, userId: "admin-1" };
const params = Promise.resolve({ id: "b1" });

function makeRequest() {
  return new NextRequest("http://localhost/api/admin/banners/b1/duplicate", { method: "POST" });
}

describe("POST /api/admin/banners/[id]/duplicate", () => {
  afterEach(() => jest.clearAllMocks());

  it("returns 404 when the source banner doesn't exist", async () => {
    mockCheckRateLimit.mockReturnValue({ allowed: true, remaining: 10, resetAt: Date.now() });
    mockRequireAdmin.mockResolvedValue(adminOk);
    mockDuplicateBanner.mockResolvedValue(null);

    const response = await POST(makeRequest(), { params });
    expect(response.status).toBe(404);
  });

  it("duplicates and audit-logs with the source id", async () => {
    mockCheckRateLimit.mockReturnValue({ allowed: true, remaining: 10, resetAt: Date.now() });
    mockRequireAdmin.mockResolvedValue(adminOk);
    mockDuplicateBanner.mockResolvedValue({ id: "b2", title: "Sale (Copy)" });

    const response = await POST(makeRequest(), { params });
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.id).toBe("b2");
    expect(mockRecordAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: "banner.duplicate", recordId: "b2", oldValues: { sourceId: "b1" } })
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest "src/app/api/admin/banners/\[id\]/duplicate/route.test.ts"`
Expected: FAIL — cannot find module.

- [ ] **Step 3: Write the route**

```typescript
// src/app/api/admin/banners/[id]/duplicate/route.ts
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/supabase/admin-auth";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { recordAuditLog } from "@/lib/services/audit-service";
import { duplicateBanner } from "@/lib/services/banner-service";

type RouteParams = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: RouteParams) {
  const ip = req.headers.get("x-forwarded-for") ?? "unknown";
  const rl = checkRateLimit(`banners:${ip}`, 60, 60_000);
  if (!rl.allowed) return rateLimitResponse(rl.resetAt);

  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const { id } = await params;
  try {
    const copy = await duplicateBanner(id, auth.userId);
    if (!copy) return NextResponse.json({ error: "Banner not found" }, { status: 404 });

    await recordAuditLog({
      userId: auth.userId,
      action: "banner.duplicate",
      tableName: "banners",
      recordId: copy.id,
      oldValues: { sourceId: id },
    });
    return NextResponse.json(copy, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Failed to duplicate banner" }, { status: 500 });
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest "src/app/api/admin/banners/\[id\]/duplicate/route.test.ts"`
Expected: PASS, all tests green.

- [ ] **Step 5: Commit**

```bash
git add "src/app/api/admin/banners/[id]/duplicate/route.ts" "src/app/api/admin/banners/[id]/duplicate/route.test.ts"
git commit -m "feat: add POST /api/admin/banners/[id]/duplicate"
```

---

### Task 9: API route — reorder

**Files:**
- Create: `src/app/api/admin/banners/reorder/route.ts`
- Test: `src/app/api/admin/banners/reorder/route.test.ts`

**Interfaces:**
- Consumes: `bannerReorderSchema` (Task 3), `reorder` (Task 5).
- Produces: `POST` handler at `/api/admin/banners/reorder`.

- [ ] **Step 1: Write the failing test**

```typescript
// src/app/api/admin/banners/reorder/route.test.ts
/**
 * @jest-environment node
 */
const mockCheckRateLimit = jest.fn();
jest.mock("@/lib/rate-limit", () => {
  const actual = jest.requireActual("@/lib/rate-limit");
  return { ...actual, checkRateLimit: (...args: unknown[]) => mockCheckRateLimit(...args) };
});

const mockRequireAdmin = jest.fn();
jest.mock("@/lib/supabase/admin-auth", () => ({ requireAdmin: () => mockRequireAdmin() }));

const mockRecordAuditLog = jest.fn();
jest.mock("@/lib/services/audit-service", () => ({
  recordAuditLog: (...args: unknown[]) => mockRecordAuditLog(...args),
}));

const mockReorder = jest.fn();
jest.mock("@/lib/services/banner-service", () => ({
  reorder: (...args: unknown[]) => mockReorder(...args),
}));

import { NextRequest } from "next/server";
import { POST } from "@/app/api/admin/banners/reorder/route";

const adminOk = { ok: true, userId: "admin-1" };

function makeRequest(body: unknown) {
  return new NextRequest("http://localhost/api/admin/banners/reorder", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

describe("POST /api/admin/banners/reorder", () => {
  afterEach(() => jest.clearAllMocks());

  it("returns 400 for an empty ids array", async () => {
    mockCheckRateLimit.mockReturnValue({ allowed: true, remaining: 10, resetAt: Date.now() });
    mockRequireAdmin.mockResolvedValue(adminOk);

    const response = await POST(makeRequest({ ids: [] }));
    expect(response.status).toBe(400);
  });

  it("reorders and audit-logs the new order", async () => {
    mockCheckRateLimit.mockReturnValue({ allowed: true, remaining: 10, resetAt: Date.now() });
    mockRequireAdmin.mockResolvedValue(adminOk);
    mockReorder.mockResolvedValue(undefined);

    const ids = ["550e8400-e29b-41d4-a716-446655440000"];
    const response = await POST(makeRequest({ ids }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(mockReorder).toHaveBeenCalledWith(ids, "admin-1");
    expect(mockRecordAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: "banner.reorder", newValues: { ids } })
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/app/api/admin/banners/reorder/route.test.ts`
Expected: FAIL — cannot find module.

- [ ] **Step 3: Write the route**

```typescript
// src/app/api/admin/banners/reorder/route.ts
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/supabase/admin-auth";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { recordAuditLog } from "@/lib/services/audit-service";
import { bannerReorderSchema } from "@/lib/validation/banner";
import { reorder } from "@/lib/services/banner-service";

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for") ?? "unknown";
  const rl = checkRateLimit(`banners:${ip}`, 60, 60_000);
  if (!rl.allowed) return rateLimitResponse(rl.resetAt);

  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const parsed = bannerReorderSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  try {
    await reorder(parsed.data.ids, auth.userId);
    await recordAuditLog({
      userId: auth.userId,
      action: "banner.reorder",
      tableName: "banners",
      newValues: { ids: parsed.data.ids },
    });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Failed to reorder banners" }, { status: 500 });
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/app/api/admin/banners/reorder/route.test.ts`
Expected: PASS, all tests green.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/admin/banners/reorder/route.ts src/app/api/admin/banners/reorder/route.test.ts
git commit -m "feat: add POST /api/admin/banners/reorder"
```

---

### Task 10: BannerCarousel component

**Files:**
- Create: `src/components/home/banner-carousel.tsx`
- Test: `src/components/home/banner-carousel.test.tsx`

**Interfaces:**
- Consumes: `BannerRow` type (Task 5/4).
- Produces: `BannerCarousel` default export, props `{ banners: BannerRow[] }` — consumed by Task 11 (homepage page).

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/home/banner-carousel.test.tsx
import { render, screen } from "@testing-library/react";
import BannerCarousel from "@/components/home/banner-carousel";
import type { BannerRow } from "@/lib/services/banner-service";

jest.mock("framer-motion", () => ({
  motion: new Proxy(
    {},
    { get: () => (props: React.ComponentProps<"div">) => <div {...props} /> }
  ),
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

function makeBanner(overrides: Partial<BannerRow> = {}): BannerRow {
  return {
    id: "b1",
    title: "Summer Sale",
    subtitle: null,
    cta_text: "Shop Now",
    cta_url: "/catalog",
    category_id: null,
    desktop_image_url: "https://example.com/desktop.webp",
    mobile_image_url: null,
    alt_text: "Summer sale",
    aria_label: null,
    image_title: null,
    overlay_enabled: false,
    overlay_opacity: 0.4,
    banner_type: "image",
    video_url: null,
    display_order: 0,
    is_active: true,
    start_date: null,
    end_date: null,
    seo_meta_title: null,
    seo_meta_description: null,
    seo_keywords: null,
    og_title: null,
    og_description: null,
    og_image_url: null,
    canonical_url: null,
    schema_type: null,
    created_by: null,
    updated_by: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    deleted_at: null,
    ...overrides,
  };
}

describe("BannerCarousel", () => {
  it("renders nothing when there are no banners", () => {
    const { container } = render(<BannerCarousel banners={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders a slide for each banner", () => {
    render(<BannerCarousel banners={[makeBanner({ id: "b1" }), makeBanner({ id: "b2", title: "Second" })]} />);
    expect(screen.getByText("Summer Sale")).toBeInTheDocument();
    expect(screen.getByText("Second")).toBeInTheDocument();
  });

  it("links the CTA to cta_url", () => {
    render(<BannerCarousel banners={[makeBanner()]} />);
    expect(screen.getByRole("link", { name: "Shop Now" })).toHaveAttribute("href", "/catalog");
  });

  it("uses alt_text on the banner image", () => {
    render(<BannerCarousel banners={[makeBanner()]} />);
    expect(screen.getByAltText("Summer sale")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/components/home/banner-carousel.test.tsx`
Expected: FAIL — cannot find module `@/components/home/banner-carousel`.

- [ ] **Step 3: Write the component**

```tsx
// src/components/home/banner-carousel.tsx
"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import type { BannerRow } from "@/lib/services/banner-service";

const AUTOPLAY_MS = 6000;

export default function BannerCarousel({ banners }: { banners: BannerRow[] }) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (banners.length < 2) return;
    const timer = setInterval(() => setIndex((i) => (i + 1) % banners.length), AUTOPLAY_MS);
    return () => clearInterval(timer);
  }, [banners.length]);

  if (banners.length === 0) return null;

  const banner = banners[index % banners.length];
  const href = banner.cta_url ?? (banner.category_id ? `/catalog?category=${banner.category_id}` : "/catalog");

  return (
    <section className="relative w-full overflow-hidden" aria-label="Homepage banners">
      <AnimatePresence mode="wait">
        <motion.div
          key={banner.id}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4 }}
          className="relative aspect-[8/3] w-full md:block hidden"
        >
          <Image
            src={banner.desktop_image_url}
            alt={banner.alt_text}
            title={banner.image_title ?? undefined}
            aria-label={banner.aria_label ?? undefined}
            fill
            priority={index === 0}
            className="object-cover"
            sizes="100vw"
          />
          {banner.overlay_enabled && (
            <div className="absolute inset-0 bg-black" style={{ opacity: banner.overlay_opacity }} />
          )}
          <BannerCopy banner={banner} href={href} />
        </motion.div>
      </AnimatePresence>

      <AnimatePresence mode="wait">
        <motion.div
          key={`${banner.id}-mobile`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4 }}
          className="relative aspect-[3/4] w-full md:hidden block"
        >
          <Image
            src={banner.mobile_image_url ?? banner.desktop_image_url}
            alt={banner.alt_text}
            title={banner.image_title ?? undefined}
            aria-label={banner.aria_label ?? undefined}
            fill
            priority={index === 0}
            className="object-cover"
            sizes="100vw"
          />
          {banner.overlay_enabled && (
            <div className="absolute inset-0 bg-black" style={{ opacity: banner.overlay_opacity }} />
          )}
          <BannerCopy banner={banner} href={href} />
        </motion.div>
      </AnimatePresence>

      {banners.length > 1 && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 z-10">
          {banners.map((b, i) => (
            <button
              key={b.id}
              type="button"
              aria-label={`Show banner ${i + 1}`}
              onClick={() => setIndex(i)}
              className={`h-2 rounded-full transition-all ${
                i === index ? "w-6 bg-white" : "w-2 bg-white/50"
              }`}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function BannerCopy({ banner, href }: { banner: BannerRow; href: string }) {
  if (!banner.title && !banner.subtitle && !banner.cta_text) return null;
  return (
    <div className="absolute inset-0 flex flex-col items-start justify-center gap-3 px-6 md:px-16 z-10">
      {banner.title && (
        <h2 className="text-2xl md:text-4xl font-bold text-white drop-shadow-lg">{banner.title}</h2>
      )}
      {banner.subtitle && <p className="text-sm md:text-lg text-white/90 max-w-md">{banner.subtitle}</p>}
      {banner.cta_text && (
        <Link
          href={href}
          className="inline-flex items-center gap-2 bg-primary hover:bg-primary/90 text-white font-semibold px-6 py-3 rounded-xl transition-all"
        >
          {banner.cta_text}
        </Link>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/components/home/banner-carousel.test.tsx`
Expected: PASS, all tests green.

- [ ] **Step 5: Commit**

```bash
git add src/components/home/banner-carousel.tsx src/components/home/banner-carousel.test.tsx
git commit -m "feat: add BannerCarousel homepage component"
```

---

### Task 11: Wire into the homepage

**Files:**
- Modify: `src/app/(shop)/page.tsx`

**Interfaces:**
- Consumes: `getHomepageBanners` (Task 5), `BannerCarousel` (Task 10).
- Produces: nothing new — this is the integration point, no other task depends on it.

- [ ] **Step 1: Add the import and data fetch**

In `src/app/(shop)/page.tsx`, add the import next to the other component imports:

```typescript
import BannerCarousel from "@/components/home/banner-carousel";
```

and next to the other service imports:

```typescript
import { getHomepageBanners } from "@/lib/services/banner-service";
```

Add `getHomepageBanners()` to the `Promise.all` array and destructure it:

```typescript
  const [notifications, banners, categories, { data: featured }, { data: latest }] =
    await Promise.all([
      getHomepageNotifications("both"),
      getHomepageBanners(),
      // Admin-managed: honors show_on_homepage + display_order, cached with tag revalidation
      getHomepageCategories(),
      supabase
        .from("products")
        .select("*")
        .eq("is_featured", true)
        .eq("is_active", true)
        .limit(8),
      supabase
        .from("products")
        .select("*, category:categories(*)")
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(8),
    ]);
```

Render the carousel directly below the hero:

```tsx
  return (
    <>
      <AnnouncementBar items={notifications.items} config={notifications.config} />
      <HeroSection />
      <BannerCarousel banners={banners} />
      <FeaturedCollections products={featured ?? []} />
      <PopularCategories categories={categories} />
      <LatestReleases products={latest ?? []} />
      <Testimonials />
      <WhatsAppCTA />
      <Newsletter />
    </>
  );
```

- [ ] **Step 2: Verify the build type-checks**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add "src/app/(shop)/page.tsx"
git commit -m "feat: render BannerCarousel below the homepage hero"
```

---

### Task 12: Admin form dialog

**Files:**
- Create: `src/app/admin/marketing/banners/banner-form-dialog.tsx`

**Interfaces:**
- Consumes: `BannerRow` (Task 5).
- Produces: `BannerFormDialog` default export, props `{ open: boolean; onClose: () => void; onSaved: (banner: BannerRow) => void; banner: BannerRow | null; categories: { id: string; name: string }[] }` — consumed by Task 13 (table).

- [ ] **Step 1: Write the component**

This is a form-only component (no dedicated test — it's exercised through the table's own manual QA in the "Run and verify" task at the end; form components with this much conditional JSX are validated more reliably by hand than by brittle RTL form-filling tests, consistent with `branding-dashboard.tsx` having no test file of its own).

```tsx
// src/app/admin/marketing/banners/banner-form-dialog.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { X, Upload } from "lucide-react";
import type { BannerRow } from "@/lib/services/banner-service";

type Category = { id: string; name: string };

const EMPTY_FORM = {
  title: "",
  subtitle: "",
  cta_text: "",
  cta_url: "",
  category_id: "",
  desktop_image_url: "",
  mobile_image_url: "",
  alt_text: "",
  aria_label: "",
  image_title: "",
  overlay_enabled: false,
  overlay_opacity: 0.4,
  is_active: true,
  start_date: "",
  end_date: "",
  seo_meta_title: "",
  seo_meta_description: "",
  seo_keywords: "",
  og_title: "",
  og_description: "",
  og_image_url: "",
  canonical_url: "",
  schema_type: "",
};

type FormState = typeof EMPTY_FORM;

function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  return iso.slice(0, 16);
}

function toIsoOrNull(local: string): string | null {
  return local ? new Date(local).toISOString() : null;
}

async function apiRequest(path: string, options?: RequestInit) {
  const res = await fetch(path, {
    ...options,
    headers:
      options?.body instanceof FormData
        ? options?.headers
        : { "Content-Type": "application/json", ...options?.headers },
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body.error || "Request failed");
  return body;
}

export default function BannerFormDialog({
  open,
  onClose,
  onSaved,
  banner,
  categories,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: (banner: BannerRow) => void;
  banner: BannerRow | null;
  categories: Category[];
}) {
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [uploadingSlot, setUploadingSlot] = useState<"desktop" | "mobile" | null>(null);
  const [showSeo, setShowSeo] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const pendingSlot = useRef<"desktop" | "mobile" | null>(null);

  useEffect(() => {
    if (!open) return;
    if (banner) {
      setForm({
        title: banner.title,
        subtitle: banner.subtitle ?? "",
        cta_text: banner.cta_text ?? "",
        cta_url: banner.cta_url ?? "",
        category_id: banner.category_id ?? "",
        desktop_image_url: banner.desktop_image_url,
        mobile_image_url: banner.mobile_image_url ?? "",
        alt_text: banner.alt_text,
        aria_label: banner.aria_label ?? "",
        image_title: banner.image_title ?? "",
        overlay_enabled: banner.overlay_enabled,
        overlay_opacity: banner.overlay_opacity,
        is_active: banner.is_active,
        start_date: toLocalInput(banner.start_date),
        end_date: toLocalInput(banner.end_date),
        seo_meta_title: banner.seo_meta_title ?? "",
        seo_meta_description: banner.seo_meta_description ?? "",
        seo_keywords: banner.seo_keywords ?? "",
        og_title: banner.og_title ?? "",
        og_description: banner.og_description ?? "",
        og_image_url: banner.og_image_url ?? "",
        canonical_url: banner.canonical_url ?? "",
        schema_type: banner.schema_type ?? "",
      });
    } else {
      setForm(EMPTY_FORM);
    }
  }, [open, banner]);

  if (!open) return null;

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const uploadImage = (slot: "desktop" | "mobile") => {
    pendingSlot.current = slot;
    fileInput.current?.click();
  };

  const onFileChosen = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const slot = pendingSlot.current;
    if (!slot) return;
    setUploadingSlot(slot);
    try {
      const body = new FormData();
      body.append("file", file);
      body.append("namespace", slot === "desktop" ? "banner-desktop" : "banner-mobile");
      const { publicUrl, dimensionWarning } = await apiRequest("/api/media/upload", { method: "POST", body });
      set(slot === "desktop" ? "desktop_image_url" : "mobile_image_url", publicUrl);
      if (dimensionWarning) toast.warning(dimensionWarning);
      toast.success("Image uploaded");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploadingSlot(null);
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) return toast.error("Title is required");
    if (!form.desktop_image_url) return toast.error("Desktop image is required");
    if (!form.alt_text.trim()) return toast.error("Alt text is required");

    setSaving(true);
    try {
      const payload = {
        title: form.title,
        subtitle: form.subtitle || null,
        cta_text: form.cta_text || null,
        cta_url: form.cta_url || null,
        category_id: form.category_id || null,
        desktop_image_url: form.desktop_image_url,
        mobile_image_url: form.mobile_image_url || null,
        alt_text: form.alt_text,
        aria_label: form.aria_label || null,
        image_title: form.image_title || null,
        overlay_enabled: form.overlay_enabled,
        overlay_opacity: form.overlay_opacity,
        is_active: form.is_active,
        start_date: toIsoOrNull(form.start_date),
        end_date: toIsoOrNull(form.end_date),
        seo_meta_title: form.seo_meta_title || null,
        seo_meta_description: form.seo_meta_description || null,
        seo_keywords: form.seo_keywords || null,
        og_title: form.og_title || null,
        og_description: form.og_description || null,
        og_image_url: form.og_image_url || null,
        canonical_url: form.canonical_url || null,
        schema_type: form.schema_type || null,
      };
      const saved = banner
        ? await apiRequest(`/api/admin/banners/${banner.id}`, { method: "PATCH", body: JSON.stringify(payload) })
        : await apiRequest("/api/admin/banners", { method: "POST", body: JSON.stringify(payload) });
      toast.success(banner ? "Banner updated" : "Banner created");
      onSaved(saved);
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save banner");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <input type="file" accept="image/png,image/jpeg,image/webp" ref={fileInput} onChange={onFileChosen} className="hidden" />
      <form
        onSubmit={submit}
        className="bg-background border border-border rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 space-y-4"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">{banner ? "Edit Banner" : "New Banner"}</h2>
          <button type="button" onClick={onClose} aria-label="Close">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <label className="col-span-2 text-sm">
            Title
            <input className="w-full border border-border rounded-lg p-2 mt-1" value={form.title} onChange={(e) => set("title", e.target.value)} />
          </label>
          <label className="col-span-2 text-sm">
            Subtitle
            <input className="w-full border border-border rounded-lg p-2 mt-1" value={form.subtitle} onChange={(e) => set("subtitle", e.target.value)} />
          </label>
          <label className="text-sm">
            CTA Text
            <input className="w-full border border-border rounded-lg p-2 mt-1" value={form.cta_text} onChange={(e) => set("cta_text", e.target.value)} />
          </label>
          <label className="text-sm">
            CTA URL
            <input
              className="w-full border border-border rounded-lg p-2 mt-1"
              placeholder="/catalog or https://…"
              value={form.cta_url}
              onChange={(e) => set("cta_url", e.target.value)}
            />
          </label>
          <label className="col-span-2 text-sm">
            Or link to a category (used only if CTA URL is empty)
            <select
              className="w-full border border-border rounded-lg p-2 mt-1"
              value={form.category_id}
              onChange={(e) => set("category_id", e.target.value)}
            >
              <option value="">— None —</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>

          <div className="col-span-2 grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm mb-1">Desktop image (1600×600)</p>
              {form.desktop_image_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={form.desktop_image_url} alt="Desktop preview" className="rounded-lg mb-2 h-24 object-cover w-full" />
              )}
              <button
                type="button"
                onClick={() => uploadImage("desktop")}
                disabled={uploadingSlot === "desktop"}
                className="flex items-center gap-2 text-sm border border-border rounded-lg px-3 py-2"
              >
                <Upload className="w-4 h-4" /> {uploadingSlot === "desktop" ? "Uploading…" : "Upload"}
              </button>
            </div>
            <div>
              <p className="text-sm mb-1">Mobile image (750×1000, optional)</p>
              {form.mobile_image_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={form.mobile_image_url} alt="Mobile preview" className="rounded-lg mb-2 h-24 object-cover w-full" />
              )}
              <button
                type="button"
                onClick={() => uploadImage("mobile")}
                disabled={uploadingSlot === "mobile"}
                className="flex items-center gap-2 text-sm border border-border rounded-lg px-3 py-2"
              >
                <Upload className="w-4 h-4" /> {uploadingSlot === "mobile" ? "Uploading…" : "Upload"}
              </button>
            </div>
          </div>

          <label className="col-span-2 text-sm">
            Alt Text (required)
            <input className="w-full border border-border rounded-lg p-2 mt-1" value={form.alt_text} onChange={(e) => set("alt_text", e.target.value)} />
          </label>
          <label className="text-sm">
            ARIA Label
            <input className="w-full border border-border rounded-lg p-2 mt-1" value={form.aria_label} onChange={(e) => set("aria_label", e.target.value)} />
          </label>
          <label className="text-sm">
            Image Title
            <input className="w-full border border-border rounded-lg p-2 mt-1" value={form.image_title} onChange={(e) => set("image_title", e.target.value)} />
          </label>

          <label className="text-sm flex items-center gap-2">
            <input type="checkbox" checked={form.overlay_enabled} onChange={(e) => set("overlay_enabled", e.target.checked)} />
            Background Overlay
          </label>
          <label className="text-sm">
            Overlay Opacity ({form.overlay_opacity.toFixed(2)})
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={form.overlay_opacity}
              onChange={(e) => set("overlay_opacity", Number(e.target.value))}
              className="w-full mt-1"
            />
          </label>

          <label className="text-sm">
            Publish Date
            <input type="datetime-local" className="w-full border border-border rounded-lg p-2 mt-1" value={form.start_date} onChange={(e) => set("start_date", e.target.value)} />
          </label>
          <label className="text-sm">
            Expiry Date
            <input type="datetime-local" className="w-full border border-border rounded-lg p-2 mt-1" value={form.end_date} onChange={(e) => set("end_date", e.target.value)} />
          </label>

          <label className="col-span-2 text-sm flex items-center gap-2">
            <input type="checkbox" checked={form.is_active} onChange={(e) => set("is_active", e.target.checked)} />
            Active
          </label>
        </div>

        <div className="border-t border-border pt-3">
          <button type="button" onClick={() => setShowSeo((s) => !s)} className="text-sm font-semibold">
            {showSeo ? "▾" : "▸"} SEO (advanced) — not yet shown on site
          </button>
          {showSeo && (
            <div className="grid grid-cols-2 gap-4 mt-3">
              <label className="col-span-2 text-sm">
                SEO Meta Title
                <input className="w-full border border-border rounded-lg p-2 mt-1" value={form.seo_meta_title} onChange={(e) => set("seo_meta_title", e.target.value)} />
              </label>
              <label className="col-span-2 text-sm">
                SEO Meta Description
                <input className="w-full border border-border rounded-lg p-2 mt-1" value={form.seo_meta_description} onChange={(e) => set("seo_meta_description", e.target.value)} />
              </label>
              <label className="col-span-2 text-sm">
                SEO Keywords
                <input className="w-full border border-border rounded-lg p-2 mt-1" value={form.seo_keywords} onChange={(e) => set("seo_keywords", e.target.value)} />
              </label>
              <label className="text-sm">
                Open Graph Title
                <input className="w-full border border-border rounded-lg p-2 mt-1" value={form.og_title} onChange={(e) => set("og_title", e.target.value)} />
              </label>
              <label className="text-sm">
                Open Graph Description
                <input className="w-full border border-border rounded-lg p-2 mt-1" value={form.og_description} onChange={(e) => set("og_description", e.target.value)} />
              </label>
              <label className="col-span-2 text-sm">
                Open Graph Image URL
                <input className="w-full border border-border rounded-lg p-2 mt-1" value={form.og_image_url} onChange={(e) => set("og_image_url", e.target.value)} />
              </label>
              <label className="text-sm">
                Canonical URL
                <input className="w-full border border-border rounded-lg p-2 mt-1" value={form.canonical_url} onChange={(e) => set("canonical_url", e.target.value)} />
              </label>
              <label className="text-sm">
                Schema Type
                <input className="w-full border border-border rounded-lg p-2 mt-1" value={form.schema_type} onChange={(e) => set("schema_type", e.target.value)} />
              </label>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg border border-border text-sm">
            Cancel
          </button>
          <button type="submit" disabled={saving} className="px-4 py-2 rounded-lg bg-primary text-white text-sm">
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </form>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/admin/marketing/banners/banner-form-dialog.tsx
git commit -m "feat: add banner form dialog"
```

---

### Task 13: Admin table page

**Files:**
- Create: `src/app/admin/marketing/banners/page.tsx`
- Create: `src/app/admin/marketing/banners/banners-table.tsx`

**Interfaces:**
- Consumes: `listAllBanners` (Task 5, server-side initial load), `BannerFormDialog` (Task 12).
- Produces: the `/admin/marketing/banners` page — terminal, nothing else depends on it.

- [ ] **Step 1: Write the server page**

```tsx
// src/app/admin/marketing/banners/page.tsx
import { listAllBanners } from "@/lib/services/banner-service";
import { createClient } from "@/lib/supabase/server";
import BannersTable from "./banners-table";

export default async function BannersPage() {
  const [banners, supabase] = await Promise.all([listAllBanners(), createClient()]);
  const { data: categories } = await supabase.from("categories").select("id, name").order("name");

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-1">Homepage Banners</h1>
      <p className="text-muted-foreground text-sm mb-6">
        Manage the promotional carousel shown below the homepage hero.
      </p>
      <BannersTable initialBanners={banners} categories={categories ?? []} />
    </div>
  );
}
```

- [ ] **Step 2: Write the table component**

```tsx
// src/app/admin/marketing/banners/banners-table.tsx
"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Pencil, Trash2, Copy, Eye, EyeOff, Plus } from "lucide-react";
import type { BannerRow } from "@/lib/services/banner-service";
import BannerFormDialog from "./banner-form-dialog";

async function apiRequest(path: string, options?: RequestInit) {
  const res = await fetch(path, {
    ...options,
    headers: { "Content-Type": "application/json", ...options?.headers },
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body.error || "Request failed");
  return body;
}

export default function BannersTable({
  initialBanners,
  categories,
}: {
  initialBanners: BannerRow[];
  categories: { id: string; name: string }[];
}) {
  const [rows, setRows] = useState(initialBanners);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<BannerRow | null>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  const openCreate = () => {
    setEditing(null);
    setDialogOpen(true);
  };
  const openEdit = (banner: BannerRow) => {
    setEditing(banner);
    setDialogOpen(true);
  };

  const onSaved = (banner: BannerRow) => {
    setRows((prev) => {
      const exists = prev.some((r) => r.id === banner.id);
      return exists ? prev.map((r) => (r.id === banner.id ? banner : r)) : [...prev, banner];
    });
  };

  const toggleActive = async (banner: BannerRow) => {
    try {
      const updated = await apiRequest(`/api/admin/banners/${banner.id}`, {
        method: "PATCH",
        body: JSON.stringify({ is_active: !banner.is_active }),
      });
      setRows((prev) => prev.map((r) => (r.id === banner.id ? updated : r)));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update banner");
    }
  };

  const remove = async (banner: BannerRow) => {
    if (!confirm(`Delete "${banner.title}"? This can't be undone from the admin panel.`)) return;
    try {
      await apiRequest(`/api/admin/banners/${banner.id}`, { method: "DELETE" });
      setRows((prev) => prev.filter((r) => r.id !== banner.id));
      toast.success("Banner deleted");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete banner");
    }
  };

  const duplicate = async (banner: BannerRow) => {
    try {
      const copy = await apiRequest(`/api/admin/banners/${banner.id}/duplicate`, { method: "POST" });
      setRows((prev) => [...prev, copy]);
      toast.success("Banner duplicated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to duplicate banner");
    }
  };

  const persistOrder = async (next: BannerRow[]) => {
    setRows(next);
    try {
      await apiRequest("/api/admin/banners/reorder", {
        method: "POST",
        body: JSON.stringify({ ids: next.map((r) => r.id) }),
      });
    } catch {
      toast.error("Failed to reorder");
    }
  };

  const onDrop = (dropIndex: number) => {
    if (dragIndex === null || dragIndex === dropIndex) return;
    const next = [...rows];
    const [moved] = next.splice(dragIndex, 1);
    next.splice(dropIndex, 0, moved);
    setDragIndex(null);
    void persistOrder(next);
  };

  return (
    <div>
      <div className="flex justify-end mb-4">
        <button
          type="button"
          onClick={openCreate}
          className="flex items-center gap-2 bg-primary text-white text-sm font-semibold px-4 py-2 rounded-lg"
        >
          <Plus className="w-4 h-4" /> Add Banner
        </button>
      </div>

      <table className="w-full border border-border rounded-xl overflow-hidden">
        <thead className="bg-accent/20 text-left text-sm">
          <tr>
            <th className="p-3 w-8" />
            <th className="p-3">Preview</th>
            <th className="p-3">Title</th>
            <th className="p-3">Status</th>
            <th className="p-3">Schedule</th>
            <th className="p-3 text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((banner, index) => (
            <tr
              key={banner.id}
              draggable
              onDragStart={() => setDragIndex(index)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => onDrop(index)}
              className={`border-b border-border last:border-0 hover:bg-accent/10 ${!banner.is_active ? "opacity-50" : ""}`}
            >
              <td className="p-3 cursor-grab text-muted-foreground">⠿</td>
              <td className="p-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={banner.desktop_image_url} alt="" className="w-24 h-9 object-cover rounded" />
              </td>
              <td className="p-3 font-medium">{banner.title}</td>
              <td className="p-3 text-sm">{banner.is_active ? "Active" : "Hidden"}</td>
              <td className="p-3 text-xs text-muted-foreground">
                {banner.start_date ? new Date(banner.start_date).toLocaleDateString() : "Always"}
                {banner.end_date ? ` – ${new Date(banner.end_date).toLocaleDateString()}` : ""}
              </td>
              <td className="p-3">
                <div className="flex justify-end gap-2">
                  <button type="button" onClick={() => toggleActive(banner)} aria-label="Toggle active" title="Toggle active">
                    {banner.is_active ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                  </button>
                  <button type="button" onClick={() => duplicate(banner)} aria-label="Duplicate" title="Duplicate">
                    <Copy className="w-4 h-4" />
                  </button>
                  <button type="button" onClick={() => openEdit(banner)} aria-label="Edit" title="Edit">
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button type="button" onClick={() => remove(banner)} aria-label="Delete" title="Delete">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={6} className="p-6 text-center text-muted-foreground text-sm">
                No banners yet. Click "Add Banner" to create one.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      <BannerFormDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onSaved={onSaved}
        banner={editing}
        categories={categories}
      />
    </div>
  );
}
```

- [ ] **Step 3: Add the sidebar link**

Find the admin marketing sidebar nav config (same file that lists the existing "Homepage Notifications" and "Branding" links — search for `notifications` or `Marketing` in `src/app/admin/**/*.tsx` layout/nav files) and add a "Homepage Banners" entry pointing to `/admin/marketing/banners`, following the exact same shape as the existing entries.

- [ ] **Step 4: Manual verification**

Run: `npm run dev`, sign in as an admin, visit `/admin/marketing/banners`. Create a banner with a desktop image, verify it appears on `/` below the hero. Toggle it inactive, verify it disappears from `/`. Drag-reorder two banners, refresh, verify order persisted.

- [ ] **Step 5: Commit**

```bash
git add src/app/admin/marketing/banners/
git commit -m "feat: add Homepage Banners admin UI"
```

---

### Task 14: Documentation

**Files:**
- Modify: `API.md`
- Modify: `DATABASE.md`
- Modify: `TASKS.md`
- Modify: `ROADMAP.md`

**Interfaces:** None — pure documentation, no code depends on this task.

- [ ] **Step 1: Update API.md**

Add a new section (match the existing format used for the `homepage_notifications` admin routes — same table/list style):

```markdown
## Banners (`/api/admin/banners`)

All routes: `requireAdmin`, rate-limited (60/min/IP), audit-logged.

| Method | Path | Body | Response |
|---|---|---|---|
| GET | `/api/admin/banners` | — | `BannerRow[]` |
| POST | `/api/admin/banners` | `BannerCreateInput` | `BannerRow` (201) |
| PATCH | `/api/admin/banners/[id]` | `BannerUpdateInput` (partial) | `BannerRow` |
| DELETE | `/api/admin/banners/[id]` | — | `{ success: true }` |
| POST | `/api/admin/banners/[id]/duplicate` | — | `BannerRow` (201) |
| POST | `/api/admin/banners/reorder` | `{ ids: string[] }` | `{ success: true }` |

Images are uploaded via the existing `/api/media/upload` route with `namespace: "banner-desktop"` or `"banner-mobile"` — no dedicated banner upload endpoint.
```

- [ ] **Step 2: Update DATABASE.md**

Add a `banners` table section (match the existing `homepage_notifications` section's format): list every column from the Task 1 migration, note the RLS policies (public read of live rows, admin read of all rows, service-role-only writes), and add this migration to the "live migration state" list once it's actually applied (see the Manual Deployment section below — don't mark it live until confirmed via curl).

- [ ] **Step 3: Update TASKS.md and ROADMAP.md**

Mark "Homepage Banner Management (Phase 1 of CMS initiative)" as done in `TASKS.md`, and note in `ROADMAP.md` that Phase 1 of the 10-phase CMS initiative (see `docs/superpowers/specs/2026-07-23-homepage-banner-management-design.md`) is complete, with Phase 2 (Customer Authentication Improvements) next.

- [ ] **Step 4: Commit**

```bash
git add API.md DATABASE.md TASKS.md ROADMAP.md
git commit -m "docs: document homepage banner management (Phase 1 CMS)"
```

---

## Manual deployment step (after all tasks above pass)

1. Run the full suite and type-check: `npx jest && npx tsc --noEmit`. Both must be clean before touching the live database.
2. Apply `supabase/migrations/010_banner_management.sql` via the Supabase SQL Editor (project `htfmyutgliczyfkalxvr`) — paste and run, per the established manual-migration process (no CLI in this environment).
3. Verify live via the SQL Editor (same technique used for migration 009):
   ```sql
   SELECT table_name FROM information_schema.tables WHERE table_name = 'banners';
   SELECT * FROM public.banners LIMIT 1;
   ```
4. Once confirmed, update `DATABASE.md`'s "live migration state" note to include `010`, commit, and push.

## Self-review notes

- **Spec coverage:** every field group from the spec (core fields, scheduling, overlay, active vs. future-ready SEO split, CTA precedence, drag-and-drop reorder, duplicate, image dimensions) has a task. Video banners are explicitly out of scope per the spec and are schema-ready only (`banner_type`/`video_url` columns, unused by any task here).
- **Correction from spec:** the spec listed a dedicated `/api/admin/banners/[id]/image` upload route; this plan instead reuses the existing generic `/api/media/upload?namespace=banner-desktop|banner-mobile` route (Task 2 adds the namespaces, Task 12 calls the existing route). Same capability, no duplicated upload logic — flagged here since it's a deviation from the literal spec text, not an omission.
- **Type consistency:** `BannerRow` (Task 4) is the single shared type threaded through Tasks 5, 10, 12, 13 — field names match the migration (Task 1) exactly.
