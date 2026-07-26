# Product Display Order Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the catalog ordering bug by giving `products` a `display_order` column that becomes the canonical default sort everywhere, replacing the current `created_at DESC` placeholder and the JS-side re-sort in `catalog-client.tsx`.

**Architecture:** Extend the existing `categories.display_order` pattern (proven, already live) to `products`. Sorting happens in SQL via a single shared `applyProductSort()` helper consumed by every storefront query, not per-page duplicated switch statements. No new architectural layer — extends the existing Service → Repository → API → UI stack already in place for products.

**Tech Stack:** Next.js 16 App Router, Supabase Postgres (raw PostgREST `fetch` in `product-repository.ts`, matching its existing convention — not the `supabase-js` client used by storefront pages), Zod, Jest.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-07-26-product-display-order-design.md`
- `display_order INTEGER NOT NULL DEFAULT 0 CHECK (display_order >= 0)`. Not globally unique — conflicts are only checked within the same `category_id`.
- Migration backfill preserves current insertion order per category (`ROW_NUMBER() OVER (PARTITION BY category_id ORDER BY created_at ASC)`, 1-indexed). No alphabetical reordering.
- Every default sort, everywhere: `ORDER BY display_order ASC, created_at ASC` (tie-break). No surface may default to `created_at`/`updated_at`/name/UUID.
- Sort options: Display Order (default), Featured, Newest, Oldest, Price Low→High, Price High→Low, A→Z, Z→A.
- Duplicate `display_order` within a category is a **warning**, never a block (matches the `categories` table's own lack of a uniqueness constraint).
- `/api/admin/products` and `/api/admin/products/[id]` currently have **no rate limiting or audit logging** (unlike the banners/notifications admin routes) — this plan does not retrofit that; the new reorder route matches this subsystem's actual existing convention (`requireAdmin` only), not the banners subsystem's fuller convention. Don't "fix" this inconsistency as a side effect — out of scope.
- No Playwright/E2E in this repo (`package.json` has no `@playwright/test`) — not added by this plan. Tests are Jest only, matching every existing test file referenced below.
- `product-form.tsx` has its own client-side zod schema duplicated from `src/lib/validation/product.ts` (pre-existing convention in this codebase) — extend both schemas identically; do not deduplicate them as part of this fix (unrelated refactor, out of scope).

---

### Task 1: Migration + generated types

**Files:**
- Create: `supabase/migrations/011_product_display_order.sql`
- Modify: `src/types/supabase.ts` (products `Row` — find the `products: { Row: {` block at line 218, confirmed columns through `updated_at` at line 243)

**Interfaces:**
- Produces: `products.display_order` column (INTEGER, NOT NULL, default 0, CHECK >= 0), indexes `idx_products_category_display_order (category_id, display_order)` and `idx_products_display_order (display_order)`. Every later task's repository/query code depends on this exact column name and type.

- [ ] **Step 1: Write the migration**

```sql
-- supabase/migrations/011_product_display_order.sql
-- Adds manual catalog ordering to products, fixing the bug where every
-- storefront surface defaulted to created_at DESC (newest-upload-first)
-- because no ordering column ever existed. Extends the exact pattern
-- categories.display_order already uses (001_initial_schema.sql).
--
-- Backfill preserves current insertion order per category — no alphabetical
-- reordering, no name-based guessing — so deploying this does not reshuffle
-- the live catalog. Admins fine-tune exact numbers afterward via the admin panel.

ALTER TABLE public.products
  ADD COLUMN display_order INTEGER NOT NULL DEFAULT 0 CHECK (display_order >= 0);

WITH ordered AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY category_id ORDER BY created_at ASC) AS rn
  FROM public.products
)
UPDATE public.products
SET display_order = ordered.rn
FROM ordered
WHERE public.products.id = ordered.id;

CREATE INDEX idx_products_category_display_order ON public.products (category_id, display_order);
CREATE INDEX idx_products_display_order ON public.products (display_order);
```

- [ ] **Step 2: Update the hand-maintained Supabase types**

In `src/types/supabase.ts`, find the `products: { Row: { ... } }` block (starts line 218). Add `display_order: number;` after `meta_description: string | null;` (line 241) and before `created_at: string;` (line 242):

```typescript
          meta_description: string | null;
          display_order: number;
          created_at: string;
          updated_at: string;
```

If this same file has separate `Insert`/`Update` type variants for `products` below the `Row` block (check the ~40 lines following line 243), add `display_order?: number;` to both, following whatever optional/required pattern the file already uses for columns with a DB default (e.g. how it already handles `is_active` or `stock_quantity`, which also have defaults).

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/011_product_display_order.sql src/types/supabase.ts
git commit -m "feat: add products.display_order column with insertion-order backfill"
```

(Not applied to the live database as part of this plan — that happens after all tasks pass, in the "Manual deployment step" section at the end, same process as every prior migration in this project.)

---

### Task 2: Validation schema

**Files:**
- Modify: `src/lib/validation/product.ts`
- Test: `src/lib/validation/product.test.ts` (new file)

**Interfaces:**
- Consumes: nothing new.
- Produces: `productSchema` and `productUpdateSchema` both gain `display_order`. Types `ProductInput`/`ProductUpdateInput` gain the field. Consumed by Task 4 (service) and the existing API routes (Task 3's plan doesn't touch the routes directly — they already flow through this schema).

- [ ] **Step 1: Write the failing test**

```typescript
// src/lib/validation/product.test.ts
import { productSchema, productUpdateSchema } from "@/lib/validation/product";

const validProduct = {
  name: "Charizard",
  slug: "charizard",
  price: 100,
  stock_quantity: 5,
  is_active: true,
  is_featured: false,
  is_new: true,
};

describe("productSchema display_order", () => {
  it("defaults to 0 when omitted", () => {
    const result = productSchema.parse(validProduct);
    expect(result.display_order).toBe(0);
  });

  it("accepts a positive integer", () => {
    const result = productSchema.parse({ ...validProduct, display_order: 5 });
    expect(result.display_order).toBe(5);
  });

  it("rejects a negative value", () => {
    const result = productSchema.safeParse({ ...validProduct, display_order: -1 });
    expect(result.success).toBe(false);
  });

  it("rejects a non-integer value", () => {
    const result = productSchema.safeParse({ ...validProduct, display_order: 1.5 });
    expect(result.success).toBe(false);
  });

  it("productUpdateSchema accepts a partial patch with only display_order", () => {
    const result = productUpdateSchema.safeParse({ display_order: 3 });
    expect(result.success).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/lib/validation/product.test.ts`
Expected: FAIL — `display_order` is `undefined`, not `0` (schema doesn't have the field yet).

- [ ] **Step 3: Add the field**

In `src/lib/validation/product.ts`, add to `productSchema`'s object (after `stock_quantity`, matching the DB column order for readability — exact position doesn't matter functionally):

```typescript
  display_order: z.coerce.number().int().min(0).default(0),
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/lib/validation/product.test.ts`
Expected: PASS, all 5 tests green.

- [ ] **Step 5: Commit**

```bash
git add src/lib/validation/product.ts src/lib/validation/product.test.ts
git commit -m "feat: add display_order to product validation schema"
```

---

### Task 3: Repository — write payload + read helpers

**Files:**
- Modify: `src/lib/repositories/product-repository.ts`
- Test: `src/lib/repositories/product-repository.test.ts` (new file)

