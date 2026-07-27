# Generic Category CMS Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the existing `categories` table + ad-hoc admin routes into a complete, generic, unlimited-depth Category CMS — full CRUD, soft delete, product/branch reassignment, drag-and-drop reorder, SEO fields — that works identically for Pokémon regions, Dragon Ball Z sagas, and a future "T-Shirts → Men → Hoodies" product line, with zero category-specific code anywhere.

**Architecture:** `categories` is already a self-referential, unlimited-depth tree (`parent_id`) with generic content fields (`name`, `slug`, `description`, `image_url`, `icon_url`, `appearance`, `meta_title`, `meta_description`, `display_order`, `is_active`) — nothing about it is Pokémon-specific today, and nothing added by this plan is either. The gaps are entirely in the write path: no audit logging or rate limiting on create/edit, no cycle prevention, no slug-uniqueness check, no delete endpoint at all, no product/branch reassignment, and the admin UI is a flat two-level list with a dead link to a `/admin/categories/[id]/edit` page that was never built. This plan closes those gaps at the Repository → Service → API → UI layers Legacy Mania already uses everywhere else, reuses Phase 1's `CatalogService.getDescendantCategoryIds()` as the cycle-detection primitive (so there is exactly one "walk the category tree" implementation in the codebase), and adds one new column (`deleted_at`, mirroring the existing `banners`/`homepage_notifications` soft-delete convention) — no other schema change, because a "T-Shirts" category needs nothing structurally different from a "Pokémon" category.

**Tech Stack:** Next.js App Router (Server Components + Route Handlers), Supabase (PostgREST via `fetch` in repositories), Zod validation, Jest + Testing Library. No new dependencies — drag-and-drop reuses the native HTML5 `draggable`/`onDragStart`/`onDrop` pattern already implemented in `src/app/admin/products/products-table.tsx` (no dnd library in this codebase).

## Global Constraints

- Repository → Service → API → UI layering must not be bypassed (`AI_MEMORY.md`).
- No category-specific or product-type-specific code anywhere — every rule, schema, and component must work identically for Pokémon, T-Shirts, or any future collection.
- Admin route pattern to match exactly (`AI_MEMORY.md`): rate limit → `requireAdmin()` → zod validate → one service call → `recordAuditLog()`.
- Every `/api/admin/*` route needs a `route.test.ts` covering 401 (anon) / 403 (non-admin), matching existing convention (`API.md`).
- Soft delete only — never a hard `DELETE FROM categories`. Matches the existing `banners`/`homepage_notifications` `deleted_at` convention (`DATABASE.md`).
- Migrations are applied manually via the Supabase SQL Editor (no CLI in this environment) — this plan's migration file must be handed to the human partner to run, and a task's live-verification step is deferred until they confirm it's applied.
- Do not duplicate category-tree-walking logic — `CatalogService.getDescendantCategoryIds()` (already unlimited-depth, cycle-safe) is the only BFS; the service layer for this plan calls it, never reimplements it.
- Phase 1's `getDescendantCategoryIds()` behavior and its existing tests must not regress — any category-visibility semantics this plan changes (e.g. soft-deleted categories disappearing) must be additive filtering in the repository layer, not a change to the BFS itself.
- `npx jest` must stay green (full suite) and `npx tsc --noEmit` clean before any task is considered done.

## Design Decisions (read before objecting to a task)

1. **No `category_type` / `product_type` column.** Nothing in the requirements needs categories to know what kind of thing they contain — "T-Shirts" and "Pokémon" are structurally identical rows. Adding a type enum now would be speculative (YAGNI) and would need updating everywhere the tree is walked. If a future need arises to render T-shirts differently from cards, that's a product-level concern (`products.category` already carries whatever metadata a product needs), not a category-tree concern.
2. **Soft delete via `deleted_at`, not a hard delete.** Matches the existing `banners`/`homepage_notifications` pattern exactly (same column name, same semantics: `deleted_at IS NULL` = visible everywhere). A hard delete on a self-referential FK with `ON DELETE SET NULL` would silently orphan children into root categories and silently uncategorize their products — exactly the kind of silent data-integrity loss this platform's existing conventions (`AUTH_AUDIT.md`, `SECURITY.md`) avoid elsewhere.
3. **Delete is blocked, not cascading, unless the admin explicitly reassigns first.** Deleting a category that still has children or products either fails with a 409 telling the admin what to reassign, or — in the same request — reassigns to an admin-supplied target first. No implicit cascade delete of a whole subtree; that's a separate, more dangerous operation this plan does not build (an admin who wants to remove "Pokémon" entirely deletes leaves first, working up, or explicitly reassigns each level).
4. **One canonical write endpoint for content fields, a separate one for visual branding — but `is_active` moves to the content endpoint.** `PATCH /api/admin/categories/:id` (content: name/slug/description/parent_id/display_order/is_active/meta_title/meta_description) and `PATCH /api/admin/categories/:id/branding` (visual: icon_url/appearance/is_featured/show_on_homepage) already exist as two routes sharing one repository primitive. Today both schemas can write `is_active`, which is two competing sources of truth for "Activate/Deactivate." This plan removes `is_active` from the branding schema — Activate/Deactivate becomes exclusively a content-endpoint concern (it's a lifecycle/visibility decision, not a visual one).
5. **Cycle prevention reuses Phase 1's BFS.** `getDescendantCategoryIds(id)` already returns every descendant of `id` at any depth. "Is `newParentId` a descendant of (or equal to) the category being moved?" is exactly `getDescendantCategoryIds(id).includes(newParentId)`. No second tree-walk implementation.
6. **No new repository query for "does this category have children/products."** The category table is ~15-30 rows at any scale this business will hit in the next several years (a handful of franchises × a handful of tiers each, plus a handful of product-type lines); `listAllCategories()` already fetches everything, and the service layer filters in memory — consistent with Phase 1's approach. Product-count checks do need one targeted repository query (`countActiveProductsByCategory`) since the products table is not small.
7. **"Move an entire branch" is not a separate feature.** Changing a category's `parent_id` moves it and, transitively, every one of its descendants (their own `parent_id`s are untouched) — the whole subtree moves as a unit automatically. The edit form's parent-selector is the only UI needed; it excludes the category itself and all of its current descendants (defense in depth alongside the service-layer cycle check).
8. **Out of scope, deliberately.** CMS-managed homepage floating tiles, navigation, banners, and featured collections (the original request's Phases 4-5) are separate subsystems with their own schema needs (new tables, not category rows) and get their own plans after this one — this plan only makes the *category tree itself* generic and fully admin-managed. The only coupling point is that those future plans will link a tile/nav-entry to a `category_id`, which this plan's stable `Category` shape already supports today.
9. **Drag-and-drop reorders siblings only.** `PATCH /api/admin/categories/order` (already exists, already generic — rewrites `display_order` 0..n-1 for whatever id list it's given) is unchanged. The admin UI's tree view drags within one parent's children at a time; moving to a different parent is a parent-select edit, not a drag target — this matches how the product table's existing drag-reorder works (siblings within one list) and avoids inventing a tree-drag interaction this codebase has no precedent for.

## Deferred Architecture Notes (document only — no implementation in this plan)

Four forward-looking decisions were raised during plan review. None change any task below; each is captured here so Task 10 writes them into `ROADMAP.md`/`AI_MEMORY.md` as guidance for future work, not as code in this phase.

1. **Generic internal linking, not category-only links.** Future CMS modules (homepage tiles, navigation items, promotional sections) must not assume their link target is always a category. When those modules are built, they should carry `link_type` (`category` | `product` | `collection` | `search` | `page` | `custom_url`) + `link_value` (the corresponding slug/id/query/URL) instead of a bare `category_id` column — this is the same shape a CMS "link picker" needs regardless of what's being linked, and avoids a schema change every time a new destination type is added. Nothing in this plan implements a linking table; this is guidance for whichever future plan builds Phase 4/5 (Design Decision 8).
2. **Slug History for future 301 redirects.** This plan's slug-uniqueness check (Task 3) is correct but doesn't address what happens to old bookmarks/search-engine indexes when an admin renames a slug (`kanto` → `kanto-region`). A future `category_slug_history` table (`category_id`, `old_slug`, `new_slug`, `created_at`) plus redirect-on-404 logic would close that gap. Not built now — `editCategory` in this plan changes the slug with no history trail.
3. **Reserved future media fields.** `categories` already has `image_url`/`icon_url`, which this plan and its predecessor (Phase 1's branding work) treat as sufficient for now. `thumbnail_image`, `hero_image`, `cover_image`, `banner_image` are plausible future columns for richer presentation — not added in this plan; no task here touches the media surface beyond what already exists.
4. **Reserved audit metadata.** `audit_logs` already records every category mutation (Task 6). `categories.created_by`/`updated_by` would let the category *row itself* carry attribution without a join — a possible future enhancement, not built here.

---

### Task 1: Migration + repository — soft delete, lookups, deleted-row filtering

**Files:**
- Create: `supabase/migrations/012_category_soft_delete.sql`
- Modify: `src/lib/repositories/category-repository.ts`
- Test: `src/lib/repositories/category-repository.test.ts` (new file — no repository tests exist for categories today)

**Interfaces:**
- Produces: `getCategoryById(id: string): Promise<Category | null>`, `getCategoryBySlug(slug: string): Promise<Category | null>`, `softDeleteCategory(id: string): Promise<void>` — consumed by Task 3/4's service layer.
- Modifies (behavior, not signature): `listActiveCategories()`, `listAllCategories()`, `listHomepageCategories()` now exclude soft-deleted rows.
- Modifies (signature): `CategoryWritePayload` gains two optional fields (`meta_title`, `meta_description`) so Task 5's extended `categorySchema` output type-checks against it — see Step 4.

- [ ] **Step 1: Write the migration**

```sql
-- supabase/migrations/012_category_soft_delete.sql
-- Adds soft-delete support to categories, matching the existing banners/homepage_notifications
-- convention: deleted_at IS NULL means visible everywhere. Apply manually via the Supabase SQL
-- Editor, then verify via a PostgREST curl GET on /rest/v1/categories?select=deleted_at&limit=1.

ALTER TABLE public.categories
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
```

- [ ] **Step 2: Write the failing repository tests**

```typescript
// src/lib/repositories/category-repository.test.ts
/**
 * @jest-environment node
 */
const mockFetch = jest.fn();
global.fetch = mockFetch as unknown as typeof fetch;

beforeEach(() => {
  process.env.SUPABASE_SERVICE_ROLE_KEY = "test-key";
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
});
afterEach(() => jest.clearAllMocks());

import {
  listActiveCategories,
  listAllCategories,
  getCategoryById,
  getCategoryBySlug,
  softDeleteCategory,
} from "./category-repository";

describe("listActiveCategories", () => {
  it("filters out soft-deleted rows via deleted_at=is.null", async () => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => [] });
    await listActiveCategories();
    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toContain("deleted_at=is.null");
  });
});

describe("listAllCategories", () => {
  it("filters out soft-deleted rows via deleted_at=is.null", async () => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => [] });
    await listAllCategories();
    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toContain("deleted_at=is.null");
  });
});

describe("getCategoryById", () => {
  it("returns the row when found", async () => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => [{ id: "a", name: "A" }] });
    await expect(getCategoryById("a")).resolves.toEqual({ id: "a", name: "A" });
    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toContain("id=eq.a");
    expect(url).toContain("deleted_at=is.null");
  });

  it("returns null when not found", async () => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => [] });
    await expect(getCategoryById("missing")).resolves.toBeNull();
  });
});

describe("getCategoryBySlug", () => {
  it("returns the row when found", async () => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => [{ id: "a", slug: "pokemon" }] });
    await expect(getCategoryBySlug("pokemon")).resolves.toEqual({ id: "a", slug: "pokemon" });
    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toContain("slug=eq.pokemon");
  });

  it("returns null when not found", async () => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => [] });
    await expect(getCategoryBySlug("missing")).resolves.toBeNull();
  });
});

describe("softDeleteCategory", () => {
  it("PATCHes deleted_at to a timestamp", async () => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => [{}] });
    await softDeleteCategory("a");
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toContain("id=eq.a");
    expect(init.method).toBe("PATCH");
    const body = JSON.parse(init.body as string);
    expect(body.deleted_at).toBeDefined();
    expect(new Date(body.deleted_at).toString()).not.toBe("Invalid Date");
  });

  it("throws if the PATCH fails", async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 500 });
    await expect(softDeleteCategory("a")).rejects.toThrow();
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx jest src/lib/repositories/category-repository.test.ts`
Expected: FAIL — `getCategoryById`, `getCategoryBySlug`, `softDeleteCategory` don't exist yet, and the two `list*` tests fail because today's URLs have no `deleted_at` filter.

- [ ] **Step 4: Implement**

In `src/lib/repositories/category-repository.ts`, add `&deleted_at=is.null` to the three existing list functions' query strings, and add the three new functions:

```typescript
export async function listActiveCategories(): Promise<Category[]> {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/categories?select=*&is_active=eq.true&deleted_at=is.null&order=display_order.asc`,
    { headers: HEADERS, cache: "no-store" }
  );
  if (!res.ok) throw new Error(`Failed to fetch categories: ${res.status}`);
  return res.json();
}

/** Homepage "Browse by Series" cards — cached 5 min, tag-revalidated on admin edits. */
export async function listHomepageCategories(): Promise<Category[]> {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/categories?select=*&is_active=eq.true&show_on_homepage=eq.true&parent_id=is.null&deleted_at=is.null&order=display_order.asc`,
    { headers: HEADERS, next: { revalidate: 300, tags: ["categories-branding"] } }
  );
  if (!res.ok) throw new Error(`Failed to fetch homepage categories: ${res.status}`);
  return res.json();
}

/** All categories (any active/inactive status, excluding soft-deleted) for the admin panel. */
export async function listAllCategories(): Promise<Category[]> {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/categories?select=*&deleted_at=is.null&order=display_order.asc`,
    { headers: HEADERS, cache: "no-store" }
  );
  if (!res.ok) throw new Error(`Failed to fetch categories: ${res.status}`);
  return res.json();
}

export async function getCategoryById(id: string): Promise<Category | null> {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/categories?id=eq.${encodeURIComponent(id)}&deleted_at=is.null&select=*&limit=1`,
    { headers: HEADERS, cache: "no-store" }
  );
  if (!res.ok) throw new Error(`Failed to fetch category: ${res.status}`);
  const rows = await res.json();
  return rows[0] ?? null;
}

export async function getCategoryBySlug(slug: string): Promise<Category | null> {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/categories?slug=eq.${encodeURIComponent(slug)}&deleted_at=is.null&select=*&limit=1`,
    { headers: HEADERS, cache: "no-store" }
  );
  if (!res.ok) throw new Error(`Failed to fetch category: ${res.status}`);
  const rows = await res.json();
  return rows[0] ?? null;
}

