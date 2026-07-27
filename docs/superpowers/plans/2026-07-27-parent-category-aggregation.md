# Parent Category Aggregation (Phase 1 fix) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Clicking a parent category (Pokémon, Dragon Ball Z) shows every product under all of its descendant categories at any depth, without duplicating rows or hardcoding category names.

**Architecture:** Add one pure aggregation function, `getDescendantCategoryIds`, to the existing `CatalogService` (`src/lib/services/catalog-service.ts`). It does an in-memory BFS over the full category list (already fetched via `listActiveCategories()`) to collect a category's id plus every descendant id at any depth. Every place that currently filters products by a single `category_id` — the `/api/products` route and the `/catalog/[slug]` server page — is changed to expand the requested category into this id list first, then use `.in("category_id", ids)` instead of `.eq("category_id", id)`. The catalog sidebar's broken client-side exact-match filter (which caused the bug) is removed and replaced with real navigation to `/catalog/[slug]`, so there is a single source of truth for "which products belong under this category" instead of two.

**Tech Stack:** Next.js App Router (Server Components + Route Handlers), Supabase (`@supabase/supabase-js` query builder + raw REST via `fetch` in repositories), Jest + Testing Library.

## Global Constraints

- Repository → Service → API → UI layering must not be bypassed (`AI_MEMORY.md`).
- No hardcoded category names or ids anywhere in the fix.
- Do not duplicate products or create copies — aggregation is read-only, id-list based.
- `categories.parent_id` is self-referential and already supports arbitrary depth — no schema change needed for this phase.
- Must not regress the existing `display_order` default sort (`API.md`, migration `011`) or catalog pagination fix (CHANGELOG 0.11.x).
- `npx jest` must stay green and `npx tsc --noEmit` clean before this is considered done (`TESTING.md`).

---

### Task 1: `CatalogService.getDescendantCategoryIds`

**Files:**
- Modify: `src/lib/services/catalog-service.ts`
- Test: `src/lib/services/catalog-service.test.ts` (new file)

**Interfaces:**
- Consumes: `listActiveCategories(): Promise<Category[]>` from `src/lib/repositories/category-repository.ts` (already exists, returns flat active categories with `id`/`parent_id`).
- Produces: `getDescendantCategoryIds(categoryId: string): Promise<string[]>` — returns `[categoryId, ...every descendant id at any depth]`, `categoryId` first. Used by Task 2 and Task 3.

- [ ] **Step 1: Write the failing test**

```typescript
// src/lib/services/catalog-service.test.ts
import { getDescendantCategoryIds } from "./catalog-service";

jest.mock("@/lib/repositories/category-repository", () => ({
  listActiveCategories: jest.fn(),
}));

import { listActiveCategories } from "@/lib/repositories/category-repository";

function cat(id: string, parent_id: string | null) {
  return { id, parent_id } as never;
}

afterEach(() => jest.clearAllMocks());

describe("getDescendantCategoryIds", () => {
  it("returns just the id when the category has no children", async () => {
    (listActiveCategories as jest.Mock).mockResolvedValue([cat("a", null)]);
    await expect(getDescendantCategoryIds("a")).resolves.toEqual(["a"]);
  });

  it("includes direct children", async () => {
    (listActiveCategories as jest.Mock).mockResolvedValue([
      cat("pokemon", null),
      cat("indigo", "pokemon"),
      cat("orange", "pokemon"),
      cat("dbz", null),
      cat("saiyan", "dbz"),
    ]);
    const ids = await getDescendantCategoryIds("pokemon");
    expect(ids.sort()).toEqual(["indigo", "orange", "pokemon"].sort());
  });

  it("includes grandchildren and deeper (unlimited nesting)", async () => {
    (listActiveCategories as jest.Mock).mockResolvedValue([
      cat("pokemon", null),
      cat("kanto", "pokemon"),
      cat("starters", "kanto"),
      cat("fire", "starters"),
    ]);
    const ids = await getDescendantCategoryIds("pokemon");
    expect(ids.sort()).toEqual(["pokemon", "kanto", "starters", "fire"].sort());
  });

  it("returns only the leaf id when given a leaf category", async () => {
    (listActiveCategories as jest.Mock).mockResolvedValue([
      cat("pokemon", null),
      cat("indigo", "pokemon"),
    ]);
    await expect(getDescendantCategoryIds("indigo")).resolves.toEqual(["indigo"]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/lib/services/catalog-service.test.ts`