**Interfaces:**
- Consumes: `process.env.SUPABASE_SERVICE_ROLE_KEY`, `process.env.NEXT_PUBLIC_SUPABASE_URL` (same pattern this file already uses).
- Produces: `ProductWritePayload` gains `display_order: number`. New exports `getMaxDisplayOrder(categoryId: string | null): Promise<number>`, `findDisplayOrderConflict(categoryId: string | null, displayOrder: number, excludeId?: string): Promise<boolean>`, `reorderProducts(ids: string[]): Promise<void>` — consumed by Task 4 (service).

- [ ] **Step 1: Write the failing test**

```typescript
// src/lib/repositories/product-repository.test.ts
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

describe("product-repository display_order helpers", () => {
  it("getMaxDisplayOrder returns 0 when the category has no products", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({ ok: true, json: async () => [] });
    const { getMaxDisplayOrder } = await import("@/lib/repositories/product-repository");

    const result = await getMaxDisplayOrder("cat-1");

    expect(result).toBe(0);
    const [url] = (global.fetch as jest.Mock).mock.calls[0];
    expect(url).toContain("category_id=eq.cat-1");
    expect(url).toContain("order=display_order.desc");
  });

  it("getMaxDisplayOrder returns the highest existing value", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => [{ display_order: 7 }],
    });
    const { getMaxDisplayOrder } = await import("@/lib/repositories/product-repository");

    const result = await getMaxDisplayOrder("cat-1");

    expect(result).toBe(7);
  });

  it("getMaxDisplayOrder filters on category_id=is.null when category is null", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({ ok: true, json: async () => [] });
    const { getMaxDisplayOrder } = await import("@/lib/repositories/product-repository");

    await getMaxDisplayOrder(null);

    const [url] = (global.fetch as jest.Mock).mock.calls[0];
    expect(url).toContain("category_id=is.null");
  });

  it("findDisplayOrderConflict returns true when another product shares the order in-category", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => [{ id: "other-product" }],
    });
    const { findDisplayOrderConflict } = await import("@/lib/repositories/product-repository");

    const result = await findDisplayOrderConflict("cat-1", 3);

    expect(result).toBe(true);
    const [url] = (global.fetch as jest.Mock).mock.calls[0];
    expect(url).toContain("category_id=eq.cat-1");
    expect(url).toContain("display_order=eq.3");
  });

  it("findDisplayOrderConflict excludes the product being edited", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({ ok: true, json: async () => [] });
    const { findDisplayOrderConflict } = await import("@/lib/repositories/product-repository");

    await findDisplayOrderConflict("cat-1", 3, "self-id");

    const [url] = (global.fetch as jest.Mock).mock.calls[0];
    expect(url).toContain("id=neq.self-id");
  });

  it("findDisplayOrderConflict returns false when nothing else shares the order", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({ ok: true, json: async () => [] });
    const { findDisplayOrderConflict } = await import("@/lib/repositories/product-repository");

    const result = await findDisplayOrderConflict("cat-1", 3);

    expect(result).toBe(false);
  });

  it("reorderProducts PATCHes each id with its new display_order", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({ ok: true, json: async () => [{}] });
    const { reorderProducts } = await import("@/lib/repositories/product-repository");

    await reorderProducts(["p1", "p2"]);

    expect(global.fetch).toHaveBeenCalledTimes(2);
    const secondCallBody = JSON.parse((global.fetch as jest.Mock).mock.calls[1][1].body);
    expect(secondCallBody).toEqual({ display_order: 1 });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/lib/repositories/product-repository.test.ts`
Expected: FAIL — `getMaxDisplayOrder` etc. are not exported yet.

- [ ] **Step 3: Add the field and helpers**

In `src/lib/repositories/product-repository.ts`, add `display_order: number;` to the `ProductWritePayload` interface (after `stock_quantity: number;`):

```typescript
export interface ProductWritePayload {
  name: string;
  slug: string;
  description: string | null;
  price: number;
  compare_price: number | null;
  images: string[];
  tags: string[];
  category_id: string | null;
  series: string | null;
  saga: string | null;
  collection: string | null;
  stock_quantity: number;
  display_order: number;
  sku: string | null;
  is_active: boolean;
  is_featured: boolean;
  is_new: boolean;
  meta_title: string | null;
  meta_description: string | null;
}
```

Append these functions to the end of the file:

```typescript
function categoryFilter(categoryId: string | null): string {
  return categoryId ? `category_id=eq.${encodeURIComponent(categoryId)}` : "category_id=is.null";
}

/** Highest display_order currently used in a category (0 if empty) — used to suggest the next value. */
export async function getMaxDisplayOrder(categoryId: string | null): Promise<number> {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/products?${categoryFilter(categoryId)}&select=display_order&order=display_order.desc&limit=1`,
    { headers: HEADERS, cache: "no-store" }
  );
  if (!res.ok) return 0;
  const rows = await res.json();
  return rows?.[0]?.display_order ?? 0;
}

/** True if another active product in the same category already uses this display_order. */
export async function findDisplayOrderConflict(
  categoryId: string | null,
  displayOrder: number,
  excludeId?: string
): Promise<boolean> {
  const params = new URLSearchParams();
  params.set("select", "id");
  params.set("display_order", `eq.${displayOrder}`);
  if (excludeId) params.set("id", `neq.${excludeId}`);
  const url = `${SUPABASE_URL}/rest/v1/products?${categoryFilter(categoryId)}&${params.toString()}`;
  const res = await fetch(url, { headers: HEADERS, cache: "no-store" });
  if (!res.ok) return false;
  const rows = await res.json();
  return rows.length > 0;
}