export async function softDeleteCategory(id: string): Promise<void> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/categories?id=eq.${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: HEADERS,
    body: JSON.stringify({ deleted_at: new Date().toISOString() }),
  });
  if (!res.ok) throw new Error(`Failed to delete category ${id}: ${res.status}`);
}
```

Also widen the existing `CategoryWritePayload` interface in this same file to carry the SEO fields Task 5 adds to the write schema — otherwise `createCategory(payload: CategoryWritePayload)` won't type-check once its caller passes `categorySchema`'s parsed output in Task 6:

```typescript
export interface CategoryWritePayload {
  name: string;
  slug: string;
  description: string | null;
  parent_id: string | null;
  display_order: number;
  is_active: boolean;
  meta_title?: string | null;
  meta_description?: string | null;
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx jest src/lib/repositories/category-repository.test.ts`
Expected: PASS (8 tests).

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/012_category_soft_delete.sql src/lib/repositories/category-repository.ts src/lib/repositories/category-repository.test.ts
git commit -m "feat: add category soft delete, id/slug lookups, and deleted-row filtering"
```

---

### Task 2: Product repository — count-by-category and bulk reassignment

**Files:**
- Modify: `src/lib/repositories/product-repository.ts`
- Test: `src/lib/repositories/product-repository.test.ts`

**Interfaces:**
- Produces: `countActiveProductsByCategory(categoryId: string): Promise<number>`, `reassignProductsCategory(fromCategoryId: string, toCategoryId: string): Promise<number>` (returns count of rows updated) — consumed by Task 4's `deleteCategory`/`reassignProducts`.

- [ ] **Step 1: Write the failing tests**

Add to `src/lib/repositories/product-repository.test.ts` (this file already mocks `global.fetch` for other repository functions — follow its existing pattern):

```typescript
import { countActiveProductsByCategory, reassignProductsCategory } from "./product-repository";

describe("countActiveProductsByCategory", () => {
  it("requests a count-only response and returns the total", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      headers: { get: (name: string) => (name.toLowerCase() === "content-range" ? "0-0/7" : null) },
      json: async () => [],
    });
    await expect(countActiveProductsByCategory("cat-1")).resolves.toBe(7);
    const url = (global.fetch as jest.Mock).mock.calls[0][0] as string;
    expect(url).toContain("category_id=eq.cat-1");
  });

  it("returns 0 when the category has no products", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      headers: { get: () => "0-(-1)/0" },
      json: async () => [],
    });
    await expect(countActiveProductsByCategory("cat-empty")).resolves.toBe(0);
  });
});

describe("reassignProductsCategory", () => {
  it("PATCHes every product in fromCategoryId to toCategoryId", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => [{ id: "p1" }, { id: "p2" }],
    });
    await expect(reassignProductsCategory("cat-old", "cat-new")).resolves.toBe(2);
    const [url, init] = (global.fetch as jest.Mock).mock.calls[0];
    expect(url).toContain("category_id=eq.cat-old");
    expect(init.method).toBe("PATCH");
    expect(JSON.parse(init.body as string)).toEqual({ category_id: "cat-new" });
  });

  it("throws if the PATCH fails", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({ ok: false, status: 500 });
    await expect(reassignProductsCategory("cat-old", "cat-new")).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest src/lib/repositories/product-repository.test.ts`
Expected: FAIL — both functions undefined.

- [ ] **Step 3: Implement**

Add to `src/lib/repositories/product-repository.ts`:

```typescript
/** Count of active products directly in a category (does not expand descendants — that's a service-layer concern). */
export async function countActiveProductsByCategory(categoryId: string): Promise<number> {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/products?category_id=eq.${encodeURIComponent(categoryId)}&is_active=eq.true&select=id`,
    { headers: { ...HEADERS, Prefer: "count=exact" }, cache: "no-store" }
  );
  if (!res.ok) throw new Error(`Failed to count products for category ${categoryId}: ${res.status}`);
  const range = res.headers.get("content-range") ?? "0-0/0";
  const total = Number(range.split("/")[1]);
  return Number.isFinite(total) ? Math.max(total, 0) : 0;
}