Expected: FAIL — `getDescendantCategoryIds is not a function` (export doesn't exist yet).

- [ ] **Step 3: Write minimal implementation**

Add to `src/lib/services/catalog-service.ts` (keep existing imports/exports, just add this):

```typescript
/**
 * Expands a category id into itself plus every descendant id at any depth,
 * via BFS over the full active-category list. Single source of truth for
 * "which category_ids count as belonging to this category" — used anywhere
 * products are filtered by category so parent categories aggregate their
 * whole subtree instead of matching only their own (product-less) id.
 */
export async function getDescendantCategoryIds(categoryId: string): Promise<string[]> {
  const categories = await listActiveCategories();
  const childrenByParent = new Map<string, string[]>();
  for (const cat of categories) {
    if (cat.parent_id) {
      const siblings = childrenByParent.get(cat.parent_id) ?? [];
      siblings.push(cat.id);
      childrenByParent.set(cat.parent_id, siblings);
    }
  }

  const ids = [categoryId];
  const queue = [categoryId];
  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const childId of childrenByParent.get(current) ?? []) {
      ids.push(childId);
      queue.push(childId);
    }
  }
  return ids;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/lib/services/catalog-service.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/services/catalog-service.ts src/lib/services/catalog-service.test.ts
git commit -m "feat: add CatalogService.getDescendantCategoryIds for unlimited-depth category aggregation"
```

---

### Task 2: Expand `category` filter in `GET /api/products`

**Files:**
- Modify: `src/app/api/products/route.ts`
- Modify: `src/app/api/products/route.test.ts`

**Interfaces:**
- Consumes: `getDescendantCategoryIds(categoryId: string): Promise<string[]>` from Task 1.

- [ ] **Step 1: Write the failing test**

Add to `src/app/api/products/route.test.ts` (the existing mock chain needs an `in` method added — update `makeChainable` and add the new test):

```typescript
// In makeChainable(), add mockIn to the chain object:
const mockIn = jest.fn();
// ...inside makeChainable's `chain` object literal, add:
//   in: mockIn,
// ...and after the Object.values(chain).forEach(...) loop, add:
//   mockIn.mockReturnValue(chain);

// Mock the service so the test controls exactly what ids come back:
jest.mock("@/lib/services/catalog-service", () => ({
  getDescendantCategoryIds: jest.fn(),
}));
import { getDescendantCategoryIds } from "@/lib/services/catalog-service";

describe("GET /api/products category expansion", () => {
  it("expands a parent category into itself + descendants via .in(), not a bare .eq()", async () => {
    (getDescendantCategoryIds as jest.Mock).mockResolvedValue(["pokemon", "indigo", "orange"]);
    await GET(req("?category=pokemon"));
    expect(getDescendantCategoryIds).toHaveBeenCalledWith("pokemon");
    expect(mockIn).toHaveBeenCalledWith("category_id", ["pokemon", "indigo", "orange"]);
    expect(mockEq).not.toHaveBeenCalledWith("category_id", "pokemon");
  });
});
```

(Full rewritten `makeChainable` for clarity — replace the existing function body:)

```typescript
const mockIn = jest.fn();

function makeChainable() {
  const chain: Record<string, jest.Mock> = {
    select: mockSelect,
    eq: mockEq,
    in: mockIn,
    ilike: mockIlike,
    order: mockOrder,
    range: mockRange,
  };
  Object.values(chain).forEach((fn) => fn.mockReturnValue(chain));
  mockRange.mockResolvedValue({ data: [], count: 0, error: null });
  return chain;
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/app/api/products/route.test.ts`
Expected: FAIL — `mockIn` never called (route still uses `.eq("category_id", category)`).

- [ ] **Step 3: Write minimal implementation**

In `src/app/api/products/route.ts`, replace the direct `.eq("category_id", category)` call with an expanded `.in()`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { applyProductSort } from "@/lib/services/product-service";
import { getDescendantCategoryIds } from "@/lib/services/catalog-service";

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

  if (category) {
    const categoryIds = await getDescendantCategoryIds(category);
    query = query.in("category_id", categoryIds);
  }
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
Expected: PASS (all existing sort tests + the new expansion test).

- [ ] **Step 5: Commit**

```bash
git add src/app/api/products/route.ts src/app/api/products/route.test.ts
git commit -m "fix: expand /api/products category filter to include all descendant categories"
```

---

### Task 3: Unlimited-depth aggregation on `/catalog/[slug]`

**Files:**
- Modify: `src/app/(shop)/catalog/[slug]/page.tsx`

**Interfaces:**
- Consumes: `getDescendantCategoryIds(categoryId: string): Promise<string[]>` from Task 1.

**Why this task has no isolated unit test:** this file is a Server Component page (async function returning JSX, no exported handler), matching the existing `TESTING.md` layer boundaries (routes/services get tests; this specific file has none today either). Its logic is now a two-line call into the already-tested `getDescendantCategoryIds`, so correctness rides on Task 1's tests. Verify by manual/live check in Step 2 below.

- [ ] **Step 1: Replace the one-level children embed with full-depth expansion**

Replace the category-fetch and `allIds` block in `src/app/(shop)/catalog/[slug]/page.tsx`:

```typescript
import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { applyProductSort } from "@/lib/services/product-service";
import { getDescendantCategoryIds } from "@/lib/services/catalog-service";
import CatalogClient from "../catalog-client";
import type { CategoryWithChildren } from "@/types";

interface Props {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ [key: string]: string | undefined }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const supabase = await createClient();
  const { data: category } = await supabase
    .from("categories")
    .select("name, description")
    .eq("slug", slug)
    .single();

  if (!category) return { title: "Category Not Found" };
  return {
    title: `${category.name} — Legacy Mania`,
    description:
      category.description ||
      `Browse all ${category.name} collectible cards on Legacy Mania.`,
  };
}

export default async function CategoryPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const { sort } = await searchParams;
  const supabase = await createClient();

  const { data: category } = await supabase
    .from("categories")
    .select("*")
    .eq("slug", slug)
    .single();

  if (!category) notFound();

  // Aggregates this category + every descendant at any depth (not just direct children).
  const allIds = await getDescendantCategoryIds(category.id);

  const [{ data: allCategories }, { data: products, count }] = await Promise.all([
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
        .eq("is_active", true)
        .in("category_id", allIds),
      sort ?? null
    ).limit(100),
  ]);

  return (
    <Suspense fallback={<div className="min-h-screen" />}>
      <CatalogClient
        initialProducts={products ?? []}
        totalCount={count ?? 0}
        categories={(allCategories ?? []) as CategoryWithChildren[]}
        pageTitle={category.name}
        pageDescription={
          category.description ||
          `${count ?? 0} collectibles in ${category.name}`
        }
      />
    </Suspense>
  );
}
```

(Note: this also drops the unused `searchParams={{ category: category.id }}` prop passed to `CatalogClient` — Task 4 removes that prop from `CatalogClient`'s interface entirely since it was never read.)

- [ ] **Step 2: Verify against live data**

Run the dev server and visit `/catalog/pokemon`: must show 151 products (Indigo League's current live count). Visit `/catalog/dragon-ball-z`: must show 15 products (Saiyan Saga's current live count). Visit `/catalog/pokemon-indigo-league` directly: must still show the same 151 products (leaf category unaffected).

- [ ] **Step 3: Commit**

```bash
git add "src/app/(shop)/catalog/[slug]/page.tsx"
git commit -m "fix: aggregate products from descendants at any depth on /catalog/[slug], not just direct children"
```

---

### Task 4: Fix the broken sidebar filter in `CatalogClient`

**Files:**
- Modify: `src/app/(shop)/catalog/catalog-client.tsx`
- Modify: `src/app/(shop)/catalog/catalog-client.test.tsx`

**Interfaces:**
- Consumes: `CategoryWithChildren[]` (existing prop, each item has `.slug`).
- Produces: no new exports; `CatalogClient`'s `searchParams` prop is removed (dead — never read) and the `selectedCategory` client-state filter is removed.

This is the actual root cause of the reported bug: `catalog-client.tsx` filtered the already-fetched product page by exact `p.category_id !== selectedCategory`. Every real product's `category_id` is a leaf category (e.g. "Indigo League"), never a parent's own id, so clicking a parent category in the sidebar always matched zero products — while clicking a leaf category happened to match because the leaf id *is* what's stored on the product. Task 2/3 fixed server-side aggregation; this task removes the redundant, incorrect client-side exact-match filter and makes the sidebar a real navigation control that lands on the now-correct `/catalog/[slug]` page.

- [ ] **Step 1: Write the failing test**

Replace `src/app/(shop)/catalog/catalog-client.test.tsx` with (keeping the existing pagination test, adding a new describe block):

```typescript
import { render, screen } from "@testing-library/react";
import CatalogClient from "./catalog-client";
import type { Product, CategoryWithChildren } from "@/types";

const mockPush = jest.fn();
jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
  usePathname: () => "/catalog",
  useSearchParams: () => new URLSearchParams(),
}));

jest.mock("@/components/product/product-card", () => ({
  __esModule: true,
  default: ({ product }: { product: Product }) => <div>{product.name}</div>,
}));

function makeProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: "p1",
    name: "Bulbasaur",
    slug: "bulbasaur",
    description: null,
    price: 10,
    compare_price: null,
    images: [],
    category_id: null,
    series: null,
    saga: null,
    collection: null,
    rarity: null,
    condition: null,
    stock_quantity: 5,
    reserved_quantity: 0,
    display_order: 0,
    sku: null,
    is_active: true,
    is_featured: false,
    is_new: false,
    tags: null,
    meta_title: null,
    meta_description: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  } as Product;
}

function makeCategory(overrides: Partial<CategoryWithChildren> = {}): CategoryWithChildren {
  return {
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
    children: [],
    ...overrides,
  } as CategoryWithChildren;
}

const page1Products = [makeProduct({ id: "p1", name: "Bulbasaur" })];
const page2Products = [makeProduct({ id: "p25", name: "Charmander" })];

describe("CatalogClient pagination", () => {
  afterEach(() => jest.clearAllMocks());

  it("renders products from the latest initialProducts prop, not a frozen copy from first mount", () => {
    const { rerender } = render(
      <CatalogClient
        initialProducts={page1Products}
        totalCount={56}
        currentPage={1}
        pageSize={24}
        categories={[]}
      />
    );
    expect(screen.getByText("Bulbasaur")).toBeInTheDocument();
    expect(screen.queryByText("Charmander")).not.toBeInTheDocument();

    rerender(
      <CatalogClient
        initialProducts={page2Products}
        totalCount={56}
        currentPage={2}
        pageSize={24}
        categories={[]}
      />
    );

    expect(screen.getByText("Charmander")).toBeInTheDocument();
    expect(screen.queryByText("Bulbasaur")).not.toBeInTheDocument();
  });
});

describe("CatalogClient category sidebar", () => {
  afterEach(() => jest.clearAllMocks());

  it("links a parent category to its /catalog/[slug] page instead of filtering client-side", () => {
    render(
      <CatalogClient
        initialProducts={page1Products}
        totalCount={1}
        categories={[makeCategory({ id: "pokemon", slug: "pokemon", name: "Pokémon" })]}
      />
    );
    const link = screen.getByRole("link", { name: "Pokémon" });
    expect(link).toHaveAttribute("href", "/catalog/pokemon");
  });

  it("links a child category to its own /catalog/[slug] page", () => {
    render(
      <CatalogClient
        initialProducts={page1Products}
        totalCount={1}
        categories={[
          makeCategory({
            id: "pokemon",
            slug: "pokemon",
            name: "Pokémon",
            children: [
              makeCategory({ id: "indigo", slug: "pokemon-indigo-league", name: "Indigo League", parent_id: "pokemon" }),
            ],
          }),
        ]}
      />
    );
    const link = screen.getByRole("link", { name: "Indigo League" });
    expect(link).toHaveAttribute("href", "/catalog/pokemon-indigo-league");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/app/(shop)/catalog/catalog-client.test.tsx`
Expected: FAIL — sidebar entries are currently `<button>` elements with `onClick`, not links, so `getByRole("link", ...)` finds nothing.

- [ ] **Step 3: Write minimal implementation**

In `src/app/(shop)/catalog/catalog-client.tsx`:

1. Add `import Link from "next/link";` near the top.
2. Remove the `searchParams` prop from `CatalogClientProps` (never read) and from the destructured parameters.
3. Remove `const [selectedCategory, setSelectedCategory] = useState<string | null>(null);`.
4. Change `filtered` to drop the category clause:

```typescript
  const filtered = products.filter((p) => {
    if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });
```

5. Replace the "All Series" button's active-state check (`selectedCategory === null`) with a check against `pathname === "/catalog"`, and turn it into a `Link`:

```typescript
                  <li>
                    <Link
                      href="/catalog"
                      className={cn(
                        "w-full block text-left px-3 py-2 rounded-lg text-sm transition-colors",
                        pathname === "/catalog"
                          ? "bg-primary text-primary-foreground font-semibold"
                          : "text-muted-foreground hover:text-foreground hover:bg-accent"
                      )}
                    >
                      All Series
                    </Link>
                  </li>
```

6. Replace the parent category `<button onClick={() => setSelectedCategory(cat.id)}>` with a `Link` to `/catalog/${cat.slug}`, and the active check with `pathname === \`/catalog/${cat.slug}\``:

```typescript
                  {categories.map((cat) => (
                    <li key={cat.id}>
                      <Link
                        href={`/catalog/${cat.slug}`}
                        className={cn(
                          "w-full block text-left px-3 py-2 rounded-lg text-sm transition-colors",
                          pathname === `/catalog/${cat.slug}`
                            ? "bg-primary text-primary-foreground font-semibold"
                            : "text-muted-foreground hover:text-foreground hover:bg-accent"
                        )}
                      >
                        {cat.name}
                      </Link>
                      {cat.children && cat.children.length > 0 && (
                        <ul className="ml-4 mt-1 space-y-1">
                          {cat.children.map((child) => (
                            <li key={child.id}>
                              <Link
                                href={`/catalog/${child.slug}`}
                                className={cn(
                                  "w-full block text-left px-3 py-1.5 rounded-lg text-xs transition-colors",
                                  pathname === `/catalog/${child.slug}`
                                    ? "text-primary font-semibold"
                                    : "text-muted-foreground hover:text-foreground"
                                )}
                              >
                                {child.name}
                              </Link>
                            </li>
                          ))}
                        </ul>
                      )}
                    </li>
                  ))}
```

7. Update the result-count and "no products" copy and the pagination-visibility check, which referenced `selectedCategory` — replace `search || selectedCategory` with just `search`, and `!search && !selectedCategory` with just `!search`:

```typescript
            <p className="text-sm text-muted-foreground mb-4">
              {search
                ? `${filtered.length} result${filtered.length !== 1 ? "s" : ""} found`
                : `Showing ${initialProducts.length} of ${totalCount} products`}
            </p>
```

```typescript
            {!search && totalCount > pageSize && (
```

8. Remove the now-unused `CatalogClientProps.searchParams` field from the interface at the top of the file.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/app/(shop)/catalog/catalog-client.test.tsx`
Expected: PASS (pagination test + 2 new sidebar link tests).

- [ ] **Step 5: Update all call sites that pass the now-removed `searchParams` prop**

`src/app/(shop)/catalog/page.tsx` passes `searchParams={params}` — remove that line (the prop no longer exists on `CatalogClientProps`). Task 3 already removed it from `[slug]/page.tsx`.

- [ ] **Step 6: Run full suite + typecheck**

Run: `npx jest && npx tsc --noEmit`
Expected: All suites pass, no type errors (removing a prop that's now unused on both call sites must not leave a dangling reference).

- [ ] **Step 7: Commit**

```bash
git add src/app/\(shop\)/catalog/catalog-client.tsx src/app/\(shop\)/catalog/catalog-client.test.tsx src/app/\(shop\)/catalog/page.tsx
git commit -m "fix: replace CatalogClient's broken exact-match category filter with real navigation"
```

---

### Task 5: Documentation

**Files:**
- Modify: `CHANGELOG.md`
- Modify: `AI_MEMORY.md`
- Modify: `TASKS.md`
- Modify: `ROADMAP.md`

- [ ] **Step 1: Add a CHANGELOG entry**

Under the next unreleased version heading in `CHANGELOG.md`, add:

```markdown
### Fixed
- Parent category pages (e.g. `/catalog/pokemon`) and the `/api/products?category=` filter now
  aggregate products from every descendant category at any depth, not just an exact `category_id`
  match. Root cause: products are always tagged with a leaf category, so a parent category's own
  id never appears on any product row — the old exact-match filter (both server-side `.eq()` and
  the catalog sidebar's client-side `selectedCategory` check) always returned zero results for any
  category with children. Fixed via `CatalogService.getDescendantCategoryIds()`, a BFS over the
  category tree, used by `/api/products`, `/catalog/[slug]`, and (by replacing client-side
  filtering with navigation) the catalog sidebar.
```

- [ ] **Step 2: Add an `AI_MEMORY.md` gotcha entry**

Append to the "Known gotchas" list:

```markdown
- **Category filtering must always go through `CatalogService.getDescendantCategoryIds()`** —
  products are tagged with leaf categories only; a parent category's own id never matches any
  product row directly. Any new code that filters products by category (`.eq("category_id", x)`)
  is almost certainly wrong for a parent category — expand via `getDescendantCategoryIds()` first
  and use `.in()`. Fixed 2026-07-27; see CHANGELOG.
```

- [ ] **Step 3: Update `TASKS.md` / `ROADMAP.md`**

Mark the "Set up categories" checkbox in `TASKS.md`'s Priority 1 section as verified now that aggregation is confirmed against live data (151 Pokémon / 15 DBZ products visible under parent pages), and add a row to `ROADMAP.md`'s standalone-fixes table documenting this fix, following the same format as the existing "Catalog pagination + admin authz" row.

- [ ] **Step 4: Commit**

```bash
git add CHANGELOG.md AI_MEMORY.md TASKS.md ROADMAP.md
git commit -m "docs: record parent category aggregation fix"
```