/** Rewrites display_order to match the given id order (0..n-1). */
export async function reorderProducts(ids: string[]): Promise<void> {
  for (let i = 0; i < ids.length; i++) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/products?id=eq.${encodeURIComponent(ids[i])}`, {
      method: "PATCH",
      headers: HEADERS,
      body: JSON.stringify({ display_order: i }),
    });
    if (!res.ok) throw new Error(`Failed to reorder product ${ids[i]}: ${res.status}`);
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/lib/repositories/product-repository.test.ts`
Expected: PASS, all 7 tests green.

- [ ] **Step 5: Commit**

```bash
git add src/lib/repositories/product-repository.ts src/lib/repositories/product-repository.test.ts
git commit -m "feat: add display_order to product repository write payload and read helpers"
```

---

### Task 4: Service — conflict warning, auto-suggest, reorder, shared sort helper

**Files:**
- Modify: `src/lib/services/product-service.ts`
- Test: `src/lib/services/product-service.test.ts` (extend existing file)

**Interfaces:**
- Consumes: everything from Task 3 (`getMaxDisplayOrder`, `findDisplayOrderConflict`, `reorderProducts`, updated `ProductWritePayload`).
- Produces: `createProduct(payload)` and `editProduct(id, payload)` now return `{ id: string; warning?: string }` / `{ warning?: string }` respectively (was `{ id: string }` / `void`). New exports: `suggestDisplayOrder(categoryId: string | null): Promise<number>`, `reorderProducts(ids: string[]): Promise<void>` (re-exported passthrough), `applyProductSort<T>(query: T, sort: string | null): T` — a Supabase-query-builder-chaining helper consumed by Task 5 (storefront pages) and Task 6 (API route).

**Note on the existing test file:** the current `createProduct` test asserts `expect(mockInsertProduct).toHaveBeenCalledWith(payload)` — the conflict check added below is read-only (doesn't mutate `payload` before calling `insertProduct`), so that assertion still holds. Read the existing file at `src/lib/services/product-service.test.ts` before editing so your new tests sit alongside it correctly.

- [ ] **Step 1: Write the failing tests**

Add to `src/lib/services/product-service.test.ts` (extend the existing `jest.mock` for `@/lib/repositories/product-repository` to include the new functions, and add new test blocks):

```typescript
// Replace the existing jest.mock block at the top of the file with:
const mockInsertProduct = jest.fn();
const mockUpdateProduct = jest.fn();
const mockGetMaxDisplayOrder = jest.fn();
const mockFindDisplayOrderConflict = jest.fn();
const mockReorderProducts = jest.fn();
jest.mock("@/lib/repositories/product-repository", () => ({
  insertProduct: (...args: unknown[]) => mockInsertProduct(...args),
  updateProduct: (...args: unknown[]) => mockUpdateProduct(...args),
  getMaxDisplayOrder: (...args: unknown[]) => mockGetMaxDisplayOrder(...args),
  findDisplayOrderConflict: (...args: unknown[]) => mockFindDisplayOrderConflict(...args),
  reorderProducts: (...args: unknown[]) => mockReorderProducts(...args),
}));

// Add these tests after the existing ones (they use the same `payload` const already in the file,
// extended with display_order — add `display_order: 1,` to the existing `payload` object literal too):

describe("createProduct display_order handling", () => {
  it("returns no warning when the display_order is free in the category", async () => {
    mockFindDisplayOrderConflict.mockResolvedValue(false);
    mockInsertProduct.mockResolvedValue({ id: "p1" });

    const result = await createProduct({ ...payload, category_id: "cat-1", display_order: 1 });

    expect(mockFindDisplayOrderConflict).toHaveBeenCalledWith("cat-1", 1, undefined);
    expect(result).toEqual({ id: "p1" });
  });

  it("returns a warning when the display_order conflicts within the category", async () => {
    mockFindDisplayOrderConflict.mockResolvedValue(true);
    mockInsertProduct.mockResolvedValue({ id: "p1" });

    const result = await createProduct({ ...payload, category_id: "cat-1", display_order: 1 });

    expect(result.warning).toMatch(/already used/i);
  });
});

describe("editProduct display_order handling", () => {
  it("checks for conflicts excluding the product's own id when display_order is in the patch", async () => {
    mockFindDisplayOrderConflict.mockResolvedValue(false);

    await editProduct("p1", { display_order: 2, category_id: "cat-1" });

    expect(mockFindDisplayOrderConflict).toHaveBeenCalledWith("cat-1", 2, "p1");
  });

  it("skips the conflict check when display_order isn't in the patch", async () => {
    await editProduct("p1", { price: 150 });

    expect(mockFindDisplayOrderConflict).not.toHaveBeenCalled();
  });
});

describe("suggestDisplayOrder", () => {
  it("returns max + 1 for the category", async () => {
    mockGetMaxDisplayOrder.mockResolvedValue(5);

    const result = await suggestDisplayOrder("cat-1");

    expect(result).toBe(6);
    expect(mockGetMaxDisplayOrder).toHaveBeenCalledWith("cat-1");
  });
});

describe("applyProductSort", () => {
  function makeQuery() {
    const calls: Array<[string, unknown]> = [];
    const query = {
      order: (col: string, opts: unknown) => {
        calls.push([col, opts]);
        return query;
      },
      eq: () => query,
      _calls: calls,
    };
    return query;
  }

  it("defaults to display_order asc, created_at asc when sort is null", () => {
    const query = makeQuery();
    applyProductSort(query, null);
    expect(query._calls).toEqual([
      ["display_order", { ascending: true }],
      ["created_at", { ascending: true }],
    ]);
  });

  it("defaults to display_order asc, created_at asc for an unrecognized sort value", () => {
    const query = makeQuery();
    applyProductSort(query, "not-a-real-sort");
    expect(query._calls).toEqual([
      ["display_order", { ascending: true }],
      ["created_at", { ascending: true }],
    ]);
  });

  it("sorts newest first for 'newest'", () => {
    const query = makeQuery();
    applyProductSort(query, "newest");
    expect(query._calls).toEqual([["created_at", { ascending: false }]]);
  });

  it("sorts oldest first for 'oldest'", () => {
    const query = makeQuery();
    applyProductSort(query, "oldest");
    expect(query._calls).toEqual([["created_at", { ascending: true }]]);
  });

  it("sorts price ascending for 'price_asc'", () => {
    const query = makeQuery();
    applyProductSort(query, "price_asc");
    expect(query._calls).toEqual([["price", { ascending: true }]]);
  });

  it("sorts price descending for 'price_desc'", () => {
    const query = makeQuery();
    applyProductSort(query, "price_desc");
    expect(query._calls).toEqual([["price", { ascending: false }]]);
  });

  it("sorts name ascending for 'name_asc'", () => {
    const query = makeQuery();
    applyProductSort(query, "name_asc");
    expect(query._calls).toEqual([["name", { ascending: true }]]);
  });

  it("sorts name descending for 'name_desc'", () => {
    const query = makeQuery();
    applyProductSort(query, "name_desc");
    expect(query._calls).toEqual([["name", { ascending: false }]]);
  });

  it("sorts featured first, then display_order for 'featured'", () => {
    const query = makeQuery();
    applyProductSort(query, "featured");
    expect(query._calls).toEqual([
      ["is_featured", { ascending: false }],
      ["display_order", { ascending: true }],
    ]);
  });

  it("explicit 'display_order' behaves the same as the default", () => {
    const query = makeQuery();
    applyProductSort(query, "display_order");
    expect(query._calls).toEqual([
      ["display_order", { ascending: true }],
      ["created_at", { ascending: true }],
    ]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/lib/services/product-service.test.ts`
Expected: FAIL — `suggestDisplayOrder`/`applyProductSort` not exported, `createProduct`/`editProduct` don't return `warning`.

- [ ] **Step 3: Implement**

Replace the full contents of `src/lib/services/product-service.ts`:

```typescript
import {
  insertProduct,
  updateProduct,
  getMaxDisplayOrder,
  findDisplayOrderConflict,
  reorderProducts as repoReorderProducts,
  type ProductWritePayload,
} from "@/lib/repositories/product-repository";

export interface CreateProductResult {
  id: string;
  warning?: string;
}

export interface EditProductResult {
  warning?: string;
}

export async function createProduct(payload: ProductWritePayload): Promise<CreateProductResult> {
  const conflict = await findDisplayOrderConflict(payload.category_id, payload.display_order);
  const created = await insertProduct(payload);
  return conflict
    ? { ...created, warning: `Display order ${payload.display_order} is already used by another product in this category.` }
    : created;
}

export async function editProduct(
  id: string,
  payload: Partial<ProductWritePayload>
): Promise<EditProductResult> {
  let warning: string | undefined;
  if (payload.display_order !== undefined) {
    const conflict = await findDisplayOrderConflict(payload.category_id ?? null, payload.display_order, id);
    if (conflict) {
      warning = `Display order ${payload.display_order} is already used by another product in this category.`;
    }
  }
  await updateProduct(id, payload);
  return { warning };
}

export async function setProductActive(id: string, isActive: boolean): Promise<void> {
  await updateProduct(id, { is_active: isActive });
}

/** Suggests the next free display_order for a category (max + 1, or 1 if empty). */
export async function suggestDisplayOrder(categoryId: string | null): Promise<number> {
  return (await getMaxDisplayOrder(categoryId)) + 1;
}

export async function reorderProducts(ids: string[]): Promise<void> {
  return repoReorderProducts(ids);
}

/**
 * Applies the canonical product sort to a Supabase query builder, chaining .order() calls
 * (PostgREST/supabase-js treats successive .order() calls as multi-column ORDER BY).
 * Default (null or unrecognized sort) is display_order ASC, created_at ASC — the single
 * source of truth for "no customer selection" behavior across every storefront surface.
 */
export function applyProductSort<T extends { order: (col: string, opts: { ascending: boolean }) => T }>(
  query: T,
  sort: string | null
): T {
  switch (sort) {
    case "newest":
      return query.order("created_at", { ascending: false });
    case "oldest":
      return query.order("created_at", { ascending: true });
    case "price_asc":
      return query.order("price", { ascending: true });
    case "price_desc":
      return query.order("price", { ascending: false });
    case "name_asc":
      return query.order("name", { ascending: true });
    case "name_desc":
      return query.order("name", { ascending: false });
    case "featured":
      return query.order("is_featured", { ascending: false }).order("display_order", { ascending: true });
    case "display_order":
    default:
      return query.order("display_order", { ascending: true }).order("created_at", { ascending: true });
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/lib/services/product-service.test.ts`
Expected: PASS, all tests green (existing 3 + new ones).

- [ ] **Step 5: Commit**

```bash
git add src/lib/services/product-service.ts src/lib/services/product-service.test.ts
git commit -m "feat: add display_order conflict warning, auto-suggest, reorder, and shared sort helper to product service"
```

---

### Task 5: Storefront query fixes (the actual bug fix)

**Files:**
- Modify: `src/app/(shop)/catalog/page.tsx`
- Modify: `src/app/(shop)/catalog/[slug]/page.tsx`
- Modify: `src/app/(shop)/search/page.tsx`
- Modify: `src/app/(shop)/page.tsx`
- Modify: `src/app/admin/products/page.tsx`

**Interfaces:**
- Consumes: `applyProductSort` from Task 4 (`@/lib/services/product-service`).
- Produces: nothing new — this is the fix itself, no later task depends on it.

- [ ] **Step 1: Fix `catalog/page.tsx`**

Read the current file first (shown in full in the audit above — it's short). Add the import and read the `sort` search param, applying it via the shared helper instead of the hardcoded `.order("created_at", { ascending: false })`:

```typescript
import type { Metadata } from "next";
import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { applyProductSort } from "@/lib/services/product-service";
import CatalogClient from "./catalog-client";
import type { CategoryWithChildren } from "@/types";

export const metadata: Metadata = {
  title: "Catalog — Browse All Collections",
  description:
    "Browse our complete catalog of Pokémon, Dragon Ball Z, Naruto, One Piece, and anime collectible cards.",
};

const PAGE_SIZE = 24;

export default async function CatalogPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | undefined }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();
  const page = Math.max(1, parseInt(params.page ?? "1", 10));
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const [{ data: categories }, { data: products, count }] = await Promise.all([
    supabase
      .from("categories")
      .select("*, children:categories!parent_id(*)")
      .is("parent_id", null)
      .eq("is_active", true)
      .order("display_order"),
    applyProductSort(
      supabase
        .from("products")
        .select("*, category:categories(*)", { count: "exact" })
        .eq("is_active", true),
      params.sort ?? null
    ).range(from, to),
  ]);

  return (
    <Suspense fallback={<div className="min-h-screen" />}>
      <CatalogClient
        initialProducts={products ?? []}
        totalCount={count ?? 0}
        currentPage={page}
        pageSize={PAGE_SIZE}
        categories={(categories ?? []) as CategoryWithChildren[]}
        searchParams={params}
      />
    </Suspense>
  );
}
```

- [ ] **Step 2: Fix `catalog/[slug]/page.tsx`**

Read the current file first. Find the products query at line 60 (`.order("created_at", { ascending: false })`) and the categories query at line 54 (already correctly using `.order("display_order")` — leave it). Apply the same fix as Step 1: import `applyProductSort`, read `params.sort`, replace the hardcoded `.order("created_at", { ascending: false })` on the products query with `applyProductSort(<query>, params.sort ?? null)`. The exact surrounding structure (category lookup by slug, `Promise.all`, pagination) stays as-is — only the products query's ordering changes, following the identical pattern from Step 1.

- [ ] **Step 3: Fix `search/page.tsx`**

Read the current file first (shown in full in the audit — no `.order()` call exists at all today). Add the import and apply the default sort (search doesn't currently expose a sort UI, so pass `null` for "always default"):

```typescript
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { applyProductSort } from "@/lib/services/product-service";
import ProductCard from "@/components/product/product-card";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Search",
  description: "Search for Pokémon, Dragon Ball Z, Naruto cards and more",
};

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const supabase = await createClient();

  const { data: products } = q
    ? await applyProductSort(
        supabase
          .from("products")
          .select("*")
          .eq("is_active", true)
          .or(`name.ilike.%${q}%,description.ilike.%${q}%,tags.cs.{${q}}`),
        null
      ).limit(24)
    : { data: [] };

  return (
    <div className="min-h-screen bg-background">
      <div className="container-max px-4 md:px-8 py-12">
        <h1 className="text-3xl font-bold text-foreground mb-2">
          {q ? `Search: "${q}"` : "Search"}
        </h1>
        {q && (
          <p className="text-muted-foreground mb-8">
            {products?.length ?? 0} results found
          </p>
        )}

        {!q ? (
          <div className="text-center py-16 text-muted-foreground">
            <p>Enter a search term above to find products.</p>
            <Link href="/catalog" className="btn-primary mt-4 inline-block text-sm">
              Browse All Products
            </Link>
          </div>
        ) : products && products.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
            {products.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        ) : (
          <div className="text-center py-16 text-muted-foreground">
            <p>No products found for &ldquo;{q}&rdquo;</p>
            <Link href="/catalog" className="btn-primary mt-4 inline-block text-sm">
              Browse All Products
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Fix the homepage featured section in `(shop)/page.tsx`**

Read the current file first. Find the `featured` query (`.eq("is_featured", true).eq("is_active", true).order("created_at", { ascending: false }).limit(8)`, around line 34 of the file as it stood before the banner-management Task 11 addition — re-check exact current line numbers since that task also modified this file). Import `applyProductSort` (add to the existing service imports alongside `getHomepageBanners`/`getHomepageNotifications`) and replace `.order("created_at", { ascending: false })` on the featured-products query with `applyProductSort(<query>, "featured")` (using the `"featured"` sort mode added in Task 4, which sorts featured-flag first then `display_order`). Do not touch the `latest` products query (`order("created_at", { ascending: false })` there is semantically correct for "latest releases" — leave it as `.order("created_at", { ascending: false })`, it is intentionally not display-order-based). Do not touch any banner-related code in this file.

- [ ] **Step 5: Fix admin products list default order**

In `src/app/admin/products/page.tsx`, replace `.order("created_at", { ascending: false })` (line 13) with `.order("display_order", { ascending: true }).order("created_at", { ascending: true })` — matches the storefront default so admins see the same order customers do.

- [ ] **Step 6: Verify with the full suite**

Run: `npx jest`
Expected: all existing tests still pass (these are Server Components with no dedicated test files today — the full-suite run is the safety net, confirming nothing else broke).

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 7: Commit**

```bash
git add "src/app/(shop)/catalog/page.tsx" "src/app/(shop)/catalog/[slug]/page.tsx" "src/app/(shop)/search/page.tsx" "src/app/(shop)/page.tsx" src/app/admin/products/page.tsx
git commit -m "fix: default every product listing to display_order ASC instead of created_at DESC"
```

---

### Task 6: `/api/products` route — shared sort helper + full option set

**Files:**
- Modify: `src/app/api/products/route.ts`
- Test: `src/app/api/products/route.test.ts` (new file — none exists today for this route)

**Interfaces:**
- Consumes: `applyProductSort` from Task 4.
- Produces: nothing new — public product-listing API, no other task depends on it.

- [ ] **Step 1: Write the failing test**

```typescript
// src/app/api/products/route.test.ts
/**
 * @jest-environment node
 */
const mockOrder = jest.fn();
const mockRange = jest.fn();
const mockEq = jest.fn();
const mockIlike = jest.fn();
const mockSelect = jest.fn();
const mockFrom = jest.fn();

function makeChainable() {
  const chain: Record<string, jest.Mock> = {
    select: mockSelect,
    eq: mockEq,
    ilike: mockIlike,
    order: mockOrder,
    range: mockRange,
  };
  Object.values(chain).forEach((fn) => fn.mockReturnValue(chain));
  mockRange.mockResolvedValue({ data: [], count: 0, error: null });
  return chain;
}

jest.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ from: (...args: unknown[]) => { mockFrom(...args); return makeChainable(); } }),
}));