/** Rewrites category_id for every product currently in fromCategoryId. Returns rows affected. */
export async function reassignProductsCategory(fromCategoryId: string, toCategoryId: string): Promise<number> {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/products?category_id=eq.${encodeURIComponent(fromCategoryId)}`,
    {
      method: "PATCH",
      headers: { ...HEADERS, Prefer: "return=representation" },
      body: JSON.stringify({ category_id: toCategoryId }),
    }
  );
  if (!res.ok) throw new Error(`Failed to reassign products from ${fromCategoryId} to ${toCategoryId}: ${res.status}`);
  const rows = await res.json();
  return rows.length;
}
```

Note: `HEADERS` in this file does not currently set `Prefer`, so `{ ...HEADERS, Prefer: "count=exact" }` overrides/adds it per-call without touching the shared constant — matches the existing per-call `Prefer` override pattern already used by `insertProduct`/`updateProduct` in this same file.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest src/lib/repositories/product-repository.test.ts`
Expected: PASS (all existing tests + 4 new).

- [ ] **Step 5: Commit**

```bash
git add src/lib/repositories/product-repository.ts src/lib/repositories/product-repository.test.ts
git commit -m "feat: add product count-by-category and bulk category reassignment to product repository"
```

---

### Task 3: Category service — slug uniqueness + cycle prevention on create/edit

**Files:**
- Modify: `src/lib/services/category-service.ts`
- Test: `src/lib/services/category-service.test.ts` (new file)

**Interfaces:**
- Consumes: `getDescendantCategoryIds(categoryId: string): Promise<string[]>` from `src/lib/services/catalog-service.ts` (Phase 1, already exists); `listAllCategories`, `getCategoryBySlug`, `insertCategory`, `updateCategoryBranding` (repository, Task 1).
- Produces: `createCategory(payload): Promise<Category>` (now throws `CategorySlugConflictError` on duplicate slug), `editCategory(id, payload): Promise<Category | null>` (now throws `CategorySlugConflictError` or `CategoryCycleError`), plus the two exported error classes — consumed by Task 6's API routes to map to specific HTTP statuses.

- [ ] **Step 1: Write the failing tests**

```typescript
// src/lib/services/category-service.test.ts
jest.mock("@/lib/repositories/category-repository", () => ({
  insertCategory: jest.fn(),
  updateCategoryBranding: jest.fn(),
  getCategoryBySlug: jest.fn(),
  getCategoryById: jest.fn(),
}));
jest.mock("@/lib/services/catalog-service", () => ({
  getDescendantCategoryIds: jest.fn(),
}));

import {
  createCategory,
  editCategory,
  CategorySlugConflictError,
  CategoryCycleError,
} from "./category-service";
import {
  insertCategory,
  updateCategoryBranding,
  getCategoryBySlug,
  getCategoryById,
} from "@/lib/repositories/category-repository";
import { getDescendantCategoryIds } from "@/lib/services/catalog-service";

afterEach(() => jest.clearAllMocks());

describe("createCategory", () => {
  it("creates when the slug is free", async () => {
    (getCategoryBySlug as jest.Mock).mockResolvedValue(null);
    (insertCategory as jest.Mock).mockResolvedValue({ id: "new", slug: "t-shirts" });
    await expect(
      createCategory({ name: "T-Shirts", slug: "t-shirts", description: null, parent_id: null, display_order: 0, is_active: true })
    ).resolves.toEqual({ id: "new", slug: "t-shirts" });
  });

  it("throws CategorySlugConflictError when the slug is taken", async () => {
    (getCategoryBySlug as jest.Mock).mockResolvedValue({ id: "existing", slug: "t-shirts" });
    await expect(
      createCategory({ name: "T-Shirts", slug: "t-shirts", description: null, parent_id: null, display_order: 0, is_active: true })
    ).rejects.toThrow(CategorySlugConflictError);
    expect(insertCategory).not.toHaveBeenCalled();
  });
});

describe("editCategory", () => {
  it("updates when no slug/parent conflict exists", async () => {
    (getCategoryById as jest.Mock).mockResolvedValue({ id: "cat-1", slug: "old-slug" });
    (getCategoryBySlug as jest.Mock).mockResolvedValue(null);
    (updateCategoryBranding as jest.Mock).mockResolvedValue({ id: "cat-1", name: "Renamed" });
    await expect(editCategory("cat-1", { name: "Renamed" })).resolves.toEqual({ id: "cat-1", name: "Renamed" });
  });

  it("allows keeping your own current slug unchanged", async () => {
    (getCategoryById as jest.Mock).mockResolvedValue({ id: "cat-1", slug: "kanto" });
    (getCategoryBySlug as jest.Mock).mockResolvedValue({ id: "cat-1", slug: "kanto" });
    (updateCategoryBranding as jest.Mock).mockResolvedValue({ id: "cat-1", slug: "kanto" });
    await expect(editCategory("cat-1", { slug: "kanto" })).resolves.toEqual({ id: "cat-1", slug: "kanto" });
  });

  it("throws CategorySlugConflictError when renaming to another category's slug", async () => {
    (getCategoryById as jest.Mock).mockResolvedValue({ id: "cat-1", slug: "old-slug" });
    (getCategoryBySlug as jest.Mock).mockResolvedValue({ id: "cat-2", slug: "kanto" });
    await expect(editCategory("cat-1", { slug: "kanto" })).rejects.toThrow(CategorySlugConflictError);
    expect(updateCategoryBranding).not.toHaveBeenCalled();
  });

  it("throws CategoryCycleError when setting parent_id to itself", async () => {
    (getCategoryById as jest.Mock).mockResolvedValue({ id: "cat-1", slug: "kanto" });
    await expect(editCategory("cat-1", { parent_id: "cat-1" })).rejects.toThrow(CategoryCycleError);
    expect(updateCategoryBranding).not.toHaveBeenCalled();
  });

  it("throws CategoryCycleError when setting parent_id to one of its own descendants", async () => {
    (getCategoryById as jest.Mock).mockResolvedValue({ id: "pokemon", slug: "pokemon" });
    (getDescendantCategoryIds as jest.Mock).mockResolvedValue(["pokemon", "kanto", "starters"]);
    await expect(editCategory("pokemon", { parent_id: "starters" })).rejects.toThrow(CategoryCycleError);
    expect(updateCategoryBranding).not.toHaveBeenCalled();
  });

  it("allows setting parent_id to an unrelated category", async () => {
    (getCategoryById as jest.Mock).mockResolvedValue({ id: "kanto", slug: "kanto" });
    (getDescendantCategoryIds as jest.Mock).mockResolvedValue(["kanto"]);
    (updateCategoryBranding as jest.Mock).mockResolvedValue({ id: "kanto", parent_id: "unrelated" });
    await expect(editCategory("kanto", { parent_id: "unrelated" })).resolves.toEqual({ id: "kanto", parent_id: "unrelated" });
  });

  it("returns null when the category doesn't exist", async () => {
    (getCategoryById as jest.Mock).mockResolvedValue(null);
    await expect(editCategory("missing", { name: "X" })).resolves.toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest src/lib/services/category-service.test.ts`
Expected: FAIL — `CategorySlugConflictError`/`CategoryCycleError` don't exist, no validation logic present yet.

- [ ] **Step 3: Implement**

Replace `src/lib/services/category-service.ts`:

```typescript
import {
  insertCategory,
  updateCategoryBranding,
  getCategoryById,
  getCategoryBySlug,
  type CategoryWritePayload,
} from "@/lib/repositories/category-repository";
import { getDescendantCategoryIds } from "@/lib/services/catalog-service";
import type { Category } from "@/types";

export class CategorySlugConflictError extends Error {
  constructor(slug: string) {
    super(`Slug "${slug}" is already used by another category`);
    this.name = "CategorySlugConflictError";
  }
}

export class CategoryCycleError extends Error {
  constructor() {
    super("A category cannot be moved to itself or one of its own descendants");
    this.name = "CategoryCycleError";
  }
}

export async function createCategory(payload: CategoryWritePayload): Promise<Category> {
  const existing = await getCategoryBySlug(payload.slug);
  if (existing) throw new CategorySlugConflictError(payload.slug);
  return insertCategory(payload);
}

export async function editCategory(
  id: string,
  payload: Partial<CategoryWritePayload>
): Promise<Category | null> {
  const current = await getCategoryById(id);
  if (!current) return null;

  if (payload.slug !== undefined && payload.slug !== current.slug) {
    const existing = await getCategoryBySlug(payload.slug);
    if (existing && existing.id !== id) throw new CategorySlugConflictError(payload.slug);
  }

  if (payload.parent_id !== undefined && payload.parent_id !== null) {
    if (payload.parent_id === id) throw new CategoryCycleError();
    const descendantIds = await getDescendantCategoryIds(id);
    if (descendantIds.includes(payload.parent_id)) throw new CategoryCycleError();
  }

  return updateCategoryBranding(id, payload);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest src/lib/services/category-service.test.ts`
Expected: PASS (9 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/services/category-service.ts src/lib/services/category-service.test.ts
git commit -m "feat: enforce slug uniqueness and parent-cycle prevention in category create/edit"
```

---

### Task 4: Category service — delete with reassignment, standalone product reassignment

**Files:**
- Modify: `src/lib/services/category-service.ts`
- Test: `src/lib/services/category-service.test.ts`

**Interfaces:**
- Consumes: `softDeleteCategory` (Task 1), `countActiveProductsByCategory`/`reassignProductsCategory` (Task 2), `listAllCategories` (existing), `getDescendantCategoryIds` (Phase 1).
- Produces: `CategoryHasChildrenError`, `CategoryHasProductsError` (error classes), `deleteCategory(id, options?: { reassignChildrenTo?: string; reassignProductsTo?: string }): Promise<void>`, `reassignProducts(fromCategoryId: string, toCategoryId: string): Promise<number>` — consumed by Task 6's DELETE and reassign-products routes.

- [ ] **Step 1: Write the failing tests**

Add to `src/lib/services/category-service.test.ts` (extend the existing repository/catalog-service mocks with the new functions they need):

```typescript
// Extend the top-of-file jest.mock calls to include the new repository/service functions:
jest.mock("@/lib/repositories/category-repository", () => ({
  insertCategory: jest.fn(),
  updateCategoryBranding: jest.fn(),
  getCategoryBySlug: jest.fn(),
  getCategoryById: jest.fn(),
  listAllCategories: jest.fn(),
  softDeleteCategory: jest.fn(),
}));
jest.mock("@/lib/repositories/product-repository", () => ({
  countActiveProductsByCategory: jest.fn(),
  reassignProductsCategory: jest.fn(),
}));

// New imports alongside the existing ones:
import {
  deleteCategory,
  reassignProducts,
  CategoryHasChildrenError,
  CategoryHasProductsError,
} from "./category-service";
import {
  listAllCategories,
  softDeleteCategory,
} from "@/lib/repositories/category-repository";
import {
  countActiveProductsByCategory,
  reassignProductsCategory,
} from "@/lib/repositories/product-repository";

describe("deleteCategory", () => {
  it("soft-deletes a category with no children and no products", async () => {
    (getCategoryById as jest.Mock).mockResolvedValue({ id: "leaf", slug: "leaf" });
    (listAllCategories as jest.Mock).mockResolvedValue([{ id: "leaf", parent_id: null }]);
    (countActiveProductsByCategory as jest.Mock).mockResolvedValue(0);
    (softDeleteCategory as jest.Mock).mockResolvedValue(undefined);

    await deleteCategory("leaf");

    expect(softDeleteCategory).toHaveBeenCalledWith("leaf");
  });

  it("throws CategoryHasChildrenError when children exist and no reassignChildrenTo is given", async () => {
    (getCategoryById as jest.Mock).mockResolvedValue({ id: "parent", slug: "parent" });
    (listAllCategories as jest.Mock).mockResolvedValue([
      { id: "parent", parent_id: null },
      { id: "child", parent_id: "parent" },
    ]);
    (countActiveProductsByCategory as jest.Mock).mockResolvedValue(0);

    await expect(deleteCategory("parent")).rejects.toThrow(CategoryHasChildrenError);
    expect(softDeleteCategory).not.toHaveBeenCalled();
  });

  it("throws CategoryHasProductsError when products exist and no reassignProductsTo is given", async () => {
    (getCategoryById as jest.Mock).mockResolvedValue({ id: "leaf", slug: "leaf" });
    (listAllCategories as jest.Mock).mockResolvedValue([{ id: "leaf", parent_id: null }]);
    (countActiveProductsByCategory as jest.Mock).mockResolvedValue(3);

    await expect(deleteCategory("leaf")).rejects.toThrow(CategoryHasProductsError);
    expect(softDeleteCategory).not.toHaveBeenCalled();
  });

  it("reassigns children then deletes when reassignChildrenTo is given", async () => {
    (getCategoryById as jest.Mock).mockResolvedValue({ id: "parent", slug: "parent" });
    (listAllCategories as jest.Mock).mockResolvedValue([
      { id: "parent", parent_id: null },
      { id: "child", parent_id: "parent" },
    ]);
    (countActiveProductsByCategory as jest.Mock).mockResolvedValue(0);
    (updateCategoryBranding as jest.Mock).mockResolvedValue({ id: "child", parent_id: "other" });

    await deleteCategory("parent", { reassignChildrenTo: "other" });

    expect(updateCategoryBranding).toHaveBeenCalledWith("child", { parent_id: "other" });
    expect(softDeleteCategory).toHaveBeenCalledWith("parent");
  });

  it("reassigns products then deletes when reassignProductsTo is given", async () => {
    (getCategoryById as jest.Mock).mockResolvedValue({ id: "leaf", slug: "leaf" });
    (listAllCategories as jest.Mock).mockResolvedValue([{ id: "leaf", parent_id: null }]);
    (countActiveProductsByCategory as jest.Mock).mockResolvedValue(3);
    (reassignProductsCategory as jest.Mock).mockResolvedValue(3);

    await deleteCategory("leaf", { reassignProductsTo: "other-leaf" });

    expect(reassignProductsCategory).toHaveBeenCalledWith("leaf", "other-leaf");
    expect(softDeleteCategory).toHaveBeenCalledWith("leaf");
  });

  it("throws when the category doesn't exist", async () => {
    (getCategoryById as jest.Mock).mockResolvedValue(null);
    await expect(deleteCategory("missing")).rejects.toThrow("Category not found");
  });
});

describe("reassignProducts", () => {
  it("delegates to the repository and returns the count moved", async () => {
    (reassignProductsCategory as jest.Mock).mockResolvedValue(5);
    await expect(reassignProducts("old", "new")).resolves.toBe(5);
    expect(reassignProductsCategory).toHaveBeenCalledWith("old", "new");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest src/lib/services/category-service.test.ts`
Expected: FAIL — new functions/errors don't exist.

- [ ] **Step 3: Implement**

Add to `src/lib/services/category-service.ts` (alongside the imports already added in Task 3, add `listAllCategories` and `softDeleteCategory` from the category repository, and `countActiveProductsByCategory`/`reassignProductsCategory` from the product repository):

```typescript
import {
  insertCategory,
  updateCategoryBranding,
  getCategoryById,
  getCategoryBySlug,
  listAllCategories,
  softDeleteCategory,
  type CategoryWritePayload,
} from "@/lib/repositories/category-repository";
import {
  countActiveProductsByCategory,
  reassignProductsCategory,
} from "@/lib/repositories/product-repository";
import { getDescendantCategoryIds } from "@/lib/services/catalog-service";
import type { Category } from "@/types";

// ... CategorySlugConflictError, CategoryCycleError, createCategory, editCategory from Task 3 ...

export class CategoryHasChildrenError extends Error {
  constructor() {
    super("This category has subcategories — reassign or delete them first");
    this.name = "CategoryHasChildrenError";
  }
}

export class CategoryHasProductsError extends Error {
  constructor() {
    super("This category has products — reassign them first");
    this.name = "CategoryHasProductsError";
  }
}

export interface DeleteCategoryOptions {
  reassignChildrenTo?: string;
  reassignProductsTo?: string;
}

export async function deleteCategory(id: string, options: DeleteCategoryOptions = {}): Promise<void> {
  const current = await getCategoryById(id);
  if (!current) throw new Error("Category not found");

  const allCategories = await listAllCategories();
  const directChildren = allCategories.filter((cat) => cat.parent_id === id);

  if (directChildren.length > 0) {
    if (!options.reassignChildrenTo) throw new CategoryHasChildrenError();
    for (const child of directChildren) {
      await updateCategoryBranding(child.id, { parent_id: options.reassignChildrenTo });
    }
  }

  const productCount = await countActiveProductsByCategory(id);
  if (productCount > 0) {
    if (!options.reassignProductsTo) throw new CategoryHasProductsError();
    await reassignProductsCategory(id, options.reassignProductsTo);
  }

  await softDeleteCategory(id);
}

export async function reassignProducts(fromCategoryId: string, toCategoryId: string): Promise<number> {
  return reassignProductsCategory(fromCategoryId, toCategoryId);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest src/lib/services/category-service.test.ts`
Expected: PASS (all Task 3 + Task 4 tests, 16 total).

- [ ] **Step 5: Commit**

```bash
git add src/lib/services/category-service.ts src/lib/services/category-service.test.ts
git commit -m "feat: add category delete (with reassignment) and standalone product reassignment"
```

---

### Task 5: Validation — SEO fields, stricter slug format, delete/reassign schemas

**Files:**
- Modify: `src/lib/validation/category.ts`
- Modify: `src/lib/validation/branding.ts` (remove `is_active` from `categoryBrandingSchema` — Design Decision 4)
- Test: `src/lib/validation/category.test.ts` (new file — no validation tests exist for categories today)

**Interfaces:**
- Produces: extended `categorySchema`/`categoryUpdateSchema` (adds `meta_title`, `meta_description`; slug now regex-validated), `categoryDeleteSchema`, `categoryReassignProductsSchema` — consumed by Task 6's routes.

- [ ] **Step 1: Write the failing tests**

```typescript
// src/lib/validation/category.test.ts
import {
  categorySchema,
  categoryUpdateSchema,
  categoryDeleteSchema,
  categoryReassignProductsSchema,
} from "./category";

describe("categorySchema", () => {
  it("accepts a valid category", () => {
    const result = categorySchema.safeParse({
      name: "T-Shirts",
      slug: "t-shirts",
      description: null,
      parent_id: null,
      display_order: 0,
      is_active: true,
    });
    expect(result.success).toBe(true);
  });

  it("accepts optional SEO fields", () => {
    const result = categorySchema.safeParse({
      name: "Kanto",
      slug: "kanto",
      meta_title: "Kanto Cards — Legacy Mania",
      meta_description: "Shop Kanto region Pokémon cards.",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a slug with uppercase or spaces", () => {
    expect(categorySchema.safeParse({ name: "Kanto", slug: "Kanto Region" }).success).toBe(false);
  });

  it("rejects a slug with leading/trailing hyphens", () => {
    expect(categorySchema.safeParse({ name: "Kanto", slug: "-kanto-" }).success).toBe(false);
  });

  it("accepts a valid hyphenated slug", () => {
    expect(categorySchema.safeParse({ name: "Dragon Ball Z", slug: "dragon-ball-z" }).success).toBe(true);
  });
});

describe("categoryUpdateSchema", () => {
  it("accepts a partial update", () => {
    expect(categoryUpdateSchema.safeParse({ is_active: false }).success).toBe(true);
  });
});

describe("categoryDeleteSchema", () => {
  it("accepts no options", () => {
    expect(categoryDeleteSchema.safeParse({}).success).toBe(true);
  });

  it("accepts reassignment targets", () => {
    const result = categoryDeleteSchema.safeParse({
      reassignChildrenTo: "11111111-1111-1111-1111-111111111111",
      reassignProductsTo: "22222222-2222-2222-2222-222222222222",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a non-uuid reassignment target", () => {
    expect(categoryDeleteSchema.safeParse({ reassignProductsTo: "not-a-uuid" }).success).toBe(false);
  });
});

describe("categoryReassignProductsSchema", () => {
  it("requires toCategoryId", () => {
    expect(categoryReassignProductsSchema.safeParse({}).success).toBe(false);
  });

  it("accepts a valid toCategoryId", () => {
    const result = categoryReassignProductsSchema.safeParse({
      toCategoryId: "11111111-1111-1111-1111-111111111111",
    });
    expect(result.success).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest src/lib/validation/category.test.ts`
Expected: FAIL — `categoryDeleteSchema`/`categoryReassignProductsSchema` don't exist; slug has no format regex yet so the reject cases wrongly pass.

- [ ] **Step 3: Implement**

Replace `src/lib/validation/category.ts`:

```typescript
import { z } from "zod";

const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const categorySchema = z.object({
  name: z.string().min(1).max(100),
  slug: z.string().min(1).max(100).regex(slugPattern, "Slug must be lowercase letters, numbers, and hyphens only"),
  description: z.string().nullable().optional(),
  parent_id: z.string().uuid().nullable().optional(),
  display_order: z.coerce.number().default(0),
  is_active: z.boolean().default(true),
  meta_title: z.string().max(200).nullable().optional(),
  meta_description: z.string().max(500).nullable().optional(),
});

export const categoryUpdateSchema = categorySchema.partial();

export const categoryDeleteSchema = z
  .object({
    reassignChildrenTo: z.string().uuid(),
    reassignProductsTo: z.string().uuid(),
  })
  .partial();

export const categoryReassignProductsSchema = z.object({
  toCategoryId: z.string().uuid(),
});

export type CategoryInput = z.infer<typeof categorySchema>;
export type CategoryUpdateInput = z.infer<typeof categoryUpdateSchema>;
export type CategoryDeleteInput = z.infer<typeof categoryDeleteSchema>;
export type CategoryReassignProductsInput = z.infer<typeof categoryReassignProductsSchema>;
```

In `src/lib/validation/branding.ts`, remove `is_active` from `categoryBrandingSchema` (Design Decision 4):

```typescript
export const categoryBrandingSchema = z
  .object({
    icon_url: assetUrl.nullable(),
    appearance: categoryAppearanceSchema,
    is_featured: z.boolean(),
    show_on_homepage: z.boolean(),
  })
  .partial()
  .refine((d) => Object.keys(d).length > 0, "No fields to update");
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest src/lib/validation/category.test.ts`
Expected: PASS (11 tests).

Run: `npx jest src/lib/services/branding-service.test.ts src/app/api/admin/categories` (existing branding tests must still pass — none of them should have been asserting on `is_active` through the branding schema, but this confirms it).
Expected: PASS, no regressions.

- [ ] **Step 5: Commit**

```bash
git add src/lib/validation/category.ts src/lib/validation/category.test.ts src/lib/validation/branding.ts
git commit -m "feat: add SEO fields and slug format validation to categories; move is_active out of branding schema"
```

---

### Task 6: API routes — audit/rate-limit on create/edit, new delete + reassign-products routes

**Files:**
- Modify: `src/app/api/admin/categories/route.ts`
- Modify: `src/app/api/admin/categories/[id]/route.ts`
- Create: `src/app/api/admin/categories/[id]/reassign-products/route.ts`
- Modify: `src/app/api/admin/categories/route.test.ts`
- Modify: `src/app/api/admin/categories/[id]/route.test.ts`
- Create: `src/app/api/admin/categories/[id]/reassign-products/route.test.ts`

**Interfaces:**
- Consumes: `createCategory`, `editCategory`, `deleteCategory`, `reassignProducts`, `CategorySlugConflictError`, `CategoryCycleError`, `CategoryHasChildrenError`, `CategoryHasProductsError` (Tasks 3-4); `categorySchema`, `categoryUpdateSchema`, `categoryDeleteSchema`, `categoryReassignProductsSchema` (Task 5); `checkRateLimit`/`rateLimitResponse` (`src/lib/rate-limit.ts`, existing); `recordAuditLog` (`src/lib/services/audit-service.ts`, existing).

- [ ] **Step 1: Write the failing tests**

Add to `src/app/api/admin/categories/route.test.ts` (mirror the existing admin-route test conventions — mock `requireAdmin`, `checkRateLimit`, and the service):

```typescript
jest.mock("@/lib/supabase/admin-auth", () => ({ requireAdmin: jest.fn() }));
jest.mock("@/lib/rate-limit", () => ({
  checkRateLimit: jest.fn(),
  rateLimitResponse: jest.fn(() => new Response(null, { status: 429 })),
}));
jest.mock("@/lib/services/audit-service", () => ({ recordAuditLog: jest.fn() }));
jest.mock("@/lib/services/category-service", () => ({
  createCategory: jest.fn(),
  CategorySlugConflictError: class CategorySlugConflictError extends Error {},
}));

import { requireAdmin } from "@/lib/supabase/admin-auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { recordAuditLog } from "@/lib/services/audit-service";
import { createCategory, CategorySlugConflictError } from "@/lib/services/category-service";
import { NextRequest } from "next/server";
import { POST } from "./route";

function req(body: unknown) {
  return new NextRequest("http://localhost/api/admin/categories", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

const validBody = { name: "T-Shirts", slug: "t-shirts", display_order: 0, is_active: true };

beforeEach(() => {
  (checkRateLimit as jest.Mock).mockReturnValue({ allowed: true });
  (requireAdmin as jest.Mock).mockResolvedValue({ ok: true, userId: "admin-1" });
});
afterEach(() => jest.clearAllMocks());

describe("POST /api/admin/categories", () => {
  it("returns 429 when rate-limited, before touching auth or the service", async () => {
    (checkRateLimit as jest.Mock).mockReturnValue({ allowed: false, resetAt: Date.now() });
    const res = await POST(req(validBody));
    expect(res.status).toBe(429);
    expect(requireAdmin).not.toHaveBeenCalled();
    expect(createCategory).not.toHaveBeenCalled();
  });

  it("returns 401/403 from requireAdmin before touching the service", async () => {
    (requireAdmin as jest.Mock).mockResolvedValue({ ok: false, response: new Response(null, { status: 403 }) });
    const res = await POST(req(validBody));
    expect(res.status).toBe(403);
    expect(createCategory).not.toHaveBeenCalled();
  });

  it("returns 400 on invalid body before touching the service", async () => {
    const res = await POST(req({ name: "" }));
    expect(res.status).toBe(400);
    expect(createCategory).not.toHaveBeenCalled();
  });

  it("creates and audit-logs on success", async () => {
    (createCategory as jest.Mock).mockResolvedValue({ id: "new-id", ...validBody });
    const res = await POST(req(validBody));
    expect(res.status).toBe(201);
    expect(recordAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "admin-1", action: "category.create", tableName: "categories" })
    );
  });

  it("returns 409 on a slug conflict", async () => {
    (createCategory as jest.Mock).mockRejectedValue(new CategorySlugConflictError());
    const res = await POST(req(validBody));
    expect(res.status).toBe(409);
    expect(recordAuditLog).not.toHaveBeenCalled();
  });
});
```

Add to `src/app/api/admin/categories/[id]/route.test.ts`, mocking `editCategory`/`deleteCategory`/`CategoryCycleError`/`CategoryHasChildrenError`/`CategoryHasProductsError` the same way, covering: 429/401/403/400 short-circuits for PATCH; PATCH success audit-logs `category.update`; PATCH returns 409 on `CategoryCycleError` or `CategorySlugConflictError`; new `DELETE` handler — 429/401/403/400 short-circuits, 404 when the service throws "Category not found", 409 with a body naming which reassignment is needed on `CategoryHasChildrenError`/`CategoryHasProductsError`, 200 + audit log `category.delete` on success.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest src/app/api/admin/categories`
Expected: FAIL — no rate limit/audit wiring yet, no `DELETE` export, no reassign-products route.

- [ ] **Step 3: Implement**

Replace `src/app/api/admin/categories/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/supabase/admin-auth";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { recordAuditLog } from "@/lib/services/audit-service";
import { createCategory, CategorySlugConflictError } from "@/lib/services/category-service";
import { categorySchema } from "@/lib/validation/category";

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for") ?? "unknown";
  const rl = checkRateLimit(`categories-admin:${ip}`, 60, 60_000);
  if (!rl.allowed) return rateLimitResponse(rl.resetAt);

  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const json = await req.json().catch(() => null);
  const parsed = categorySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid category details" }, { status: 400 });
  }

  try {
    const category = await createCategory(parsed.data);
    await recordAuditLog({
      userId: auth.userId,
      action: "category.create",
      tableName: "categories",
      recordId: category.id,
      newValues: parsed.data,
    });
    return NextResponse.json(category, { status: 201 });
  } catch (error) {
    if (error instanceof CategorySlugConflictError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    return NextResponse.json({ error: "Failed to create category" }, { status: 500 });
  }
}
```

Replace `src/app/api/admin/categories/[id]/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/supabase/admin-auth";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { recordAuditLog } from "@/lib/services/audit-service";
import {
  editCategory,
  deleteCategory,
  CategorySlugConflictError,
  CategoryCycleError,
  CategoryHasChildrenError,
  CategoryHasProductsError,
} from "@/lib/services/category-service";
import { categoryUpdateSchema, categoryDeleteSchema } from "@/lib/validation/category";

type RouteParams = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const ip = req.headers.get("x-forwarded-for") ?? "unknown";
  const rl = checkRateLimit(`categories-admin:${ip}`, 60, 60_000);
  if (!rl.allowed) return rateLimitResponse(rl.resetAt);

  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const json = await req.json().catch(() => null);
  const parsed = categoryUpdateSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid category details" }, { status: 400 });
  }

  try {
    const updated = await editCategory(id, parsed.data);
    if (!updated) return NextResponse.json({ error: "Category not found" }, { status: 404 });

    await recordAuditLog({
      userId: auth.userId,
      action: "category.update",
      tableName: "categories",
      recordId: id,
      newValues: parsed.data,
    });
    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof CategorySlugConflictError || error instanceof CategoryCycleError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    return NextResponse.json({ error: "Failed to update category" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: RouteParams) {
  const ip = req.headers.get("x-forwarded-for") ?? "unknown";
  const rl = checkRateLimit(`categories-admin:${ip}`, 60, 60_000);
  if (!rl.allowed) return rateLimitResponse(rl.resetAt);

  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const json = await req.json().catch(() => ({}));
  const parsed = categoryDeleteSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid delete options" }, { status: 400 });
  }

  try {
    await deleteCategory(id, parsed.data);
    await recordAuditLog({
      userId: auth.userId,
      action: "category.delete",
      tableName: "categories",
      recordId: id,
      newValues: parsed.data,
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof CategoryHasChildrenError || error instanceof CategoryHasProductsError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    if (error instanceof Error && error.message === "Category not found") {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    return NextResponse.json({ error: "Failed to delete category" }, { status: 500 });
  }
}
```

Create `src/app/api/admin/categories/[id]/reassign-products/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/supabase/admin-auth";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { recordAuditLog } from "@/lib/services/audit-service";
import { reassignProducts } from "@/lib/services/category-service";
import { categoryReassignProductsSchema } from "@/lib/validation/category";

type RouteParams = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: RouteParams) {
  const ip = req.headers.get("x-forwarded-for") ?? "unknown";
  const rl = checkRateLimit(`categories-admin:${ip}`, 60, 60_000);
  if (!rl.allowed) return rateLimitResponse(rl.resetAt);

  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const json = await req.json().catch(() => null);
  const parsed = categoryReassignProductsSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "toCategoryId is required" }, { status: 400 });
  }

  try {
    const movedCount = await reassignProducts(id, parsed.data.toCategoryId);
    await recordAuditLog({
      userId: auth.userId,
      action: "category.reassign_products",
      tableName: "categories",
      recordId: id,
      newValues: { toCategoryId: parsed.data.toCategoryId, movedCount },
    });
    return NextResponse.json({ success: true, movedCount });
  } catch {
    return NextResponse.json({ error: "Failed to reassign products" }, { status: 500 });
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest src/app/api/admin/categories`
Expected: PASS (all existing + new tests across the 3 route files).

- [ ] **Step 5: Commit**

```bash
git add src/app/api/admin/categories/route.ts src/app/api/admin/categories/route.test.ts src/app/api/admin/categories/[id]/route.ts src/app/api/admin/categories/[id]/route.test.ts src/app/api/admin/categories/[id]/reassign-products/
git commit -m "feat: add rate-limit/audit-log to category create/edit, new delete and reassign-products routes"
```

---

### Task 7: Admin UI — recursive category tree with drag-and-drop, hide/delete actions

**Files:**
- Create: `src/components/admin/category-tree.tsx`
- Create: `src/components/admin/category-tree.test.tsx`
- Modify: `src/app/admin/categories/page.tsx`

**Interfaces:**
- Consumes: `CategoryWithChildren[]` (existing type); calls `PATCH /api/admin/categories/order` (existing, unchanged), `PATCH /api/admin/categories/:id` (Task 6, for quick hide/unhide via `is_active`), `DELETE /api/admin/categories/:id` (Task 6).
- Produces: `<CategoryTree categories={CategoryWithChildren[]} onChanged={() => void} />` — consumed by Task 7's Step 5 rewrite of `page.tsx`, and available for Task 8's edit page to link back to.

- [ ] **Step 1: Write the failing tests**

```typescript
// src/components/admin/category-tree.test.tsx
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import CategoryTree from "./category-tree";
import type { CategoryWithChildren } from "@/types";

global.fetch = jest.fn();

function makeCategory(overrides: Partial<CategoryWithChildren> = {}): CategoryWithChildren {
  return {
    id: "pokemon",
    name: "Pokémon",
    slug: "pokemon",
    description: null,
    image_url: null,
    icon_url: null,
    appearance: {},
    is_featured: false,
    show_on_homepage: true,
    parent_id: null,
    display_order: 0,
    is_active: true,
    meta_title: null,
    meta_description: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    children: [],
    ...overrides,
  } as CategoryWithChildren;
}

beforeEach(() => (global.fetch as jest.Mock).mockResolvedValue({ ok: true, json: async () => ({}) }));
afterEach(() => jest.clearAllMocks());

describe("CategoryTree", () => {
  it("renders nested categories at any depth", () => {
    const tree = [
      makeCategory({
        id: "pokemon",
        name: "Pokémon",
        children: [
          makeCategory({ id: "kanto", name: "Kanto", parent_id: "pokemon", children: [
            makeCategory({ id: "starters", name: "Starters", parent_id: "kanto" }),
          ] }),
        ],
      }),
    ];
    render(<CategoryTree categories={tree} onChanged={jest.fn()} />);
    expect(screen.getByText("Pokémon")).toBeInTheDocument();
    expect(screen.getByText("Kanto")).toBeInTheDocument();
    expect(screen.getByText("Starters")).toBeInTheDocument();
  });

  it("calls PATCH to toggle is_active when the hide/unhide control is used", async () => {
    render(<CategoryTree categories={[makeCategory({ id: "kanto", name: "Kanto", is_active: true })]} onChanged={jest.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /hide/i }));
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/admin/categories/kanto",
        expect.objectContaining({ method: "PATCH", body: JSON.stringify({ is_active: false }) })
      );
    });
  });

  it("calls DELETE when the delete control is confirmed", async () => {
    window.confirm = jest.fn(() => true);
    render(<CategoryTree categories={[makeCategory({ id: "kanto", name: "Kanto" })]} onChanged={jest.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /delete/i }));
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/admin/categories/kanto",
        expect.objectContaining({ method: "DELETE" })
      );
    });
  });

  it("does not call DELETE when the confirmation is declined", () => {
    window.confirm = jest.fn(() => false);
    render(<CategoryTree categories={[makeCategory({ id: "kanto", name: "Kanto" })]} onChanged={jest.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /delete/i }));
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("shows a 409 error message inline instead of throwing when delete is blocked", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 409,
      json: async () => ({ error: "This category has products — reassign them first" }),
    });
    window.confirm = jest.fn(() => true);
    render(<CategoryTree categories={[makeCategory({ id: "kanto", name: "Kanto" })]} onChanged={jest.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /delete/i }));
    await waitFor(() => {
      expect(screen.getByText(/reassign them first/i)).toBeInTheDocument();
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest src/components/admin/category-tree.test.tsx`
Expected: FAIL — `category-tree.tsx` doesn't exist.

- [ ] **Step 3: Implement**

```typescript
// src/components/admin/category-tree.tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { Edit, Eye, EyeOff, Trash2, GripVertical } from "lucide-react";
import type { CategoryWithChildren } from "@/types";
import { cn } from "@/lib/utils";

interface CategoryTreeProps {
  categories: CategoryWithChildren[];
  onChanged: () => void;
}

export default function CategoryTree({ categories, onChanged }: CategoryTreeProps) {
  const [error, setError] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);

  async function toggleActive(cat: CategoryWithChildren) {
    setError(null);
    const res = await fetch(`/api/admin/categories/${cat.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_active: !cat.is_active }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Failed to update category");
      return;
    }
    onChanged();
  }

  async function handleDelete(cat: CategoryWithChildren) {
    if (!window.confirm(`Delete "${cat.name}"? This cannot be undone from here.`)) return;
    setError(null);
    const res = await fetch(`/api/admin/categories/${cat.id}`, { method: "DELETE" });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Failed to delete category");
      return;
    }
    onChanged();
  }

  async function reorderSiblings(siblingIds: string[]) {
    setError(null);
    const res = await fetch("/api/admin/categories/order", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: siblingIds }),
    });
    if (!res.ok) {
      setError("Failed to reorder categories");
      return;
    }
    onChanged();
  }

  function renderLevel(nodes: CategoryWithChildren[], depth: number) {
    return (
      <ul className={cn("space-y-1", depth > 0 && "ml-5 mt-1 border-l border-border pl-3")}>
        {nodes.map((cat, index) => (
          <li
            key={cat.id}
            draggable
            onDragStart={() => setDragId(cat.id)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => {
              if (!dragId || dragId === cat.id) return;
              const ids = nodes.map((n) => n.id);
              const fromIndex = ids.indexOf(dragId);
              if (fromIndex === -1) return;
              ids.splice(fromIndex, 1);
              ids.splice(index, 0, dragId);
              setDragId(null);
              reorderSiblings(ids);
            }}
          >
            <div className="flex items-center justify-between p-3 rounded-xl bg-accent/50 hover:bg-accent transition-colors">
              <div className="flex items-center gap-2 min-w-0">
                <GripVertical className="w-4 h-4 text-muted-foreground cursor-grab shrink-0" />
                <div className="min-w-0">
                  <p className="font-medium text-sm truncate">{cat.name}</p>
                  <p className="text-xs text-muted-foreground font-mono truncate">{cat.slug}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span
                  className={cn(
                    "text-xs px-2 py-0.5 rounded-full font-medium",
                    cat.is_active
                      ? "bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300"
                      : "bg-gray-100 dark:bg-gray-800 text-gray-500"
                  )}
                >
                  {cat.is_active ? "Active" : "Hidden"}
                </span>
                <button
                  aria-label={cat.is_active ? "Hide" : "Unhide"}
                  onClick={() => toggleActive(cat)}
                  className="p-1.5 rounded-lg hover:bg-background transition-colors text-muted-foreground hover:text-foreground"
                >
                  {cat.is_active ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
                <Link
                  href={`/admin/categories/${cat.id}/edit`}
                  aria-label="Edit"
                  className="p-1.5 rounded-lg hover:bg-background transition-colors text-muted-foreground hover:text-foreground"
                >
                  <Edit className="w-3.5 h-3.5" />
                </Link>
                <button
                  aria-label="Delete"
                  onClick={() => handleDelete(cat)}
                  className="p-1.5 rounded-lg hover:bg-background transition-colors text-muted-foreground hover:text-red-500"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
            {cat.children && cat.children.length > 0 && renderLevel(cat.children, depth + 1)}
          </li>
        ))}
      </ul>
    );
  }

  return (
    <div>
      {error && (
        <p className="text-sm text-red-500 mb-3 px-3 py-2 rounded-lg bg-red-500/10">{error}</p>
      )}
      {renderLevel(categories, 0)}
    </div>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest src/components/admin/category-tree.test.tsx`
Expected: PASS (5 tests).

- [ ] **Step 5: Wire it into the admin page**

Replace `src/app/admin/categories/page.tsx`'s category-list panel (right column) to use `getCategoryTree()` (Phase 1's `CatalogService`, already builds a nested `CategoryWithChildren[]` from a flat list — reuse it instead of hand-rolling another tree builder) and render `<CategoryTree>`. Since `page.tsx` is a Server Component and `CategoryTree`'s mutations need a client-side refresh, wrap it in a small client wrapper that calls `router.refresh()` on change:

```typescript
// src/app/admin/categories/page.tsx
import Link from "next/link";
import { Plus } from "lucide-react";
import CategoryForm from "@/components/admin/category-form";
import CategoryTreePanel from "@/components/admin/category-tree-panel";
import { getCategoryTree } from "@/lib/services/catalog-service";

export default async function AdminCategoriesPage() {
  const tree = await getCategoryTree();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Categories</h1>
          <p className="text-muted-foreground text-sm">
            Manage catalog hierarchy — any depth, any collection type
          </p>
        </div>
        <Link href="/admin/categories/new" className="btn-primary flex items-center gap-2 px-4 py-2 text-sm">
          <Plus className="w-4 h-4" /> New Category
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-card border border-border rounded-2xl p-5">
          <h2 className="font-bold mb-4">Quick Add (top-level or pick a parent)</h2>
          <CategoryForm parentCategories={tree.flatMap((c) => [c, ...(c.children ?? [])])} />
        </div>

        <div className="bg-card border border-border rounded-2xl p-5">
          <h2 className="font-bold mb-4">All Categories</h2>
          <CategoryTreePanel initialTree={tree} />
        </div>
      </div>
    </div>
  );
}
```

```typescript
// src/components/admin/category-tree-panel.tsx
"use client";

import { useRouter } from "next/navigation";
import CategoryTree from "./category-tree";
import type { CategoryWithChildren } from "@/types";

export default function CategoryTreePanel({ initialTree }: { initialTree: CategoryWithChildren[] }) {
  const router = useRouter();
  return <CategoryTree categories={initialTree} onChanged={() => router.refresh()} />;
}
```

`getCategoryTree()` only returns *active* top-level roots today per Phase 1's `listActiveCategories()` — but the admin panel needs to see inactive/hidden categories too, otherwise "Unhide" would be impossible (a hidden category would vanish from its own management screen). Note this for Task 6's reviewer: `getCategoryTree()` must be changed (or a parallel `getCategoryTreeForAdmin()` added) to source from `listAllCategories()` instead of `listActiveCategories()`. Add this as part of this task:

```typescript
// src/lib/services/catalog-service.ts — add alongside getCategoryTree
import { listAllCategories } from "@/lib/repositories/category-repository";

export async function getCategoryTreeForAdmin(): Promise<CategoryWithChildren[]> {
  const categories = await listAllCategories();
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
```

Use `getCategoryTreeForAdmin()` (not `getCategoryTree()`) in `page.tsx` above. Add one test to `src/lib/services/catalog-service.test.ts` mirroring `getCategoryTree`'s existing test but asserting it includes an inactive category (mock `listAllCategories` instead of `listActiveCategories`).

- [ ] **Step 6: Run full check**

Run: `npx jest && npx tsc --noEmit`
Expected: all suites pass, clean type-check.

- [ ] **Step 7: Commit**

```bash
git add src/components/admin/category-tree.tsx src/components/admin/category-tree.test.tsx src/components/admin/category-tree-panel.tsx src/app/admin/categories/page.tsx src/lib/services/catalog-service.ts src/lib/services/catalog-service.test.ts
git commit -m "feat: recursive drag-and-drop category tree in admin panel, sourced from all categories including hidden"
```

---

### Task 8: Admin UI — build the missing edit page, expand the form with SEO/slug/parent-exclusion

**Files:**
- Create: `src/app/admin/categories/[id]/edit/page.tsx`
- Create: `src/app/admin/categories/new/page.tsx`
- Modify: `src/components/admin/category-form.tsx`
- Modify: `src/components/admin/category-form.test.tsx` (new file — no test exists for this component today)

**Interfaces:**
- Consumes: `getCategoryTreeForAdmin()` (Task 7) for the parent-picker; `getDescendantCategoryIds()` (Phase 1) to exclude a category's own descendants from its own parent-picker.
- Produces: no new exported interfaces (pages + a UI component); this is the task that closes the pre-existing dead link (`/admin/categories/page.tsx` has linked to `/admin/categories/${cat.id}/edit` since before this plan, and that route 404s today).

- [ ] **Step 1: Write the failing component test**

```typescript
// src/components/admin/category-form.test.tsx
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import CategoryForm from "./category-form";

const mockPush = jest.fn();
const mockRefresh = jest.fn();
jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, refresh: mockRefresh }),
}));

global.fetch = jest.fn();

beforeEach(() => (global.fetch as jest.Mock).mockResolvedValue({ ok: true, json: async () => ({}) }));
afterEach(() => jest.clearAllMocks());

describe("CategoryForm", () => {
  it("auto-slugs from the name on create only", () => {
    render(<CategoryForm parentCategories={[]} excludeCategoryIds={[]} />);
    fireEvent.change(screen.getByLabelText(/^name/i), { target: { value: "T-Shirts" } });
    expect(screen.getByLabelText(/^slug/i)).toHaveValue("t-shirts");
  });

  it("does not auto-slug when editing an existing category", () => {
    render(
      <CategoryForm
        parentCategories={[]}
        excludeCategoryIds={[]}
        initialData={{ id: "cat-1", name: "Kanto", slug: "kanto" }}
      />
    );
    fireEvent.change(screen.getByLabelText(/^name/i), { target: { value: "Kanto Region" } });
    expect(screen.getByLabelText(/^slug/i)).toHaveValue("kanto");
  });

  it("excludes the category itself and its descendants from the parent dropdown", () => {
    render(
      <CategoryForm
        parentCategories={[
          { id: "pokemon", name: "Pokémon" },
          { id: "kanto", name: "Kanto" },
          { id: "starters", name: "Starters" },
        ]}
        excludeCategoryIds={["kanto", "starters"]}
        initialData={{ id: "kanto", name: "Kanto", slug: "kanto" }}
      />
    );
    expect(screen.queryByRole("option", { name: "Kanto" })).not.toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Starters" })).not.toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Pokémon" })).toBeInTheDocument();
  });

  it("submits SEO fields alongside content fields", async () => {
    render(<CategoryForm parentCategories={[]} excludeCategoryIds={[]} />);
    fireEvent.change(screen.getByLabelText(/^name/i), { target: { value: "Kanto" } });
    fireEvent.change(screen.getByLabelText(/meta title/i), { target: { value: "Kanto — Legacy Mania" } });
    fireEvent.click(screen.getByRole("button", { name: /add category/i }));
    await waitFor(() => {
      const body = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
      expect(body.meta_title).toBe("Kanto — Legacy Mania");
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/components/admin/category-form.test.tsx`
Expected: FAIL — `excludeCategoryIds` prop doesn't exist, no meta_title field rendered, `parent_id` dropdown doesn't filter.

- [ ] **Step 3: Implement**

Replace `src/components/admin/category-form.tsx`:

```typescript
"use client";

import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { slugify } from "@/lib/utils";
import { toast } from "sonner";

const schema = z.object({
  name: z.string().min(1, "Name is required"),
  slug: z.string().min(1, "Slug is required"),
  description: z.string().optional(),
  parent_id: z.string().optional(),
  display_order: z.coerce.number().default(0),
  is_active: z.boolean().default(true),
  meta_title: z.string().optional(),
  meta_description: z.string().optional(),
});
type FormData = z.infer<typeof schema>;

interface ParentOption {
  id: string;
  name: string;
}

interface CategoryFormProps {
  parentCategories: ParentOption[];
  /** Category ids to hide from the parent dropdown — always includes the category's own id and every descendant, so an edit can never create a cycle from the UI. */
  excludeCategoryIds: string[];
  initialData?: Partial<FormData> & { id?: string };
}

export default function CategoryForm({ parentCategories, excludeCategoryIds, initialData }: CategoryFormProps) {
  const router = useRouter();
  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: initialData?.name ?? "",
      slug: initialData?.slug ?? "",
      description: initialData?.description ?? "",
      parent_id: initialData?.parent_id ?? "",
      display_order: initialData?.display_order ?? 0,
      is_active: initialData?.is_active ?? true,
      meta_title: initialData?.meta_title ?? "",
      meta_description: initialData?.meta_description ?? "",
    },
  });

  const selectableParents = parentCategories.filter((p) => !excludeCategoryIds.includes(p.id));

  const onSubmit = async (data: FormData) => {
    const payload = {
      name: data.name,
      slug: data.slug,
      description: data.description ?? null,
      parent_id: data.parent_id || null,
      display_order: data.display_order,
      is_active: data.is_active,
      meta_title: data.meta_title ?? null,
      meta_description: data.meta_description ?? null,
    };

    const res = initialData?.id
      ? await fetch(`/api/admin/categories/${initialData.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
      : await fetch("/api/admin/categories", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      toast.error(body.error ?? "Failed to save category");
      return;
    }
    toast.success(initialData?.id ? "Category updated" : "Category created");
    router.refresh();
    if (!initialData?.id) form.reset();
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
      <div>
        <label htmlFor="category-name" className="block text-sm font-medium mb-1.5">Name *</label>
        <input
          id="category-name"
          {...form.register("name")}
          placeholder="e.g., T-Shirts"
          className="w-full px-4 py-3 rounded-xl bg-background border border-border focus:border-primary focus:outline-none text-sm"
          onChange={(e) => {
            form.setValue("name", e.target.value);
            if (!initialData?.id) form.setValue("slug", slugify(e.target.value));
          }}
        />
        {form.formState.errors.name && (
          <p className="text-red-500 text-xs mt-1">{form.formState.errors.name.message}</p>
        )}
      </div>

      <div>
        <label htmlFor="category-slug" className="block text-sm font-medium mb-1.5">Slug *</label>
        <input
          id="category-slug"
          {...form.register("slug")}
          placeholder="t-shirts"
          className="w-full px-4 py-3 rounded-xl bg-background border border-border focus:border-primary focus:outline-none text-sm font-mono"
        />
      </div>

      <div>
        <label htmlFor="category-parent" className="block text-sm font-medium mb-1.5">Parent Category</label>
        <select
          id="category-parent"
          {...form.register("parent_id")}
          className="w-full px-4 py-3 rounded-xl bg-background border border-border focus:border-primary focus:outline-none text-sm"
        >
          <option value="">No Parent (Top Level)</option>
          {selectableParents.map((cat) => (
            <option key={cat.id} value={cat.id}>{cat.name}</option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="category-description" className="block text-sm font-medium mb-1.5">Description</label>
        <textarea
          id="category-description"
          {...form.register("description")}
          rows={2}
          className="w-full px-4 py-3 rounded-xl bg-background border border-border focus:border-primary focus:outline-none text-sm resize-none"
        />
      </div>

      <div>
        <label htmlFor="category-meta-title" className="block text-sm font-medium mb-1.5">Meta Title</label>
        <input
          id="category-meta-title"
          {...form.register("meta_title")}
          placeholder="e.g., Kanto Region Cards — Legacy Mania"
          className="w-full px-4 py-3 rounded-xl bg-background border border-border focus:border-primary focus:outline-none text-sm"
        />
      </div>

      <div>
        <label htmlFor="category-meta-description" className="block text-sm font-medium mb-1.5">Meta Description</label>
        <textarea
          id="category-meta-description"
          {...form.register("meta_description")}
          rows={2}
          className="w-full px-4 py-3 rounded-xl bg-background border border-border focus:border-primary focus:outline-none text-sm resize-none"
        />
      </div>

      <div className="flex items-center gap-3">
        <div className="flex-1">
          <label htmlFor="category-display-order" className="block text-sm font-medium mb-1.5">Display Order</label>
          <input
            id="category-display-order"
            {...form.register("display_order")}
            type="number"
            min="0"
            className="w-full px-4 py-3 rounded-xl bg-background border border-border focus:border-primary focus:outline-none text-sm"
          />
        </div>
        <label className="flex items-center gap-2 cursor-pointer mt-6">
          <input {...form.register("is_active")} type="checkbox" className="w-4 h-4 accent-primary" />
          <span className="text-sm font-medium">Active</span>
        </label>
      </div>

      <button
        type="submit"
        disabled={form.formState.isSubmitting}
        className="w-full btn-primary py-3 text-sm disabled:opacity-70"
      >
        {form.formState.isSubmitting
          ? "Saving..."
          : initialData?.id
          ? "Update Category"
          : "Add Category"}
      </button>
    </form>
  );
}
```

Create `src/app/admin/categories/[id]/edit/page.tsx`:

```typescript
import { notFound } from "next/navigation";
import { getCategoryTreeForAdmin } from "@/lib/services/catalog-service";
import { getDescendantCategoryIds } from "@/lib/services/catalog-service";
import CategoryForm from "@/components/admin/category-form";

function flatten(tree: Awaited<ReturnType<typeof getCategoryTreeForAdmin>>): { id: string; name: string }[] {
  return tree.flatMap((cat) => [{ id: cat.id, name: cat.name }, ...flatten(cat.children ?? [])]);
}

export default async function EditCategoryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const tree = await getCategoryTreeForAdmin();
  const flat = flatten(tree);
  const current = flat.find((c) => c.id === id);
  if (!current) notFound();

  const descendantIds = await getDescendantCategoryIds(id);

  const fullTree = await getCategoryTreeForAdmin();
  const fullFlatWithFields = fullTree.flatMap(function collect(cat: (typeof fullTree)[number]): typeof fullTree {
    return [cat, ...(cat.children ?? []).flatMap(collect)];
  });
  const source = fullFlatWithFields.find((c) => c.id === id)!;

  return (
    <div className="max-w-lg space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Edit Category</h1>
        <p className="text-muted-foreground text-sm">{current.name}</p>
      </div>
      <div className="bg-card border border-border rounded-2xl p-5">
        <CategoryForm
          parentCategories={flat}
          excludeCategoryIds={descendantIds}
          initialData={{
            id: source.id,
            name: source.name,
            slug: source.slug,
            description: source.description ?? "",
            parent_id: source.parent_id ?? "",
            display_order: source.display_order,
            is_active: source.is_active,
            meta_title: source.meta_title ?? "",
            meta_description: source.meta_description ?? "",
          }}
        />
      </div>
    </div>
  );
}
```

Create `src/app/admin/categories/new/page.tsx`:

```typescript
import { getCategoryTreeForAdmin } from "@/lib/services/catalog-service";

function flatten(tree: Awaited<ReturnType<typeof getCategoryTreeForAdmin>>): { id: string; name: string }[] {
  return tree.flatMap((cat) => [{ id: cat.id, name: cat.name }, ...flatten(cat.children ?? [])]);
}

import CategoryForm from "@/components/admin/category-form";

export default async function NewCategoryPage() {
  const tree = await getCategoryTreeForAdmin();
  const flat = flatten(tree);

  return (
    <div className="max-w-lg space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">New Category</h1>
        <p className="text-muted-foreground text-sm">Works for any collection type — cards, apparel, accessories.</p>
      </div>
      <div className="bg-card border border-border rounded-2xl p-5">
        <CategoryForm parentCategories={flat} excludeCategoryIds={[]} />
      </div>
    </div>
  );
}
```

Note: `flatten()` is duplicated verbatim between `[id]/edit/page.tsx` and `new/page.tsx`. This is intentional per YAGNI/DRY balance at 2 call sites of a 2-line function — if a third page needs it, extract to `src/lib/utils.ts` at that point, not before.

Also update the "Quick Add" panel on `src/app/admin/categories/page.tsx` (Task 7) to pass `excludeCategoryIds={[]}` to its `<CategoryForm>` call (it has no `initialData`, so nothing to exclude) — this is a required prop as of this task, so Task 7's call site needs the added prop or `tsc` fails.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest src/components/admin/category-form.test.tsx`
Expected: PASS (4 tests).

- [ ] **Step 5: Run full check**

Run: `npx jest && npx tsc --noEmit`
Expected: all suites pass (including Task 7's now-satisfied `excludeCategoryIds` prop requirement), clean type-check.

- [ ] **Step 6: Commit**

```bash
git add src/app/admin/categories/[id]/edit/page.tsx src/app/admin/categories/new/page.tsx src/components/admin/category-form.tsx src/components/admin/category-form.test.tsx src/app/admin/categories/page.tsx
git commit -m "feat: build the missing category edit/new admin pages with SEO fields and cycle-safe parent picker"
```

---

### Task 9: Regression + generic-hierarchy integration test

**Files:**
- Test: `src/app/api/products/route.test.ts` (extend)
- Test: `src/lib/services/catalog-service.test.ts` (extend)

**Interfaces:**
- Consumes: `getDescendantCategoryIds` (Phase 1, unchanged by this plan).

This task exists to produce concrete proof — not Pokémon, not a card franchise — that a category tree an admin builds through this plan's new CRUD aggregates correctly through Phase 1's unchanged code path.

- [ ] **Step 1: Write the test**

Add to `src/lib/services/catalog-service.test.ts`, inside the existing `describe("getDescendantCategoryIds", ...)` block:

```typescript
  it("aggregates a non-card, admin-created hierarchy identically to a card franchise (T-Shirts → Men → Hoodies)", async () => {
    (listAllCategories as jest.Mock).mockResolvedValue([
      cat("t-shirts", null),
      cat("men", "t-shirts"),
      cat("hoodies", "men"),
      cat("women", "t-shirts"),
    ]);
    const ids = await getDescendantCategoryIds("t-shirts");
    expect(ids.sort()).toEqual(["t-shirts", "men", "hoodies", "women"].sort());
  });
```

(This reuses the `cat(id, parent_id)` test helper already defined at the top of this file from Phase 1 — extend it if needed so it also sets `is_active: true`, matching Task 4's fix to that helper.)

Add to `src/app/api/products/route.test.ts`:

```typescript
describe("GET /api/products category expansion — generic hierarchy", () => {
  it("expands a non-card category the same way it expands a card category", async () => {
    (getDescendantCategoryIds as jest.Mock).mockResolvedValue(["t-shirts", "men", "hoodies", "women"]);
    await GET(req("?category=t-shirts"));
    expect(getDescendantCategoryIds).toHaveBeenCalledWith("t-shirts");
    expect(mockIn).toHaveBeenCalledWith("category_id", ["t-shirts", "men", "hoodies", "women"]);
  });
});
```

- [ ] **Step 2: Run tests to verify they pass**

Run: `npx jest src/lib/services/catalog-service.test.ts src/app/api/products/route.test.ts`
Expected: PASS — these tests exercise the exact same `getDescendantCategoryIds`/`.in()` code path Phase 1 built and this plan's Task 1-8 left untouched, just with different string values, proving no card-specific behavior exists.

- [ ] **Step 3: Run the full regression suite**

Run: `npx jest && npx tsc --noEmit`
Expected: full green, no regressions anywhere in the suite — this is the plan's explicit regression gate before docs.

- [ ] **Step 4: Commit**

```bash
git add src/lib/services/catalog-service.test.ts src/app/api/products/route.test.ts
git commit -m "test: prove category aggregation is generic across franchise and non-card hierarchies"
```

---

### Task 10: Documentation

**Files:**
- Modify: `API.md`
- Modify: `DATABASE.md`
- Modify: `ROADMAP.md`
- Modify: `PROJECT_CONTEXT.md`
- Modify: `AI_MEMORY.md`
- Modify: `CHANGELOG.md`
- Modify: `TASKS.md`
- Modify: `update.md`

`README.md` is not touched — nothing in this plan changes setup/run instructions, which is what `README.md` covers in this repo.

- [ ] **Step 1: `API.md`**

Under the existing `## Admin (\`requireAdmin()\` required)` table, add rows (matching the existing table's column style) for: `DELETE /api/admin/categories/:id` (body `{ reassignChildrenTo?, reassignProductsTo? }`, 409 if children/products unresolved), `POST /api/admin/categories/:id/reassign-products` (body `{ toCategoryId }`). Update the existing `POST /api/admin/categories` and `PATCH /api/admin/categories/:id` row descriptions to note they're now rate-limited + audit-logged (matching every other admin route) and accept `meta_title`/`meta_description`. Note the `categoryBrandingSchema` no longer accepts `is_active` (moved to the content-edit endpoint).

- [ ] **Step 2: `DATABASE.md`**

Add `deleted_at TIMESTAMPTZ` to the `categories` table row (migration `012`), matching how `banners`'/`homepage_notifications`' `deleted_at` are documented (soft delete, `deleted_at IS NULL` = visible).

- [ ] **Step 3: `ROADMAP.md`**

Update the existing "3 — Product/Category hardening" row's status from "Not started" to "✅ Complete (\<date\>)" and expand its Scope cell to describe what actually shipped: generic unlimited-depth Category CMS (create/rename/move/reorder/hide/soft-delete/reassign), reused by every current and future collection type, no category-specific code. (`/api/products/:slug` and `/search` and navbar catalog tree, if still not shipped, get split into a new "not started" row rather than silently marked done — check `TASKS.md`/codebase for their current status before writing this row and be precise about what's actually done vs. still pending in that original phase's scope.)

Add a new `## Future Enhancements (documented, not built)` section (or append to one if it already exists) with these four entries, verbatim in substance, each carrying a one-line "why" so a future implementer doesn't have to re-derive the reasoning:

```markdown
## Future Enhancements (documented, not built)

- **Generic internal linking (`link_type`/`link_value`) for CMS modules.** When homepage tiles, navigation items, or promotional sections are built (Phases 4-5), they should link via `link_type` (`category` | `product` | `collection` | `search` | `page` | `custom_url`) + `link_value`, not a bare `category_id` column — avoids a schema change every time a new destination type is introduced.
- **Category Slug History + 301 redirects.** A `category_slug_history` table (`category_id`, `old_slug`, `new_slug`, `created_at`) plus redirect-on-404 logic, so renaming a category's slug (e.g. `kanto` → `kanto-region`) doesn't break existing bookmarks/search-engine indexes. Not needed until slug renames are common enough to matter.
- **Richer category media fields.** `thumbnail_image`, `hero_image`, `cover_image`, `banner_image` as additional columns on `categories`, for presentation needs beyond today's `image_url`/`icon_url`.
- **Per-row audit metadata on categories.** `created_by`/`updated_by` columns on `categories` itself, so attribution doesn't require joining `audit_logs`. `audit_logs` already covers every category mutation today (see `category.create`/`category.update`/`category.delete` actions) — this would be a convenience, not a gap.
```

- [ ] **Step 4: `PROJECT_CONTEXT.md`**

Update the "Category Structure" section: replace the hardcoded Pokémon-subsection example tree with a note that regions/sagas/arcs are now fully admin-managed via `/admin/categories` (create/rename/delete/reorder/hide, unlimited depth) — keep one illustrative example tree, but label it as illustrative, not fixed. Add `/admin/categories/new` and `/admin/categories/:id/edit` to the Page Map table.

- [ ] **Step 5: `AI_MEMORY.md`**

Add a gotcha: "Category cycle prevention lives in `CategoryService.editCategory()`, reusing Phase 1's `getDescendantCategoryIds()` — never add a second parent_id validation path." And: "Category delete is soft (`deleted_at`) and blocks on unresolved children/products — never call `softDeleteCategory()` directly from a route; always go through `CategoryService.deleteCategory()`."

Add one more forward-looking gotcha so the next CMS phase doesn't have to rediscover this by rewriting a schema: "**Future CMS modules that link somewhere (homepage tiles, nav items, promo sections) must not assume the target is always a category.** Model the link as `link_type` (`category`\|`product`\|`collection`\|`search`\|`page`\|`custom_url`) + `link_value`, not a bare `category_id` column — see `ROADMAP.md`'s Future Enhancements section for the full rationale. This is guidance for Phase 4/5, not something the current Category CMS implements."

- [ ] **Step 6: `CHANGELOG.md`**

Add an `### Added` entry under `[Unreleased]` summarizing the generic Category CMS: soft delete, cycle prevention, slug uniqueness, product/branch reassignment, SEO fields, recursive drag-and-drop admin tree, the previously-dead `/admin/categories/:id/edit` route now built. Explicitly state it was built generic — verified via the T-Shirts/Men/Hoodies test in Task 9 — with zero Pokémon-specific code.

- [ ] **Step 7: `TASKS.md`**

Move "Set up categories" (already checked in Phase 1's docs task) into a note referencing this CMS; add a new checked item under Priority 2 or 3 for "Category CMS — full admin CRUD, soft delete, reassignment, SEO fields."

- [ ] **Step 8: `update.md`**

Read the file's existing format first (last touched in the initial build per `TASKS.md`'s Completed list) and append an entry in that same format/section describing this work, dated to when the plan lands.

- [ ] **Step 9: Commit**

```bash
git add API.md DATABASE.md ROADMAP.md PROJECT_CONTEXT.md AI_MEMORY.md CHANGELOG.md TASKS.md update.md
git commit -m "docs: record generic Category CMS (CRUD, soft delete, reassignment, SEO fields)"
```