import { NextRequest } from "next/server";
import { GET } from "@/app/api/products/route";

afterEach(() => jest.clearAllMocks());

function req(query: string) {
  return new NextRequest(`http://localhost/api/products${query}`);
}

describe("GET /api/products sort handling", () => {
  it("defaults to display_order asc, created_at asc when no sort param is given", async () => {
    await GET(req(""));
    expect(mockOrder).toHaveBeenCalledWith("display_order", { ascending: true });
    expect(mockOrder).toHaveBeenCalledWith("created_at", { ascending: true });
  });

  it("sorts by display_order explicitly", async () => {
    await GET(req("?sort=display_order"));
    expect(mockOrder).toHaveBeenCalledWith("display_order", { ascending: true });
  });

  it("sorts featured first via the featured sort mode", async () => {
    await GET(req("?sort=featured"));
    expect(mockOrder).toHaveBeenCalledWith("is_featured", { ascending: false });
    expect(mockOrder).toHaveBeenCalledWith("display_order", { ascending: true });
  });

  it("sorts oldest first", async () => {
    await GET(req("?sort=oldest"));
    expect(mockOrder).toHaveBeenCalledWith("created_at", { ascending: true });
  });

  it("sorts name descending (Z-A)", async () => {
    await GET(req("?sort=name_desc"));
    expect(mockOrder).toHaveBeenCalledWith("name", { ascending: false });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/app/api/products/route.test.ts`
Expected: FAIL — `sort=display_order` currently falls into the `default:` branch which orders by `created_at desc` only, not `display_order`; `featured`/`oldest`/`name_desc` aren't recognized at all yet.

- [ ] **Step 3: Implement**

Replace `src/app/api/products/route.ts`'s sort handling:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { applyProductSort } from "@/lib/services/product-service";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { searchParams } = new URL(request.url);

  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "24");
  const category = searchParams.get("category");
  const featured = searchParams.get("featured");
  const search = searchParams.get("search");
  const sort = searchParams.get("sort");
  const offset = (page - 1) * limit;

  let query = supabase
    .from("products")
    .select("*, category:categories(id, name, slug)", { count: "exact" })
    .eq("is_active", true);

  if (category) query = query.eq("category_id", category);
  if (featured === "true") query = query.eq("is_featured", true);
  if (search) query = query.ilike("name", `%${search}%`);

  query = applyProductSort(query, sort);

  const { data, count, error } = await query.range(offset, offset + limit - 1);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data, total: count, page, limit });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/app/api/products/route.test.ts`
Expected: PASS, all 5 tests green.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/products/route.ts src/app/api/products/route.test.ts
git commit -m "feat: default /api/products to display_order ASC and add full sort option set"
```

---

### Task 7: Admin reorder API route

**Files:**
- Create: `src/app/api/admin/products/reorder/route.ts`
- Test: `src/app/api/admin/products/reorder/route.test.ts`

**Interfaces:**
- Consumes: `reorderProducts` from Task 4 (`@/lib/services/product-service`).
- Produces: `POST` handler at `/api/admin/products/reorder`, consumed by Task 9 (admin products table drag-and-drop).

- [ ] **Step 1: Write the failing test**

```typescript
// src/app/api/admin/products/reorder/route.test.ts
/**
 * @jest-environment node
 */
const mockRequireAdmin = jest.fn();
jest.mock("@/lib/supabase/admin-auth", () => ({
  requireAdmin: () => mockRequireAdmin(),
}));

const mockReorderProducts = jest.fn();
jest.mock("@/lib/services/product-service", () => ({
  reorderProducts: (...args: unknown[]) => mockReorderProducts(...args),
}));

import { NextRequest, NextResponse } from "next/server";
import { POST } from "@/app/api/admin/products/reorder/route";

afterEach(() => jest.clearAllMocks());

function req(body: unknown) {
  return new NextRequest("http://localhost/api/admin/products/reorder", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

describe("POST /api/admin/products/reorder", () => {
  it("passes through requireAdmin's rejection", async () => {
    mockRequireAdmin.mockResolvedValue({
      ok: false,
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    });
    const response = await POST(req({ ids: ["p1", "p2"] }));
    expect(response.status).toBe(403);
    expect(mockReorderProducts).not.toHaveBeenCalled();
  });

  it("400 on an empty ids array", async () => {
    mockRequireAdmin.mockResolvedValue({ ok: true, userId: "admin-1" });
    const response = await POST(req({ ids: [] }));
    expect(response.status).toBe(400);
    expect(mockReorderProducts).not.toHaveBeenCalled();
  });

  it("400 when ids is missing", async () => {
    mockRequireAdmin.mockResolvedValue({ ok: true, userId: "admin-1" });
    const response = await POST(req({}));
    expect(response.status).toBe(400);
  });

  it("reorders and returns success", async () => {
    mockRequireAdmin.mockResolvedValue({ ok: true, userId: "admin-1" });
    mockReorderProducts.mockResolvedValue(undefined);
    const response = await POST(req({ ids: ["p1", "p2"] }));
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(mockReorderProducts).toHaveBeenCalledWith(["p1", "p2"]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/app/api/admin/products/reorder/route.test.ts`
Expected: FAIL — module doesn't exist.

- [ ] **Step 3: Implement**

This route matches the existing `/api/admin/products` subsystem's actual convention (`requireAdmin` only — no rate limit, no audit log, per this plan's Global Constraints), not the banners subsystem's fuller convention.

```typescript
// src/app/api/admin/products/reorder/route.ts
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/supabase/admin-auth";
import { reorderProducts } from "@/lib/services/product-service";

export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const json = await req.json().catch(() => null);
  const ids = json?.ids;
  if (!Array.isArray(ids) || ids.length === 0 || !ids.every((id) => typeof id === "string")) {
    return NextResponse.json({ error: "ids must be a non-empty array of strings" }, { status: 400 });
  }

  try {
    await reorderProducts(ids);
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Failed to reorder products" }, { status: 500 });
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/app/api/admin/products/reorder/route.test.ts`
Expected: PASS, all 4 tests green.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/admin/products/reorder/route.ts src/app/api/admin/products/reorder/route.test.ts
git commit -m "feat: add POST /api/admin/products/reorder"
```

---

### Task 8: Admin product form — Display Order field, auto-suggest, conflict warning

**Files:**
- Modify: `src/components/admin/product-form.tsx`
- Modify: `src/app/admin/products/new/page.tsx`
- Modify: `src/app/admin/products/[id]/edit/page.tsx`

**Interfaces:**
- Consumes: `suggestDisplayOrder` from Task 4 (called server-side in the two page files, not the form itself).
- Produces: nothing new — terminal UI task alongside Task 9.

- [ ] **Step 1: Add `display_order` to `product-form.tsx`'s local schema and default values**

Read the current file first (shown in full in the audit above). In the local `productSchema` (line 13-30 of the file as it stands), add after `stock_quantity`:

```typescript
  display_order: z.coerce.number().int().min(0).default(0),
```

In `ProductFormProps`, add a new prop:

```typescript
interface ProductFormProps {
  categories: Category[];
  initialData?: Partial<ProductFormData> & { id?: string; images?: string[] };
  suggestedDisplayOrder?: number;
}
```

Update the component signature and `defaultValues` (in the `useForm` call, after `stock_quantity: initialData?.stock_quantity ?? 0,`):

```typescript
export default function ProductForm({ categories, initialData, suggestedDisplayOrder }: ProductFormProps) {
  // ...unchanged...
  const form = useForm<ProductFormData>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      // ...unchanged existing fields...
      display_order: initialData?.display_order ?? suggestedDisplayOrder ?? 0,
      // ...rest unchanged...
    },
  });
```

- [ ] **Step 2: Add `display_order` to the submit payload**

In `onSubmit`, add to the `payload` object (after `stock_quantity: data.stock_quantity,`):

```typescript
      display_order: data.display_order,
```

- [ ] **Step 3: Surface the conflict warning from the API response**

The API routes (`/api/admin/products` POST, `/api/admin/products/[id]` PATCH) now return `{ id, warning? }` / `{ success: true }` — wait, check: `editProduct`'s return type is `EditProductResult` (`{ warning?: string }`), but the existing `[id]/route.ts` PATCH handler currently does `await editProduct(id, parsed.data); return NextResponse.json({ success: true });` — it discards the result. Update `src/app/api/admin/products/[id]/route.ts` to relay the warning:

```typescript
  try {
    const result = await editProduct(id, parsed.data);
    return NextResponse.json({ success: true, warning: result.warning ?? null });
  } catch {
    return NextResponse.json({ error: "Failed to update product" }, { status: 500 });
  }
```

Also update `src/app/api/admin/products/route.ts`'s POST handler to relay the warning from `createProduct` (which already returns `{ id, warning? }`):

```typescript
  try {
    const product = await createProduct(parsed.data);
    return NextResponse.json(product, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Failed to create product" }, { status: 500 });
  }
```

(No change needed here — `product` already includes `warning` if present, since `createProduct` returns the full `CreateProductResult`. This step just confirms it — no code change to this file.)

Back in `product-form.tsx`'s `onSubmit`, after the `if (!res.ok) { ... }` check, read the response body and show a non-blocking warning toast if present:

```typescript
    const body = await res.json().catch(() => ({}));
    if (body.warning) {
      toast.warning(body.warning);
    }
    toast.success(initialData?.id ? "Product updated" : "Product created");
    router.push("/admin/products");
    router.refresh();
```

- [ ] **Step 4: Add the Display Order field to the form UI**

In the "Pricing & Inventory" card (the `<div className="bg-card border border-border rounded-2xl p-5">` containing the Price/Stock grid, shown in the audit above starting around line 188), add a new field inside the same `grid grid-cols-2 gap-4` div, after the stock quantity field:

```tsx
              <div>
                <label className="block text-sm font-medium mb-1.5">Display Order</label>
                <input
                  {...form.register("display_order")}
                  type="number"
                  min="0"
                  className="w-full px-4 py-3 rounded-xl bg-background border border-border focus:border-primary focus:outline-none text-sm"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Lower numbers appear first within this product's category (e.g. Pokédex order).
                </p>
                {form.formState.errors.display_order && (
                  <p className="text-red-500 text-xs mt-1">{form.formState.errors.display_order.message}</p>
                )}
              </div>
```

- [ ] **Step 5: Wire the auto-suggested value from the server pages**

In `src/app/admin/products/new/page.tsx`, read the current file first (shown in full in the audit). Import and call `suggestDisplayOrder`, passing the result to the form. Since no category is selected yet on a brand-new product, suggest against `null` (uncategorized) as the initial default — the admin can still type any value:

```typescript
import { createClient } from "@/lib/supabase/server";
import ProductForm from "@/components/admin/product-form";
import { suggestDisplayOrder } from "@/lib/services/product-service";

export default async function NewProductPage() {
  const supabase = await createClient();
  const [{ data: categories }, suggestedDisplayOrder] = await Promise.all([
    supabase
      .from("categories")
      .select("id, name, parent_id")
      .eq("is_active", true)
      .order("name"),
    suggestDisplayOrder(null),
  ]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-foreground">Add New Product</h1>
      <ProductForm categories={categories ?? []} suggestedDisplayOrder={suggestedDisplayOrder} />
    </div>
  );
}
```

In `src/app/admin/products/[id]/edit/page.tsx`, read the current file first (shown in full in the audit). The edit form doesn't need a suggested value (it already has the product's real `display_order`) — just thread the existing value through `initialData`:

```typescript
      initialData={{
        id: product.id,
        name: product.name,
        slug: product.slug,
        description: product.description ?? "",
        price: product.price,
        compare_price: product.compare_price ?? undefined,
        category_id: product.category_id ?? "",
        series: product.series ?? "",
        saga: product.saga ?? "",
        collection: product.collection ?? "",
        stock_quantity: product.stock_quantity,
        display_order: product.display_order,
        sku: product.sku ?? "",
        is_active: product.is_active,
        is_featured: product.is_featured,
        is_new: product.is_new,
        meta_title: product.meta_title ?? "",
        meta_description: product.meta_description ?? "",
        images: product.images ?? [],
      }}
```

- [ ] **Step 6: Verify**

Run: `npx tsc --noEmit` — confirm clean.
Run: `npx jest` — confirm full suite still passes (no dedicated test file for `product-form.tsx`/page files, matching existing convention — full suite is the safety net).

- [ ] **Step 7: Commit**

```bash
git add src/components/admin/product-form.tsx src/app/admin/products/new/page.tsx "src/app/admin/products/[id]/edit/page.tsx" "src/app/api/admin/products/[id]/route.ts"
git commit -m "feat: add Display Order field to admin product form with auto-suggest and conflict warning"
```

---

### Task 9: Admin products table — Display Order column + drag-and-drop reorder

**Files:**
- Modify: `src/app/admin/products/page.tsx`
- Modify: `src/app/admin/products/products-table.tsx`

**Interfaces:**
- Consumes: `/api/admin/products/reorder` from Task 7.
- Produces: nothing new — terminal UI task.

- [ ] **Step 1: Pass `display_order` through from the server page**

In `src/app/admin/products/page.tsx` (already updated for default ordering in Task 5), add `display_order` to the `select` string and to the inline `products` type annotation:

```typescript
  const { data: productsRaw } = await db
    .from("products")
    .select("*, category:categories(name)")
    .order("display_order", { ascending: true })
    .order("created_at", { ascending: true });

  const products = (productsRaw ?? []) as Array<{
    id: string;
    name: string;
    slug: string;
    sku: string | null;
    images: string[];
    price: number;
    compare_price: number | null;
    stock_quantity: number;
    display_order: number;
    is_active: boolean;
    is_featured: boolean;
    is_new: boolean;
    category: { name: string } | null;
  }>;
```

- [ ] **Step 2: Add the column and drag-and-drop to `products-table.tsx`**

This reuses the exact native-HTML5-drag-and-drop pattern already built, tested, and proven in `src/app/admin/marketing/banners/banners-table.tsx` (`draggable`, `onDragStart` with `dataTransfer.setData`, `onDragOver`, `onDrop`, `dragIndex` state) — no new library, no new pattern invented.

Replace the full contents of `src/app/admin/products/products-table.tsx`:

```tsx
"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import { Eye, Edit, EyeOff, Trash2 } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { toast } from "sonner";

interface Product {
  id: string;
  name: string;
  slug: string;
  sku: string | null;
  images: string[];
  price: number;
  compare_price: number | null;
  stock_quantity: number;
  display_order: number;
  is_active: boolean;
  is_featured: boolean;
  is_new: boolean;
  category: { name: string } | null;
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

export default function ProductsTable({ initialProducts }: { initialProducts: Product[] }) {
  const [products, setProducts] = useState(initialProducts);
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  const toggleActive = async (id: string, current: boolean) => {
    const res = await fetch(`/api/admin/products/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_active: !current }),
    });
    if (!res.ok) {
      toast.error("Failed to update status");
      return;
    }
    setProducts((prev) =>
      prev.map((p) => (p.id === id ? { ...p, is_active: !current } : p))
    );
    toast.success(!current ? "Product activated" : "Product hidden");
  };

  const deleteProduct = async (id: string, name: string) => {
    if (!confirm(`Hide "${name}" from the store? It will not be deleted from the database.`)) return;
    await toggleActive(id, true);
  };

  const persistOrder = async (next: Product[]) => {
    setProducts(next);
    try {
      await apiRequest("/api/admin/products/reorder", {
        method: "POST",
        body: JSON.stringify({ ids: next.map((p) => p.id) }),
      });
    } catch {
      toast.error("Failed to save new order");
    }
  };

  const onDrop = (dropIndex: number) => {
    if (dragIndex === null || dragIndex === dropIndex) return;
    const next = [...products];
    const [moved] = next.splice(dragIndex, 1);
    next.splice(dropIndex, 0, moved);
    setDragIndex(null);
    void persistOrder(next);
  };

  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border">
              <th className="p-4 w-8" />
              <th className="text-left p-4 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Product
              </th>
              <th className="text-left p-4 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Category
              </th>
              <th className="text-left p-4 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Order
              </th>
              <th className="text-left p-4 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Price
              </th>
              <th className="text-left p-4 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Stock
              </th>
              <th className="text-left p-4 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Status
              </th>
              <th className="text-right p-4 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {products.map((product, index) => (
              <tr
                key={product.id}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData("text/plain", String(index));
                  setDragIndex(index);
                }}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => onDrop(index)}
                className={`border-b border-border last:border-0 hover:bg-accent/20 transition-colors ${
                  !product.is_active ? "opacity-50" : ""
                }`}
              >
                <td className="p-4 cursor-grab text-muted-foreground">⠿</td>
                <td className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="relative w-10 h-10 rounded-lg overflow-hidden bg-muted flex-shrink-0">
                      {product.images[0] ? (
                        <Image
                          src={product.images[0]}
                          alt={product.name}
                          fill
                          className="object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-lg">
                          🃏
                        </div>
                      )}
                    </div>
                    <div>
                      <p className="font-medium text-sm text-foreground">
                        {product.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {product.sku || "—"}
                      </p>
                    </div>
                  </div>
                </td>
                <td className="p-4 text-sm text-muted-foreground">
                  {product.category?.name || "—"}
                </td>
                <td className="p-4 text-sm text-muted-foreground">{product.display_order}</td>
                <td className="p-4">
                  <p className="font-semibold text-sm">
                    {formatCurrency(product.price)}
                  </p>
                  {product.compare_price && (
                    <p className="text-xs text-muted-foreground line-through">
                      {formatCurrency(product.compare_price)}
                    </p>
                  )}
                </td>
                <td className="p-4">
                  <span
                    className={`text-sm font-medium ${
                      product.stock_quantity > 0
                        ? "text-green-500"
                        : "text-red-500"
                    }`}
                  >
                    {product.stock_quantity}
                  </span>
                </td>
                <td className="p-4">
                  <span
                    className={`text-xs font-semibold px-2 py-1 rounded-full ${
                      product.is_active
                        ? "bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300"
                        : "bg-gray-100 dark:bg-gray-800 text-gray-500"
                    }`}
                  >
                    {product.is_active ? "Active" : "Hidden"}
                  </span>
                </td>
                <td className="p-4">
                  <div className="flex items-center justify-end gap-1">
                    <Link
                      href={`/products/${product.slug}`}
                      target="_blank"
                      className="p-1.5 rounded-lg hover:bg-accent transition-colors text-muted-foreground hover:text-foreground"
                      title="View on site"
                    >
                      <Eye className="w-4 h-4" />
                    </Link>
                    <Link
                      href={`/admin/products/${product.id}/edit`}
                      className="p-1.5 rounded-lg hover:bg-accent transition-colors text-muted-foreground hover:text-foreground"
                      title="Edit"
                    >
                      <Edit className="w-4 h-4" />
                    </Link>
                    <button
                      onClick={() => toggleActive(product.id, product.is_active)}
                      className="p-1.5 rounded-lg hover:bg-accent transition-colors text-muted-foreground hover:text-foreground"
                      title={product.is_active ? "Hide product" : "Show product"}
                    >
                      <EyeOff className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => deleteProduct(product.id, product.name)}
                      className="p-1.5 rounded-lg hover:bg-red-500/10 transition-colors text-muted-foreground hover:text-red-500"
                      title="Remove from store"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {products.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <p>No products yet.</p>
            <Link
              href="/admin/products/new"
              className="text-primary hover:underline text-sm mt-1 block"
            >
              Add your first product
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
```

Note: this drag-and-drop reorders the products **as currently listed** (i.e., across whatever category mix they're in) by rewriting `display_order` sequentially 0..n-1 for the dragged set. Since conflict-checking is per-category and this table shows all products together, dragging across category boundaries will set globally-sequential numbers that no longer match a clean 1,2,3-per-category scheme — this is a known, acceptable limitation (same one the `categories` admin table already has when reordering across parents) and is not a regression this task needs to solve; the numeric field remains the source of truth for precise per-category numbering.

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit` — confirm clean.
Run: `npx jest` — confirm full suite passes (no dedicated test file for this table component, matching the existing convention).

- [ ] **Step 4: Commit**

```bash
git add src/app/admin/products/page.tsx src/app/admin/products/products-table.tsx
git commit -m "feat: add Display Order column and drag-and-drop reorder to admin products table"
```

---

### Task 10: Catalog client — remove JS sort, navigate via SQL sort param

**Files:**
- Modify: `src/app/(shop)/catalog/catalog-client.tsx`

**Interfaces:**
- Consumes: the `?sort=` param now honored server-side by Task 5's `catalog/page.tsx`.
- Produces: nothing new — terminal UI task.

- [ ] **Step 1: Read the full current file**

Read `src/app/(shop)/catalog/catalog-client.tsx` in full before editing — the audit above showed lines 1-70 and the pagination `router.push` pattern at lines 254-317; read the rest (sort dropdown JSX, category filter JSX, pagination controls) so your edit fits the existing structure exactly.

- [ ] **Step 2: Replace the sort options list and remove client-side sorting**

Replace the `sortOptions` array (lines 21-26):

```typescript
const sortOptions = [
  { value: "display_order", label: "Display Order" },
  { value: "featured", label: "Featured" },
  { value: "newest", label: "Newest First" },
  { value: "oldest", label: "Oldest First" },
  { value: "price_asc", label: "Price: Low to High" },
  { value: "price_desc", label: "Price: High to Low" },
  { value: "name_asc", label: "Name A-Z" },
  { value: "name_desc", label: "Name Z-A" },
];
```

Remove the client-side `sorted` computation entirely (lines 53-60, the `const sorted = [...filtered].sort((a, b) => { ... })` block) — the server now returns products pre-sorted via `applyProductSort` (Task 5), so the client only needs to apply the client-side `search`/`selectedCategory` text filter (the existing `filtered` array at lines 47-51) and render `filtered` directly instead of `sorted` wherever the JSX currently maps over `sorted`.

Change the `sort` state initialization from `useState("newest")` to `useState(searchParamsObj.get("sort") ?? "display_order")` so the dropdown reflects the actual URL state (matches how `currentPage`/pagination already derives from `searchParams`, per the file's existing pattern).

- [ ] **Step 3: Make the sort dropdown navigate instead of locally re-sorting**

Find the sort `<select>` or dropdown handler in the JSX (search the file for where `setSort` is currently called — likely an `onChange` on a `<select>`). Replace that handler to navigate via `router.push`, mirroring the exact pattern already used for pagination (`catalog-client.tsx:254-256` and `:315-317`, shown in the audit):

```typescript
  const onSortChange = (value: string) => {
    setSort(value);
    const params = new URLSearchParams(searchParamsObj.toString());
    params.set("sort", value);
    params.delete("page"); // changing sort resets to page 1
    router.push(`${pathname}?${params.toString()}`);
  };
```

Wire this as the `onChange`/`onClick` handler in place of whatever previously called `setSort` directly.

- [ ] **Step 4: Update every JSX reference from `sorted` to `filtered`**

Search the rest of the file for `sorted.map`, `sorted.length`, or any other reference to the removed `sorted` variable, and replace each with `filtered` (the array now already correctly ordered, since it comes pre-sorted from the server and the client only text-filters it).

- [ ] **Step 5: Verify**

Run: `npx tsc --noEmit` — confirm clean (this is the check that catches a missed `sorted` reference, since removing the variable would otherwise be a silent runtime `ReferenceError` in dev).
Run: `npx jest` — confirm full suite passes (no dedicated test file for this client component).

- [ ] **Step 6: Commit**

```bash
git add "src/app/(shop)/catalog/catalog-client.tsx"
git commit -m "fix: sort catalog via SQL through the sort URL param instead of re-sorting the current page in JS"
```

---

### Task 11: Documentation

**Files:**
- Modify: `API.md`
- Modify: `DATABASE.md`
- Modify: `ROADMAP.md`
- Modify: `TASKS.md`
- Modify: `CHANGELOG.md`

**Interfaces:** None — pure documentation.

- [ ] **Step 1: Update DATABASE.md**

Find the `products` table entry (search for "products" in the Tables list, likely near the `banners`/`categories` entries touched in the prior banner-management work). Add `display_order` to the column list, and add a short note under it: `Default catalog sort is display_order ASC, created_at ASC (tie-break) — see API.md for the full sort option list.`

- [ ] **Step 2: Update API.md**

Find the `/api/products` entry. Document the `sort` query param's full value set: `display_order` (default), `featured`, `newest`, `oldest`, `price_asc`, `price_desc`, `name_asc`, `name_desc`. Add a new entry for `POST /api/admin/products/reorder` (`requireAdmin` only — no rate limit/audit log, matching this route's sibling `/api/admin/products` routes) with body `{ ids: string[] }`, response `{ success: true }`.

- [ ] **Step 3: Update ROADMAP.md and TASKS.md**

In `TASKS.md`, add a note (matching the existing style used for the banner migration notes) that `display_order` was added to `products` via migration `011`, backfilled preserving insertion order, and is the canonical catalog sort. In `ROADMAP.md`, note the fix as completed under whatever section currently tracks catalog/storefront work.

- [ ] **Step 4: Update CHANGELOG.md**

Add an entry (check the file's existing format/most recent entry first) describing: fixed catalog/category/search/featured product ordering to default to `display_order ASC` instead of `created_at DESC`; added admin Display Order field with auto-suggest, conflict warning, and drag-and-drop reorder; added full sort option set (Display Order, Featured, Newest, Oldest, Price ↑/↓, A-Z, Z-A) to catalog and `/api/products`.

- [ ] **Step 5: Commit**

```bash
git add API.md DATABASE.md ROADMAP.md TASKS.md CHANGELOG.md
git commit -m "docs: document product display_order, default sort, and full sort option set"
```

---

## Manual deployment step (after all tasks above pass)

1. Run the full suite and type-check: `npx jest && npx tsc --noEmit`. Both must be clean.
2. Apply `supabase/migrations/011_product_display_order.sql` via the Supabase SQL Editor (project `htfmyutgliczyfkalxvr`), per the established manual-migration process.
3. Verify live: `SELECT id, name, category_id, display_order FROM public.products ORDER BY category_id, display_order LIMIT 20;` — confirm every category's products are numbered 1..N with no gaps from the backfill, and that the sequence matches each category's original upload order (spot-check against `created_at`).
4. Manually load `/catalog` and confirm Bulbasaur → Ivysaur → Venusaur → Squirtle → Wartortle (or whatever the real current insertion order was) now appears consistently, and that switching the sort dropdown changes the full result set (not just the visible page).

## Self-review notes

- **Spec coverage:** every decision in the spec (column shape, backfill strategy, tie-break, sort option list, warning-not-block, auto-suggest, bulk reorder via the proven banners pattern, removal of client-side sort, Playwright explicitly out of scope) has a task.
- **Type consistency:** `ProductWritePayload` (Task 3) is the single shared write-payload type threaded through Task 4 (service), Task 6/7 (routes), and Task 8 (form submit payload) — field name `display_order: number` matches everywhere, including the migration's column name (Task 1).
- **No unrelated changes:** the pre-existing lack of rate-limiting/audit-logging on `/api/admin/products*` and the pre-existing client-schema duplication in `product-form.tsx` are both explicitly called out as out-of-scope in Global Constraints, not silently "fixed" as drive-by improvements.
