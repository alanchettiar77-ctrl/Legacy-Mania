# Homepage Hero Tiles CMS Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the hardcoded, non-clickable "floating card" tiles on the homepage hero (`Pikachu`/`Goku`/`Naruto`/`Luffy`) with an admin-managed CMS module — add/edit/reorder/hide/delete tiles, each linking anywhere via a generic link model, no code deploy required to change them.

**Architecture:** New `hero_tiles` table, following the exact Repository → Service → API → UI layering and soft-delete/audit conventions already established by `banners` (migration 010) and the generic Category CMS (migration 012). Per the deferred architecture note recorded in `ROADMAP.md`/`AI_MEMORY.md` during the Category CMS work, this module is the first to use the generic `link_type` + `link_value` linking model (`category | product | collection | search | page | custom_url`) instead of a bare `category_id` foreign key — so a future tile can point at a product or an arbitrary path without another schema change.

**Tech Stack:** Next.js 16 App Router, Supabase/PostgREST via raw `fetch` (no Supabase JS client in repositories), Zod, Jest + Testing Library, TypeScript strict, Tailwind CSS, framer-motion (existing hero animation).

## Global Constraints

- Repository → Service → API → UI layering is mandatory; no shortcuts.
- All admin writes: rate limit → `requireAdmin()` → zod validate → one service call → `recordAuditLog()` — exact order, matching every existing admin route (`src/app/api/admin/banners/route.ts` is the reference).
- Soft delete via `deleted_at` (never hard `DELETE`), mirroring `banners`/`homepage_notifications`/`categories`.
- The storefront feed function (`getHomepageHeroTiles`) must **never throw** — homepage rendering must survive Supabase being unreachable or this migration not yet being applied, exactly like `getHomepageBanners`/`getHomepageNotifications` already do. This is a hard lesson from the categories outage earlier today: every new storefront-facing read of a new table must be defensive from day one.
- **Tailwind JIT constraint:** Tailwind only compiles class names it finds as literal strings in source files at build time. Dynamically building a class string from database data (e.g. ``bg-gradient-to-br ${row.color_from} ${row.color_to}``) will silently fail to render in production, because the JIT compiler never sees those class names in any source file. Tiles must store a `color_theme` **key** (e.g. `"sunrise"`), and the frontend must map that key to a Tailwind class string through a lookup object whose literal strings are physically present in the component's source file.
- No franchise-specific code anywhere in this module — `hero_tiles` rows are just label + emoji + theme + link, usable for any future collection type, matching the Category CMS's zero-franchise-specific-code precedent.
- Do not build resolvers for `product`/`collection`/`search`/`page` link types beyond storing `link_value` as a literal path — those destinations don't have dedicated URL-building logic anywhere in the codebase yet (`/products/[slug]` exists for products, but no collection/search page does). Building speculative resolution logic for types nothing yet needs is out of scope; the enum reserves the vocabulary, per the deferred architecture note, without over-building.
- Keep the existing hero animation (framer-motion `motion.div`, `animate-float` CSS class, staggered `delay`) — this plan changes what data drives the tiles, not how they're animated.

---

### Task 1: Migration + Hero Tile Repository

**Files:**
- Create: `supabase/migrations/013_hero_tiles.sql`
- Create: `src/lib/repositories/hero-tile-repository.ts`
- Test: `src/lib/repositories/hero-tile-repository.test.ts`

**Interfaces:**
- Produces: `HeroTileRow` interface, `listHeroTiles()`, `listActiveHeroTiles()`, `getHeroTile(id)`, `getMaxDisplayOrder()`, `insertHeroTile(values)`, `updateHeroTile(id, patch)`, `softDeleteHeroTile(id, userId)`, `reorderHeroTiles(ids, userId)` — all consumed by Task 2's service layer.

- [ ] **Step 1: Write the migration**

```sql
-- supabase/migrations/013_hero_tiles.sql
-- Homepage hero "floating tile" CMS (admin-managed, replaces the hardcoded
-- Pikachu/Goku/Naruto/Luffy tiles in src/components/home/hero-section.tsx).
-- Apply manually via Supabase SQL Editor, then verify via a PostgREST curl GET on
-- /rest/v1/hero_tiles?select=id&limit=1 (see DATABASE.md).
--
-- Uses the generic link_type/link_value model (not a bare category_id FK) so future
-- tiles can point at products, collections, search results, or arbitrary pages without
-- another migration. See the "Generic internal linking" note in ROADMAP.md.

CREATE TABLE public.hero_tiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  label TEXT NOT NULL,
  icon_emoji TEXT NOT NULL,
  color_theme TEXT NOT NULL DEFAULT 'sunrise'
    CHECK (color_theme IN ('sunrise','ember','citrus','blossom','ocean','violet')),
  link_type TEXT NOT NULL DEFAULT 'category'
    CHECK (link_type IN ('category','product','collection','search','page','custom_url')),
  link_value TEXT NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by UUID REFERENCES public.profiles(id),
  updated_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_hero_tiles_active_order ON public.hero_tiles (is_active, display_order)
  WHERE deleted_at IS NULL;

ALTER TABLE public.hero_tiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view live hero tiles" ON public.hero_tiles
  FOR SELECT USING (is_active = TRUE AND deleted_at IS NULL);

CREATE POLICY "Admins can view all hero tiles" ON public.hero_tiles
  FOR SELECT USING (public.is_admin());
-- No INSERT/UPDATE/DELETE policy: writes are service-role-only, same as banners.

CREATE TRIGGER update_hero_tiles_updated_at BEFORE UPDATE ON public.hero_tiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
```

- [ ] **Step 2: Write the repository**

```typescript
// src/lib/repositories/hero-tile-repository.ts
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;

const HEADERS = {
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
  "Content-Type": "application/json",
};
const WRITE_HEADERS = { ...HEADERS, Prefer: "return=representation" };

const TABLE = `${SUPABASE_URL}/rest/v1/hero_tiles`;

export type ColorTheme = "sunrise" | "ember" | "citrus" | "blossom" | "ocean" | "violet";
export type LinkType = "category" | "product" | "collection" | "search" | "page" | "custom_url";

export interface HeroTileRow {
  id: string;
  label: string;
  icon_emoji: string;
  color_theme: ColorTheme;
  link_type: LinkType;
  link_value: string;
  display_order: number;
  is_active: boolean;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

/** All non-deleted rows for the admin panel, in display order. */
export async function listHeroTiles(): Promise<HeroTileRow[]> {
  const res = await fetch(`${TABLE}?deleted_at=is.null&order=display_order.asc`, {
    headers: HEADERS,
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Failed to list hero tiles: ${res.status}`);
  return res.json();
}

/** Live rows for the storefront: active and not deleted. */
export async function listActiveHeroTiles(): Promise<HeroTileRow[]> {
  const res = await fetch(
    `${TABLE}?is_active=eq.true&deleted_at=is.null&order=display_order.asc`,
    { headers: HEADERS, cache: "no-store" }
  );
  if (!res.ok) throw new Error(`Failed to list active hero tiles: ${res.status}`);
  return res.json();
}

export async function getHeroTile(id: string): Promise<HeroTileRow | null> {
  const res = await fetch(`${TABLE}?id=eq.${encodeURIComponent(id)}&deleted_at=is.null&limit=1`, {
    headers: HEADERS,
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Failed to get hero tile: ${res.status}`);
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

export async function insertHeroTile(values: Record<string, unknown>): Promise<HeroTileRow> {
  const res = await fetch(TABLE, {
    method: "POST",
    headers: WRITE_HEADERS,
    body: JSON.stringify(values),
  });
  if (!res.ok) throw new Error(`Failed to insert hero tile: ${res.status}`);
  const rows = await res.json();
  return rows[0];
}

export async function updateHeroTile(
  id: string,
  patch: Record<string, unknown>
): Promise<HeroTileRow | null> {
  const res = await fetch(`${TABLE}?id=eq.${encodeURIComponent(id)}&deleted_at=is.null`, {
    method: "PATCH",
    headers: WRITE_HEADERS,
    body: JSON.stringify(patch),
  });
  if (!res.ok) throw new Error(`Failed to update hero tile: ${res.status}`);
  const rows = await res.json();
  return rows[0] ?? null;
}

export async function softDeleteHeroTile(id: string, userId: string): Promise<boolean> {
  const row = await updateHeroTile(id, { deleted_at: new Date().toISOString(), updated_by: userId });
  return row !== null;
}

/** Rewrites display_order to match the given id order (0..n-1). */
export async function reorderHeroTiles(ids: string[], userId: string): Promise<void> {
  for (let i = 0; i < ids.length; i++) {
    const res = await fetch(`${TABLE}?id=eq.${encodeURIComponent(ids[i])}&deleted_at=is.null`, {
      method: "PATCH",
      headers: HEADERS,
      body: JSON.stringify({ display_order: i, updated_by: userId }),
    });
    if (!res.ok) throw new Error(`Failed to reorder hero tile ${ids[i]}: ${res.status}`);
  }
}
```

- [ ] **Step 3: Write the repository test**

```typescript
// src/lib/repositories/hero-tile-repository.test.ts
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

describe("hero-tile-repository", () => {
  it("listHeroTiles requests non-deleted rows ordered by display_order", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({ ok: true, json: async () => [{ id: "t1" }] });
    const { listHeroTiles } = await import("@/lib/repositories/hero-tile-repository");

    const rows = await listHeroTiles();

    expect(rows).toEqual([{ id: "t1" }]);
    const [url] = (global.fetch as jest.Mock).mock.calls[0];
    expect(url).toContain("deleted_at=is.null");
    expect(url).toContain("order=display_order.asc");
  });

  it("listActiveHeroTiles filters by is_active and deleted_at", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({ ok: true, json: async () => [] });
    const { listActiveHeroTiles } = await import("@/lib/repositories/hero-tile-repository");

    await listActiveHeroTiles();

    const [url] = (global.fetch as jest.Mock).mock.calls[0];
    expect(url).toContain("is_active=eq.true");
    expect(url).toContain("deleted_at=is.null");
  });

  it("insertHeroTile POSTs to the hero_tiles table and returns the created row", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => [{ id: "t1", label: "Pikachu" }],
    });
    const { insertHeroTile } = await import("@/lib/repositories/hero-tile-repository");

    const row = await insertHeroTile({ label: "Pikachu" });

    expect(row).toEqual({ id: "t1", label: "Pikachu" });
    const [url, opts] = (global.fetch as jest.Mock).mock.calls[0];
    expect(url).toBe("https://test.supabase.co/rest/v1/hero_tiles");
    expect(opts.method).toBe("POST");
  });

  it("softDeleteHeroTile PATCHes deleted_at and updated_by", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({ ok: true, json: async () => [{ id: "t1" }] });
    const { softDeleteHeroTile } = await import("@/lib/repositories/hero-tile-repository");

    const result = await softDeleteHeroTile("t1", "admin-1");

    expect(result).toBe(true);
    const [, opts] = (global.fetch as jest.Mock).mock.calls[0];
    const body = JSON.parse(opts.body);
    expect(body.deleted_at).toBeDefined();
    expect(body.updated_by).toBe("admin-1");
  });

  it("reorderHeroTiles PATCHes each id with its new display_order", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({ ok: true, json: async () => [{}] });
    const { reorderHeroTiles } = await import("@/lib/repositories/hero-tile-repository");

    await reorderHeroTiles(["t2", "t1"], "admin-1");

    expect(global.fetch).toHaveBeenCalledTimes(2);
    const firstBody = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
    const secondBody = JSON.parse((global.fetch as jest.Mock).mock.calls[1][1].body);
    expect(firstBody.display_order).toBe(0);
    expect(secondBody.display_order).toBe(1);
  });

  it("getMaxDisplayOrder returns -1 when the table is empty", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({ ok: true, json: async () => [] });
    const { getMaxDisplayOrder } = await import("@/lib/repositories/hero-tile-repository");

    expect(await getMaxDisplayOrder()).toBe(-1);
  });
});
```

- [ ] **Step 4: Run the tests**

Run: `npx jest src/lib/repositories/hero-tile-repository.test.ts`
Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/013_hero_tiles.sql src/lib/repositories/hero-tile-repository.ts src/lib/repositories/hero-tile-repository.test.ts
git commit -m "feat: add hero_tiles migration and repository"
```

---

### Task 2: Link Resolution Util + Hero Tile Service (feed, CRUD, reorder)

**Files:**
- Create: `src/lib/utils/hero-tile-link.ts`
- Create: `src/lib/services/hero-tile-service.ts`
- Test: `src/lib/utils/hero-tile-link.test.ts`
- Test: `src/lib/services/hero-tile-service.test.ts`

**Interfaces:**
- Consumes: everything exported from Task 1's `hero-tile-repository.ts` (service only).
- Produces: `resolveHeroTileHref(tile: HeroTileLinkFields): string` in its own dependency-free module (Task 6's `HeroSection`, a client component, imports this directly — never the service — so no server-only repository code with `SUPABASE_SERVICE_ROLE_KEY` gets pulled into the client bundle). `getHomepageHeroTiles(): Promise<HeroTileRow[]>` (never throws), `listAllHeroTiles()`, `createHeroTile(input, adminId)`, `updateHeroTileById(id, patch, adminId)`, `deleteHeroTile(id, adminId)`, `reorder(ids, adminId)` — consumed by Task 4's API routes and Task 7's homepage page (both server-side).

- [ ] **Step 1: Write the link resolution util (no repository/service dependency)**

```typescript
// src/lib/utils/hero-tile-link.ts
export type HeroTileLinkType = "category" | "product" | "collection" | "search" | "page" | "custom_url";

export interface HeroTileLinkFields {
  link_type: HeroTileLinkType;
  link_value: string;
}

/**
 * Resolves a tile's link into a storefront href. Only `category` and `custom_url`
 * have dedicated destinations today; `product` maps to the existing product route.
 * `collection` / `search` / `page` are reserved for future modules (see the
 * generic-linking note in ROADMAP.md/AI_MEMORY.md) and, until those exist, fall back
 * to using link_value as a literal path.
 *
 * Deliberately dependency-free: this is imported directly by the "use client"
 * HeroSection component. Anything imported here must never touch
 * hero-tile-repository.ts or hero-tile-service.ts, which read
 * SUPABASE_SERVICE_ROLE_KEY at module scope and must stay server-only.
 */
export function resolveHeroTileHref(tile: HeroTileLinkFields): string {
  switch (tile.link_type) {
    case "category":
      return `/catalog/${tile.link_value}`;
    case "product":
      return `/products/${tile.link_value}`;
    case "custom_url":
    case "collection":
    case "search":
    case "page":
    default:
      return tile.link_value;
  }
}
```

- [ ] **Step 2: Write the link resolution util test**

```typescript
// src/lib/utils/hero-tile-link.test.ts
import { resolveHeroTileHref } from "@/lib/utils/hero-tile-link";

describe("resolveHeroTileHref", () => {
  it("builds /catalog/:slug for category links", () => {
    expect(resolveHeroTileHref({ link_type: "category", link_value: "pokemon" })).toBe("/catalog/pokemon");
  });

  it("builds /products/:slug for product links", () => {
    expect(resolveHeroTileHref({ link_type: "product", link_value: "charizard-holo" })).toBe(
      "/products/charizard-holo"
    );
  });

  it("uses link_value verbatim for custom_url links", () => {
    expect(resolveHeroTileHref({ link_type: "custom_url", link_value: "/about" })).toBe("/about");
  });

  it("falls back to link_value for reserved future link types", () => {
    expect(resolveHeroTileHref({ link_type: "collection", link_value: "/collections/new" })).toBe(
      "/collections/new"
    );
    expect(resolveHeroTileHref({ link_type: "search", link_value: "/search?q=holo" })).toBe(
      "/search?q=holo"
    );
    expect(resolveHeroTileHref({ link_type: "page", link_value: "/pages/faq" })).toBe("/pages/faq");
  });

  it("resolves a non-card, arbitrary future collection slug exactly like an anime one", () => {
    // Same code path used for "pokemon" must work unmodified for any future
    // non-card collection (e.g. a T-Shirts line) — proves no franchise-specific
    // branching exists anywhere in link resolution.
    expect(resolveHeroTileHref({ link_type: "category", link_value: "t-shirts-men-hoodies" })).toBe(
      "/catalog/t-shirts-men-hoodies"
    );
  });
});
```

- [ ] **Step 3: Run the util tests**

Run: `npx jest src/lib/utils/hero-tile-link.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 4: Commit the util**

```bash
git add src/lib/utils/hero-tile-link.ts src/lib/utils/hero-tile-link.test.ts
git commit -m "feat: add dependency-free hero tile link resolution util"
```

- [ ] **Step 5: Write the service**

```typescript
// src/lib/services/hero-tile-service.ts
import {
  listHeroTiles,
  listActiveHeroTiles,
  getHeroTile,
  getMaxDisplayOrder,
  insertHeroTile,
  updateHeroTile as repoUpdate,
  softDeleteHeroTile,
  reorderHeroTiles,
  type HeroTileRow,
} from "@/lib/repositories/hero-tile-repository";
import type { HeroTileCreateInput, HeroTileUpdateInput } from "@/lib/validation/hero-tile";
import { resolveHeroTileHref } from "@/lib/utils/hero-tile-link";

export type { HeroTileRow };
// Re-exported for server-side consumers (API routes, page.tsx) that already import
// this service — HeroSection itself must import resolveHeroTileHref directly from
// @/lib/utils/hero-tile-link, never through this file (see Task 6).
export { resolveHeroTileHref };

/** Storefront feed. Never throws — the homepage must render without hero tiles if
 * Supabase is unreachable or this migration hasn't been applied yet (matches
 * getHomepageBanners / getHomepageNotifications). */
export async function getHomepageHeroTiles(): Promise<HeroTileRow[]> {
  try {
    return await listActiveHeroTiles();
  } catch (error) {
    console.error("Failed to load homepage hero tiles", error);
    return [];
  }
}

export async function listAllHeroTiles(): Promise<HeroTileRow[]> {
  return listHeroTiles();
}

export async function createHeroTile(
  input: HeroTileCreateInput,
  adminId: string
): Promise<HeroTileRow> {
  const display_order = input.display_order ?? (await getMaxDisplayOrder()) + 1;
  return insertHeroTile({
    ...input,
    display_order,
    created_by: adminId,
    updated_by: adminId,
  });
}

export async function updateHeroTileById(
  id: string,
  patch: HeroTileUpdateInput,
  adminId: string
): Promise<HeroTileRow | null> {
  return repoUpdate(id, { ...patch, updated_by: adminId });
}

export async function deleteHeroTile(id: string, adminId: string): Promise<boolean> {
  return softDeleteHeroTile(id, adminId);
}

export async function reorder(ids: string[], adminId: string): Promise<void> {
  return reorderHeroTiles(ids, adminId);
}

export { getHeroTile };
```

- [ ] **Step 2: Write the service test**

```typescript
// src/lib/services/hero-tile-service.test.ts
jest.mock("@/lib/repositories/hero-tile-repository", () => ({
  listHeroTiles: jest.fn(),
  listActiveHeroTiles: jest.fn(),
  getHeroTile: jest.fn(),
  getMaxDisplayOrder: jest.fn(),
  insertHeroTile: jest.fn(),
  updateHeroTile: jest.fn(),
  softDeleteHeroTile: jest.fn(),
  reorderHeroTiles: jest.fn(),
}));

import * as repo from "@/lib/repositories/hero-tile-repository";
import { getHomepageHeroTiles, createHeroTile } from "@/lib/services/hero-tile-service";

describe("hero-tile-service", () => {
  beforeEach(() => jest.clearAllMocks());

  it("getHomepageHeroTiles returns the active tiles on success", async () => {
    (repo.listActiveHeroTiles as jest.Mock).mockResolvedValue([{ id: "t1" }]);
    expect(await getHomepageHeroTiles()).toEqual([{ id: "t1" }]);
  });

  it("getHomepageHeroTiles swallows errors and returns an empty array", async () => {
    (repo.listActiveHeroTiles as jest.Mock).mockRejectedValue(new Error("relation does not exist"));
    await expect(getHomepageHeroTiles()).resolves.toEqual([]);
  });

  it("createHeroTile assigns the next display_order when none is given", async () => {
    (repo.getMaxDisplayOrder as jest.Mock).mockResolvedValue(3);
    (repo.insertHeroTile as jest.Mock).mockResolvedValue({ id: "t1", display_order: 4 });

    await createHeroTile(
      { label: "Ash", icon_emoji: "🎒", color_theme: "sunrise", link_type: "category", link_value: "pokemon" } as never,
      "admin-1"
    );

    expect(repo.insertHeroTile).toHaveBeenCalledWith(
      expect.objectContaining({ display_order: 4, created_by: "admin-1", updated_by: "admin-1" })
    );
  });
});
```

- [ ] **Step 3: Run the tests**

Run: `npx jest src/lib/services/hero-tile-service.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 4: Commit**

```bash
git add src/lib/services/hero-tile-service.ts src/lib/services/hero-tile-service.test.ts
git commit -m "feat: add hero tile service with never-throw storefront feed and link resolution"
```

---

### Task 3: Validation Schemas

**Files:**
- Create: `src/lib/validation/hero-tile.ts`
- Test: `src/lib/validation/hero-tile.test.ts`

**Interfaces:**
- Produces: `COLOR_THEMES`, `LINK_TYPES`, `heroTileCreateSchema`, `heroTileUpdateSchema`, `heroTileReorderSchema`, `HeroTileCreateInput`, `HeroTileUpdateInput` types — consumed by Task 2's service (types only) and Task 4's API routes.

- [ ] **Step 1: Write the validation module**

```typescript
// src/lib/validation/hero-tile.ts
import { z } from "zod";

export const COLOR_THEMES = ["sunrise", "ember", "citrus", "blossom", "ocean", "violet"] as const;
export const LINK_TYPES = ["category", "product", "collection", "search", "page", "custom_url"] as const;

// Relative path ("/catalog/pokemon") or absolute http(s) URL — same rule banners' cta_url uses.
const linkValue = z
  .string()
  .min(1, "Link value is required")
  .max(500)
  .refine(
    (v) => v.startsWith("/") || /^https?:\/\/.+/.test(v) || /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(v),
    "Link value must be a slug, a relative path, or an http(s) URL"
  );

const baseFields = {
  label: z.string().min(1, "Label is required").max(60),
  icon_emoji: z.string().min(1, "Icon is required").max(8),
  color_theme: z.enum(COLOR_THEMES).default("sunrise"),
  link_type: z.enum(LINK_TYPES).default("category"),
  link_value: linkValue,
  display_order: z.number().int().min(0).optional(),
  is_active: z.boolean().default(true),
};

export const heroTileCreateSchema = z.object(baseFields);

export const heroTileUpdateSchema = z
  .object(baseFields)
  .partial()
  .refine((d) => Object.keys(d).length > 0, "No fields to update");

export const heroTileReorderSchema = z.object({
  ids: z.array(z.string().uuid()).min(1, "ids required"),
});

export type HeroTileCreateInput = z.infer<typeof heroTileCreateSchema>;
export type HeroTileUpdateInput = z.infer<typeof heroTileUpdateSchema>;
```

- [ ] **Step 2: Write the validation test**

```typescript
// src/lib/validation/hero-tile.test.ts
import { heroTileCreateSchema, heroTileUpdateSchema, heroTileReorderSchema } from "@/lib/validation/hero-tile";

describe("hero-tile validation", () => {
  it("accepts a minimal valid create payload", () => {
    const result = heroTileCreateSchema.safeParse({
      label: "Pikachu",
      icon_emoji: "⚡",
      link_value: "pokemon",
    });
    expect(result.success).toBe(true);
  });

  it("rejects an empty label", () => {
    const result = heroTileCreateSchema.safeParse({ label: "", icon_emoji: "⚡", link_value: "pokemon" });
    expect(result.success).toBe(false);
  });

  it("rejects an unknown color_theme", () => {
    const result = heroTileCreateSchema.safeParse({
      label: "Pikachu",
      icon_emoji: "⚡",
      color_theme: "rainbow",
      link_value: "pokemon",
    });
    expect(result.success).toBe(false);
  });

  it("rejects an unknown link_type", () => {
    const result = heroTileCreateSchema.safeParse({
      label: "Pikachu",
      icon_emoji: "⚡",
      link_type: "playlist",
      link_value: "pokemon",
    });
    expect(result.success).toBe(false);
  });

  it("accepts a custom_url link_value that is a relative path", () => {
    const result = heroTileCreateSchema.safeParse({
      label: "About Us",
      icon_emoji: "ℹ️",
      link_type: "custom_url",
      link_value: "/about",
    });
    expect(result.success).toBe(true);
  });

  it("rejects an update payload with no fields", () => {
    const result = heroTileUpdateSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it("accepts a partial update payload", () => {
    const result = heroTileUpdateSchema.safeParse({ is_active: false });
    expect(result.success).toBe(true);
  });

  it("reorder schema requires at least one uuid", () => {
    expect(heroTileReorderSchema.safeParse({ ids: [] }).success).toBe(false);
    expect(heroTileReorderSchema.safeParse({ ids: ["not-a-uuid"] }).success).toBe(false);
  });
});
```

- [ ] **Step 3: Run the tests**

Run: `npx jest src/lib/validation/hero-tile.test.ts`
Expected: PASS (8 tests)

- [ ] **Step 4: Commit**

```bash
git add src/lib/validation/hero-tile.ts src/lib/validation/hero-tile.test.ts
git commit -m "feat: add hero tile validation schemas"
```

---

### Task 4: Admin API Routes

**Files:**
- Create: `src/app/api/admin/hero-tiles/route.ts`
- Create: `src/app/api/admin/hero-tiles/route.test.ts`
- Create: `src/app/api/admin/hero-tiles/[id]/route.ts`
- Create: `src/app/api/admin/hero-tiles/[id]/route.test.ts`
- Create: `src/app/api/admin/hero-tiles/reorder/route.ts`
- Create: `src/app/api/admin/hero-tiles/reorder/route.test.ts`

**Interfaces:**
- Consumes: `requireAdmin` (`@/lib/supabase/admin-auth`), `checkRateLimit`/`rateLimitResponse` (`@/lib/rate-limit`), `recordAuditLog` (`@/lib/services/audit-service`), Task 2's service exports, Task 3's schemas.
- Produces: `GET/POST /api/admin/hero-tiles`, `PATCH/DELETE /api/admin/hero-tiles/:id`, `POST /api/admin/hero-tiles/reorder` — consumed by Task 5's admin UI.

- [ ] **Step 1: Write the list/create route**

```typescript
// src/app/api/admin/hero-tiles/route.ts
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/supabase/admin-auth";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { recordAuditLog } from "@/lib/services/audit-service";
import { heroTileCreateSchema } from "@/lib/validation/hero-tile";
import { listAllHeroTiles, createHeroTile } from "@/lib/services/hero-tile-service";

export async function GET(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for") ?? "unknown";
  const rl = checkRateLimit(`hero-tiles:${ip}`, 60, 60_000);
  if (!rl.allowed) return rateLimitResponse(rl.resetAt);

  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  try {
    return NextResponse.json(await listAllHeroTiles());
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for") ?? "unknown";
  const rl = checkRateLimit(`hero-tiles:${ip}`, 60, 60_000);
  if (!rl.allowed) return rateLimitResponse(rl.resetAt);

  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const parsed = heroTileCreateSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  try {
    const created = await createHeroTile(parsed.data, auth.userId);
    await recordAuditLog({
      userId: auth.userId,
      action: "hero_tile.create",
      tableName: "hero_tiles",
      recordId: created.id,
      newValues: parsed.data,
    });
    return NextResponse.json(created, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Failed to create hero tile" }, { status: 500 });
  }
}
```

- [ ] **Step 2: Write the list/create route test**

```typescript
// src/app/api/admin/hero-tiles/route.test.ts
jest.mock("@/lib/supabase/admin-auth");
jest.mock("@/lib/rate-limit", () => ({
  checkRateLimit: jest.fn(() => ({ allowed: true })),
  rateLimitResponse: jest.fn(),
}));
jest.mock("@/lib/services/audit-service", () => ({ recordAuditLog: jest.fn() }));
jest.mock("@/lib/services/hero-tile-service");

import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/supabase/admin-auth";
import { recordAuditLog } from "@/lib/services/audit-service";
import { listAllHeroTiles, createHeroTile } from "@/lib/services/hero-tile-service";
import { GET, POST } from "./route";

const adminAuth = { ok: true as const, userId: "admin-1" };

function req(body?: unknown) {
  return new NextRequest("http://localhost/api/admin/hero-tiles", {
    method: body ? "POST" : "GET",
    body: body ? JSON.stringify(body) : undefined,
  });
}

describe("GET /api/admin/hero-tiles", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns 401 when not authenticated", async () => {
    (requireAdmin as jest.Mock).mockResolvedValue({
      ok: false,
      response: new Response(null, { status: 401 }),
    });
    const res = await GET(req());
    expect(res.status).toBe(401);
  });

  it("returns the tile list for an authenticated admin", async () => {
    (requireAdmin as jest.Mock).mockResolvedValue(adminAuth);
    (listAllHeroTiles as jest.Mock).mockResolvedValue([{ id: "t1" }]);
    const res = await GET(req());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([{ id: "t1" }]);
  });
});

describe("POST /api/admin/hero-tiles", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns 401 when not authenticated", async () => {
    (requireAdmin as jest.Mock).mockResolvedValue({
      ok: false,
      response: new Response(null, { status: 401 }),
    });
    const res = await POST(req({ label: "Pikachu", icon_emoji: "⚡", link_value: "pokemon" }));
    expect(res.status).toBe(401);
  });

  it("returns 403 when authenticated but not admin", async () => {
    (requireAdmin as jest.Mock).mockResolvedValue({
      ok: false,
      response: new Response(null, { status: 403 }),
    });
    const res = await POST(req({ label: "Pikachu", icon_emoji: "⚡", link_value: "pokemon" }));
    expect(res.status).toBe(403);
  });

  it("returns 400 on an invalid payload", async () => {
    (requireAdmin as jest.Mock).mockResolvedValue(adminAuth);
    const res = await POST(req({ label: "" }));
    expect(res.status).toBe(400);
  });

  it("creates a tile, records an audit log with the exact payload, and returns 201", async () => {
    (requireAdmin as jest.Mock).mockResolvedValue(adminAuth);
    const created = { id: "t1", label: "Pikachu", icon_emoji: "⚡", link_type: "category", link_value: "pokemon" };
    (createHeroTile as jest.Mock).mockResolvedValue(created);

    const res = await POST(req({ label: "Pikachu", icon_emoji: "⚡", link_value: "pokemon" }));

    expect(res.status).toBe(201);
    expect(await res.json()).toEqual(created);
    expect(recordAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: "hero_tile.create", recordId: "t1" })
    );
  });
});
```

- [ ] **Step 3: Write the single-tile route**

```typescript
// src/app/api/admin/hero-tiles/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/supabase/admin-auth";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { recordAuditLog } from "@/lib/services/audit-service";
import { heroTileUpdateSchema } from "@/lib/validation/hero-tile";
import { updateHeroTileById, deleteHeroTile } from "@/lib/services/hero-tile-service";

type RouteParams = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const ip = req.headers.get("x-forwarded-for") ?? "unknown";
  const rl = checkRateLimit(`hero-tiles:${ip}`, 60, 60_000);
  if (!rl.allowed) return rateLimitResponse(rl.resetAt);

  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const parsed = heroTileUpdateSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  try {
    const updated = await updateHeroTileById(id, parsed.data, auth.userId);
    if (!updated) return NextResponse.json({ error: "Hero tile not found" }, { status: 404 });

    await recordAuditLog({
      userId: auth.userId,
      action: "hero_tile.update",
      tableName: "hero_tiles",
      recordId: id,
      newValues: parsed.data,
    });
    return NextResponse.json(updated);
  } catch {
    return NextResponse.json({ error: "Failed to update hero tile" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: RouteParams) {
  const ip = req.headers.get("x-forwarded-for") ?? "unknown";
  const rl = checkRateLimit(`hero-tiles:${ip}`, 60, 60_000);
  if (!rl.allowed) return rateLimitResponse(rl.resetAt);

  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const { id } = await params;
  try {
    const deleted = await deleteHeroTile(id, auth.userId);
    if (!deleted) return NextResponse.json({ error: "Hero tile not found" }, { status: 404 });

    await recordAuditLog({
      userId: auth.userId,
      action: "hero_tile.delete",
      tableName: "hero_tiles",
      recordId: id,
    });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Failed to delete hero tile" }, { status: 500 });
  }
}
```

- [ ] **Step 4: Write the single-tile route test**

```typescript
// src/app/api/admin/hero-tiles/[id]/route.test.ts
jest.mock("@/lib/supabase/admin-auth");
jest.mock("@/lib/rate-limit", () => ({
  checkRateLimit: jest.fn(() => ({ allowed: true })),
  rateLimitResponse: jest.fn(),
}));
jest.mock("@/lib/services/audit-service", () => ({ recordAuditLog: jest.fn() }));
jest.mock("@/lib/services/hero-tile-service");

import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/supabase/admin-auth";
import { recordAuditLog } from "@/lib/services/audit-service";
import { updateHeroTileById, deleteHeroTile } from "@/lib/services/hero-tile-service";
import { PATCH, DELETE } from "./route";

const adminAuth = { ok: true as const, userId: "admin-1" };
const params = Promise.resolve({ id: "t1" });

function patchReq(body: unknown) {
  return new NextRequest("http://localhost/api/admin/hero-tiles/t1", {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}
function deleteReq() {
  return new NextRequest("http://localhost/api/admin/hero-tiles/t1", { method: "DELETE" });
}

describe("PATCH /api/admin/hero-tiles/:id", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns 401 when not authenticated", async () => {
    (requireAdmin as jest.Mock).mockResolvedValue({ ok: false, response: new Response(null, { status: 401 }) });
    const res = await PATCH(patchReq({ is_active: false }), { params });
    expect(res.status).toBe(401);
  });

  it("returns 404 when the tile does not exist", async () => {
    (requireAdmin as jest.Mock).mockResolvedValue(adminAuth);
    (updateHeroTileById as jest.Mock).mockResolvedValue(null);
    const res = await PATCH(patchReq({ is_active: false }), { params });
    expect(res.status).toBe(404);
  });

  it("updates the tile, records the audit log, and returns 200", async () => {
    (requireAdmin as jest.Mock).mockResolvedValue(adminAuth);
    (updateHeroTileById as jest.Mock).mockResolvedValue({ id: "t1", is_active: false });

    const res = await PATCH(patchReq({ is_active: false }), { params });

    expect(res.status).toBe(200);
    expect(recordAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: "hero_tile.update", recordId: "t1" })
    );
  });
});

describe("DELETE /api/admin/hero-tiles/:id", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns 401 when not authenticated", async () => {
    (requireAdmin as jest.Mock).mockResolvedValue({ ok: false, response: new Response(null, { status: 401 }) });
    const res = await DELETE(deleteReq(), { params });
    expect(res.status).toBe(401);
  });

  it("returns 404 when the tile does not exist", async () => {
    (requireAdmin as jest.Mock).mockResolvedValue(adminAuth);
    (deleteHeroTile as jest.Mock).mockResolvedValue(false);
    const res = await DELETE(deleteReq(), { params });
    expect(res.status).toBe(404);
  });

  it("soft-deletes the tile and records the audit log", async () => {
    (requireAdmin as jest.Mock).mockResolvedValue(adminAuth);
    (deleteHeroTile as jest.Mock).mockResolvedValue(true);

    const res = await DELETE(deleteReq(), { params });

    expect(res.status).toBe(200);
    expect(recordAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: "hero_tile.delete", recordId: "t1" })
    );
  });
});
```

- [ ] **Step 5: Write the reorder route**

```typescript
// src/app/api/admin/hero-tiles/reorder/route.ts
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/supabase/admin-auth";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { recordAuditLog } from "@/lib/services/audit-service";
import { heroTileReorderSchema } from "@/lib/validation/hero-tile";
import { reorder } from "@/lib/services/hero-tile-service";

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for") ?? "unknown";
  const rl = checkRateLimit(`hero-tiles:${ip}`, 60, 60_000);
  if (!rl.allowed) return rateLimitResponse(rl.resetAt);

  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const parsed = heroTileReorderSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  try {
    await reorder(parsed.data.ids, auth.userId);
    await recordAuditLog({
      userId: auth.userId,
      action: "hero_tile.reorder",
      tableName: "hero_tiles",
      newValues: { ids: parsed.data.ids },
    });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Failed to reorder hero tiles" }, { status: 500 });
  }
}
```

- [ ] **Step 6: Write the reorder route test**

```typescript
// src/app/api/admin/hero-tiles/reorder/route.test.ts
jest.mock("@/lib/supabase/admin-auth");
jest.mock("@/lib/rate-limit", () => ({
  checkRateLimit: jest.fn(() => ({ allowed: true })),
  rateLimitResponse: jest.fn(),
}));
jest.mock("@/lib/services/audit-service", () => ({ recordAuditLog: jest.fn() }));
jest.mock("@/lib/services/hero-tile-service");

import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/supabase/admin-auth";
import { reorder } from "@/lib/services/hero-tile-service";
import { POST } from "./route";

const adminAuth = { ok: true as const, userId: "admin-1" };
const VALID_ID = "11111111-1111-1111-1111-111111111111";

function req(body: unknown) {
  return new NextRequest("http://localhost/api/admin/hero-tiles/reorder", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

describe("POST /api/admin/hero-tiles/reorder", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns 401 when not authenticated", async () => {
    (requireAdmin as jest.Mock).mockResolvedValue({ ok: false, response: new Response(null, { status: 401 }) });
    const res = await POST(req({ ids: [VALID_ID] }));
    expect(res.status).toBe(401);
  });

  it("returns 400 when ids is empty", async () => {
    (requireAdmin as jest.Mock).mockResolvedValue(adminAuth);
    const res = await POST(req({ ids: [] }));
    expect(res.status).toBe(400);
  });

  it("reorders and returns success", async () => {
    (requireAdmin as jest.Mock).mockResolvedValue(adminAuth);
    const res = await POST(req({ ids: [VALID_ID] }));
    expect(res.status).toBe(200);
    expect(reorder).toHaveBeenCalledWith([VALID_ID], "admin-1");
  });
});
```

- [ ] **Step 7: Run the tests**

Run: `npx jest src/app/api/admin/hero-tiles`
Expected: PASS (13 tests across 3 files)

- [ ] **Step 8: Commit**

```bash
git add src/app/api/admin/hero-tiles
git commit -m "feat: add hero tile admin API routes (CRUD + reorder)"
```

---

### Task 5: Admin UI — Hero Tiles Page

**Files:**
- Create: `src/app/admin/marketing/hero-tiles/page.tsx`
- Create: `src/app/admin/marketing/hero-tiles/hero-tiles-table.tsx`
- Create: `src/app/admin/marketing/hero-tiles/hero-tile-form-dialog.tsx`
- Modify: `src/components/admin/admin-sidebar.tsx`

**Interfaces:**
- Consumes: `listAllHeroTiles` (`@/lib/services/hero-tile-service`), `listAllCategories` (`@/lib/services/catalog-service`, for the category picker — reuse rather than re-fetch categories a different way), the `/api/admin/hero-tiles*` routes from Task 4, `COLOR_THEMES`/`LINK_TYPES` from Task 3's validation module.
- Produces: the `/admin/marketing/hero-tiles` admin page and a new sidebar nav entry.

- [ ] **Step 1: Check `catalog-service` exports a category list function admins can use**

Run: `grep -n "export async function listAllCategories\|export async function getCategoryTreeForAdmin" src/lib/services/catalog-service.ts`
Expected: at least one of these exists (both were added during the Category CMS work). Use whichever returns a flat list of `{ id, name, slug }` — if only the tree function exists, flatten it in Step 2 with a small recursive helper local to `page.tsx`.

- [ ] **Step 2: Write the page**

```typescript
// src/app/admin/marketing/hero-tiles/page.tsx
import { listAllHeroTiles } from "@/lib/services/hero-tile-service";
import { getCategoryTreeForAdmin } from "@/lib/services/catalog-service";
import HeroTilesTable from "./hero-tiles-table";
import type { Category } from "@/types";

function flattenCategories(nodes: Category[]): { id: string; name: string; slug: string }[] {
  const out: { id: string; name: string; slug: string }[] = [];
  for (const node of nodes) {
    out.push({ id: node.id, name: node.name, slug: node.slug });
    const children = (node as Category & { children?: Category[] }).children;
    if (children?.length) out.push(...flattenCategories(children));
  }
  return out;
}

export default async function HeroTilesPage() {
  const [tiles, categoryTree] = await Promise.all([listAllHeroTiles(), getCategoryTreeForAdmin()]);
  const categories = flattenCategories(categoryTree as unknown as Category[]);

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Homepage Hero Tiles</h1>
        <p className="text-sm text-muted-foreground">
          The floating tiles shown in the homepage hero section. Reorder by dragging, link them
          anywhere, hide or delete as needed.
        </p>
      </div>
      <HeroTilesTable initialTiles={tiles} categories={categories} />
    </div>
  );
}
```

- [ ] **Step 3: Write the table component**

```typescript
// src/app/admin/marketing/hero-tiles/hero-tiles-table.tsx
"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Pencil, Trash2, Eye, EyeOff, Plus } from "lucide-react";
import type { HeroTileRow } from "@/lib/services/hero-tile-service";
import HeroTileFormDialog from "./hero-tile-form-dialog";

async function apiRequest(path: string, options?: RequestInit) {
  const res = await fetch(path, {
    ...options,
    headers: { "Content-Type": "application/json", ...options?.headers },
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body.error || "Request failed");
  return body;
}

export default function HeroTilesTable({
  initialTiles,
  categories,
}: {
  initialTiles: HeroTileRow[];
  categories: { id: string; name: string; slug: string }[];
}) {
  const [rows, setRows] = useState(initialTiles);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<HeroTileRow | null>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);

  const openCreate = () => {
    setEditing(null);
    setDialogOpen(true);
  };
  const openEdit = (tile: HeroTileRow) => {
    setEditing(tile);
    setDialogOpen(true);
  };

  const onSaved = (tile: HeroTileRow) => {
    setRows((prev) => {
      const exists = prev.some((r) => r.id === tile.id);
      return exists ? prev.map((r) => (r.id === tile.id ? tile : r)) : [...prev, tile];
    });
  };

  const toggleActive = async (tile: HeroTileRow) => {
    setPendingId(tile.id);
    try {
      const updated = await apiRequest(`/api/admin/hero-tiles/${tile.id}`, {
        method: "PATCH",
        body: JSON.stringify({ is_active: !tile.is_active }),
      });
      setRows((prev) => prev.map((r) => (r.id === tile.id ? updated : r)));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update tile");
    } finally {
      setPendingId(null);
    }
  };

  const remove = async (tile: HeroTileRow) => {
    if (!confirm(`Delete "${tile.label}"? This can't be undone from the admin panel.`)) return;
    setPendingId(tile.id);
    try {
      await apiRequest(`/api/admin/hero-tiles/${tile.id}`, { method: "DELETE" });
      setRows((prev) => prev.filter((r) => r.id !== tile.id));
      toast.success("Hero tile deleted");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete tile");
    } finally {
      setPendingId(null);
    }
  };

  const onDrop = async (targetIndex: number) => {
    if (dragIndex === null || dragIndex === targetIndex) {
      setDragIndex(null);
      return;
    }
    const reordered = [...rows];
    const [moved] = reordered.splice(dragIndex, 1);
    reordered.splice(targetIndex, 0, moved);
    setRows(reordered);
    setDragIndex(null);
    try {
      await apiRequest("/api/admin/hero-tiles/reorder", {
        method: "POST",
        body: JSON.stringify({ ids: reordered.map((r) => r.id) }),
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to reorder tiles");
      setRows(initialTiles);
    }
  };

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <button
          onClick={openCreate}
          className="inline-flex items-center gap-2 bg-primary hover:bg-primary/90 text-white font-semibold px-4 py-2 rounded-xl text-sm"
        >
          <Plus className="w-4 h-4" />
          New Tile
        </button>
      </div>

      <div className="space-y-2">
        {rows.map((tile, i) => (
          <div
            key={tile.id}
            draggable
            onDragStart={() => setDragIndex(i)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => onDrop(i)}
            className="flex items-center gap-4 bg-card border border-border rounded-xl p-4"
          >
            <span className="text-2xl" aria-hidden="true">
              {tile.icon_emoji}
            </span>
            <div className="flex-1">
              <p className="font-semibold text-foreground">{tile.label}</p>
              <p className="text-xs text-muted-foreground">
                {tile.link_type} → {tile.link_value}
              </p>
            </div>
            <button
              onClick={() => toggleActive(tile)}
              disabled={pendingId === tile.id}
              className="p-2 text-muted-foreground hover:text-foreground"
              aria-label={tile.is_active ? "Hide tile" : "Show tile"}
            >
              {tile.is_active ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
            </button>
            <button
              onClick={() => openEdit(tile)}
              className="p-2 text-muted-foreground hover:text-foreground"
              aria-label="Edit tile"
            >
              <Pencil className="w-4 h-4" />
            </button>
            <button
              onClick={() => remove(tile)}
              disabled={pendingId === tile.id}
              className="p-2 text-muted-foreground hover:text-destructive"
              aria-label="Delete tile"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}
        {rows.length === 0 && (
          <p className="text-sm text-muted-foreground py-8 text-center">
            No hero tiles yet. The homepage falls back to its default tiles until you add one.
          </p>
        )}
      </div>

      <HeroTileFormDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        editing={editing}
        categories={categories}
        onSaved={onSaved}
      />
    </div>
  );
}
```

- [ ] **Step 4: Write the form dialog component**

```typescript
// src/app/admin/marketing/hero-tiles/hero-tile-form-dialog.tsx
"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { X } from "lucide-react";
import type { HeroTileRow } from "@/lib/services/hero-tile-service";
import { COLOR_THEMES, LINK_TYPES } from "@/lib/validation/hero-tile";

type Category = { id: string; name: string; slug: string };

const EMPTY_FORM = {
  label: "",
  icon_emoji: "",
  color_theme: "sunrise" as (typeof COLOR_THEMES)[number],
  link_type: "category" as (typeof LINK_TYPES)[number],
  link_value: "",
  is_active: true,
};

type FormState = typeof EMPTY_FORM;

async function apiRequest(path: string, options?: RequestInit) {
  const res = await fetch(path, {
    ...options,
    headers: { "Content-Type": "application/json", ...options?.headers },
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body.error || "Request failed");
  return body;
}

export default function HeroTileFormDialog({
  open,
  onClose,
  editing,
  categories,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  editing: HeroTileRow | null;
  categories: Category[];
  onSaved: (tile: HeroTileRow) => void;
}) {
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (editing) {
      setForm({
        label: editing.label,
        icon_emoji: editing.icon_emoji,
        color_theme: editing.color_theme,
        link_type: editing.link_type,
        link_value: editing.link_value,
        is_active: editing.is_active,
      });
    } else {
      setForm(EMPTY_FORM);
    }
  }, [editing, open]);

  if (!open) return null;

  const submit = async () => {
    setSaving(true);
    try {
      const saved = editing
        ? await apiRequest(`/api/admin/hero-tiles/${editing.id}`, {
            method: "PATCH",
            body: JSON.stringify(form),
          })
        : await apiRequest("/api/admin/hero-tiles", {
            method: "POST",
            body: JSON.stringify(form),
          });
      onSaved(saved);
      toast.success(editing ? "Tile updated" : "Tile created");
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save tile");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-card border border-border rounded-2xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-foreground">{editing ? "Edit Tile" : "New Tile"}</h2>
          <button onClick={onClose} aria-label="Close">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-foreground">Label</label>
            <input
              value={form.label}
              onChange={(e) => setForm({ ...form, label: e.target.value })}
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              placeholder="e.g., Pikachu"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-foreground">Icon (emoji)</label>
            <input
              value={form.icon_emoji}
              onChange={(e) => setForm({ ...form, icon_emoji: e.target.value })}
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              placeholder="⚡"
              maxLength={8}
            />
          </div>

          <div>
            <label className="text-sm font-medium text-foreground">Color Theme</label>
            <select
              value={form.color_theme}
              onChange={(e) => setForm({ ...form, color_theme: e.target.value as FormState["color_theme"] })}
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            >
              {COLOR_THEMES.map((theme) => (
                <option key={theme} value={theme}>
                  {theme}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-sm font-medium text-foreground">Link Type</label>
            <select
              value={form.link_type}
              onChange={(e) =>
                setForm({ ...form, link_type: e.target.value as FormState["link_type"], link_value: "" })
              }
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            >
              {LINK_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </div>

          {form.link_type === "category" ? (
            <div>
              <label className="text-sm font-medium text-foreground">Category</label>
              <select
                value={form.link_value}
                onChange={(e) => setForm({ ...form, link_value: e.target.value })}
                className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              >
                <option value="">Select a category…</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.slug}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div>
              <label className="text-sm font-medium text-foreground">
                {form.link_type === "custom_url" ? "URL or path" : "Link value"}
              </label>
              <input
                value={form.link_value}
                onChange={(e) => setForm({ ...form, link_value: e.target.value })}
                className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                placeholder={form.link_type === "custom_url" ? "/about" : "slug or path"}
              />
            </div>
          )}

          <label className="flex items-center gap-2 text-sm text-foreground">
            <input
              type="checkbox"
              checked={form.is_active}
              onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
            />
            Active (visible on the homepage)
          </label>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={saving || !form.label || !form.icon_emoji || !form.link_value}
            className="px-4 py-2 rounded-xl text-sm font-semibold bg-primary text-white disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Add the sidebar nav entry**

In `src/components/admin/admin-sidebar.tsx`, add `Sparkles` to the `lucide-react` import list and insert a new nav item directly after the `Homepage Banners` entry:

```typescript
// import line — add Sparkles to the existing destructured import:
import {
  LayoutDashboard, Package, Tag, ShoppingBag, Wallet,
  Users, BarChart3, Settings, Zap, ChevronRight, Shield, HelpCircle, Megaphone, Palette, Image, Sparkles
} from "lucide-react";
```

```typescript
// navItems array — insert after the "/admin/marketing/banners" entry:
  { href: "/admin/marketing/banners", label: "Homepage Banners", icon: Image },
  { href: "/admin/marketing/hero-tiles", label: "Hero Tiles", icon: Sparkles },
```

- [ ] **Step 6: Manually verify in the dev server**

Run: `npm run dev`, sign in as an admin, visit `/admin/marketing/hero-tiles`. Confirm: the page loads, "New Tile" opens the dialog, creating a tile with link type "category" shows the category dropdown, saving adds it to the list, drag-reorder persists after a page refresh, the eye icon toggles visibility, and delete removes it after confirmation.

- [ ] **Step 7: Commit**

```bash
git add src/app/admin/marketing/hero-tiles src/components/admin/admin-sidebar.tsx
git commit -m "feat: add admin UI for managing homepage hero tiles"
```

---

### Task 6: Frontend — Wire HeroSection to Dynamic Tiles

**Files:**
- Modify: `src/components/home/hero-section.tsx`
- Test: `src/components/home/hero-section.test.tsx`

**Interfaces:**
- Consumes: `resolveHeroTileHref` and `HeroTileLinkFields` from `@/lib/utils/hero-tile-link` (Task 2 — **not** `@/lib/services/hero-tile-service`; that module transitively imports the server-only repository and must never be value-imported into a "use client" component).
- Produces: `HeroSection` now takes a `tiles: HeroTileDisplay[]` prop; falls back to 4 default, real-category-linked tiles when the array is empty.

- [ ] **Step 1: Write the failing test**

```typescript
// src/components/home/hero-section.test.tsx
import { render, screen } from "@testing-library/react";
import HeroSection from "./hero-section";

describe("HeroSection", () => {
  it("renders each tile as a link to its resolved href", () => {
    render(
      <HeroSection
        tiles={[
          {
            id: "t1",
            label: "Ash",
            icon_emoji: "🎒",
            color_theme: "sunrise",
            link_type: "category",
            link_value: "pokemon",
            display_order: 0,
            is_active: true,
          },
        ]}
      />
    );
    const link = screen.getByRole("link", { name: /ash/i });
    expect(link).toHaveAttribute("href", "/catalog/pokemon");
  });

  it("falls back to the 4 default tiles, each linking to a real category, when given an empty array", () => {
    render(<HeroSection tiles={[]} />);
    expect(screen.getByRole("link", { name: /pikachu/i })).toHaveAttribute("href", "/catalog/pokemon");
    expect(screen.getByRole("link", { name: /goku/i })).toHaveAttribute("href", "/catalog/dragon-ball-z");
    expect(screen.getByRole("link", { name: /naruto/i })).toHaveAttribute("href", "/catalog/naruto");
    expect(screen.getByRole("link", { name: /luffy/i })).toHaveAttribute("href", "/catalog/one-piece");
  });

  it("skips inactive tiles", () => {
    render(
      <HeroSection
        tiles={[
          {
            id: "t1",
            label: "Hidden",
            icon_emoji: "🙈",
            color_theme: "sunrise",
            link_type: "category",
            link_value: "pokemon",
            display_order: 0,
            is_active: false,
          },
        ]}
      />
    );
    expect(screen.queryByText("Hidden")).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/components/home/hero-section.test.tsx`
Expected: FAIL — `HeroSection` doesn't currently accept a `tiles` prop, and none of the current tiles are `<Link>` elements.

- [ ] **Step 3: Rewrite the component**

```typescript
// src/components/home/hero-section.tsx
"use client";

import Link from "next/link";
import { ArrowRight, Sparkles, Shield, Zap } from "lucide-react";
import { motion } from "framer-motion";
import { resolveHeroTileHref, type HeroTileLinkFields } from "@/lib/utils/hero-tile-link";

const features = [
  { icon: Shield, label: "100% Authentic" },
  { icon: Zap, label: "Fast Delivery" },
  { icon: Sparkles, label: "Premium Quality" },
];

// Tailwind's JIT compiler only includes class names it finds as literal strings in
// source — a class string built dynamically from DB data would silently not render.
// color_theme is stored as a key; this is the only place that maps it to real classes.
const COLOR_THEME_CLASSES: Record<string, string> = {
  sunrise: "from-yellow-400 to-orange-500",
  ember: "from-orange-400 to-red-500",
  citrus: "from-orange-500 to-yellow-600",
  blossom: "from-red-500 to-pink-600",
  ocean: "from-blue-400 to-cyan-500",
  violet: "from-purple-400 to-indigo-500",
};

export interface HeroTileDisplay extends HeroTileLinkFields {
  id: string;
  label: string;
  icon_emoji: string;
  color_theme: string;
  display_order: number;
  is_active: boolean;
}

// Rendered when no admin-managed tiles exist yet (fresh deploy, migration not applied,
// or the admin hasn't added any) — same "never leave the homepage broken" precedent as
// getHomepageBanners/getHomepageNotifications, but these still resolve to real category
// links rather than being decorative dead ends.
const DEFAULT_TILES: HeroTileDisplay[] = [
  { id: "default-pikachu", label: "Pikachu", icon_emoji: "⚡", color_theme: "sunrise", link_type: "category", link_value: "pokemon", display_order: 0, is_active: true },
  { id: "default-goku", label: "Goku", icon_emoji: "🐉", color_theme: "ember", link_type: "category", link_value: "dragon-ball-z", display_order: 1, is_active: true },
  { id: "default-naruto", label: "Naruto", icon_emoji: "🍃", color_theme: "citrus", link_type: "category", link_value: "naruto", display_order: 2, is_active: true },
  { id: "default-luffy", label: "Luffy", icon_emoji: "⚓", color_theme: "blossom", link_type: "category", link_value: "one-piece", display_order: 3, is_active: true },
];

export default function HeroSection({ tiles }: { tiles: HeroTileDisplay[] }) {
  const activeTiles = (tiles.length > 0 ? tiles : DEFAULT_TILES)
    .filter((t) => t.is_active)
    .slice(0, 4);

  return (
    <section className="relative min-h-screen flex items-center overflow-hidden hero-gradient">
      {/* Background glows */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/20 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-orange-500/5 rounded-full blur-3xl" />
      </div>

      {/* Grid pattern */}
      <div
        className="absolute inset-0 opacity-5"
        style={{
          backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
          backgroundSize: "50px 50px",
        }}
      />

      <div className="container-max px-4 md:px-8 w-full relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center py-20">
          {/* Left content */}
          <div className="text-center lg:text-left">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/30 text-primary text-xs font-semibold mb-6">
                <Sparkles className="w-3 h-3" />
                India&apos;s #1 Collectible Marketplace
              </span>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="text-4xl md:text-5xl lg:text-6xl font-bold text-white leading-tight mb-4"
            >
              Collect The{" "}
              <span className="text-gradient">Stories</span>
              {" "}That{" "}
              <span className="text-gradient">Shaped</span>
              {" "}Generations.
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="text-lg text-white/70 mb-8 max-w-lg mx-auto lg:mx-0"
            >
              Pokémon, Dragon Ball Z, Naruto, One Piece — your favourite anime
              card collections, delivered across India.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start mb-10"
            >
              <Link
                href="/catalog"
                className="inline-flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 text-white font-semibold px-8 py-4 rounded-xl transition-all duration-200 active:scale-95 text-base shadow-lg shadow-primary/30"
              >
                Shop Now
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                href="/about"
                className="inline-flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 text-white font-semibold px-8 py-4 rounded-xl transition-all duration-200 border border-white/20 text-base"
              >
                Our Story
              </Link>
            </motion.div>

            {/* Feature badges */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.4 }}
              className="flex flex-wrap gap-4 justify-center lg:justify-start"
            >
              {features.map(({ icon: Icon, label }) => (
                <div
                  key={label}
                  className="flex items-center gap-2 text-white/60 text-sm"
                >
                  <Icon className="w-4 h-4 text-primary" />
                  {label}
                </div>
              ))}
            </motion.div>
          </div>

          {/* Right — floating card grid */}
          <div className="relative hidden lg:block">
            <div className="grid grid-cols-2 gap-4 max-w-sm mx-auto">
              {activeTiles.map((tile, i) => (
                <motion.div
                  key={tile.id}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.5, delay: 0.3 + i * 0.2 }}
                  className="animate-float"
                  style={{ animationDelay: `${i * 0.2}s` }}
                >
                  <Link
                    href={resolveHeroTileHref(tile)}
                    className={`block bg-gradient-to-br ${COLOR_THEME_CLASSES[tile.color_theme] ?? COLOR_THEME_CLASSES.sunrise} rounded-2xl p-6 flex flex-col items-center justify-center aspect-square shadow-2xl border border-white/20 transition-transform hover:scale-105`}
                  >
                    <span className="text-4xl mb-2">{tile.icon_emoji}</span>
                    <span className="text-white font-bold text-sm">{tile.label}</span>
                  </Link>
                </motion.div>
              ))}
            </div>

            {/* Stats overlay */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 0.8 }}
              className="absolute -bottom-4 -left-4 bg-background/90 backdrop-blur-sm border border-border rounded-2xl p-4 shadow-xl"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Sparkles className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Happy Collectors</p>
                  <p className="font-bold text-foreground">10,000+</p>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </div>

      {/* Bottom fade */}
      <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-background to-transparent" />
    </section>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/components/home/hero-section.test.tsx`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add src/components/home/hero-section.tsx src/components/home/hero-section.test.tsx
git commit -m "feat: make homepage hero tiles clickable and CMS-driven"
```

---

### Task 7: Wire the Homepage Page to the Hero Tile Feed

**Files:**
- Modify: `src/app/(shop)/page.tsx`

**Interfaces:**
- Consumes: `getHomepageHeroTiles` from `@/lib/services/hero-tile-service` (Task 2).

- [ ] **Step 1: Add the import**

In `src/app/(shop)/page.tsx`, add alongside the existing service imports:

```typescript
import { getHomepageHeroTiles } from "@/lib/services/hero-tile-service";
```

- [ ] **Step 2: Fetch tiles in parallel with the other homepage data**

Change the `Promise.all` destructure and array to include `heroTiles`:

```typescript
  const [notifications, banners, heroTiles, categories, { data: featured }, { data: latest }] =
    await Promise.all([
      getHomepageNotifications("both"),
      getHomepageBanners(),
      getHomepageHeroTiles(),
      // Admin-managed: honors show_on_homepage + display_order, cached with tag revalidation
      getHomepageCategories(),
      applyProductSort(
        supabase
          .from("products")
          .select("*")
          .eq("is_featured", true)
          .eq("is_active", true),
        "featured"
      ).limit(8),
      supabase
        .from("products")
        .select("*, category:categories(*)")
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(8),
    ]);
```

- [ ] **Step 3: Pass tiles to `HeroSection`**

```typescript
      <AnnouncementBar items={notifications.items} config={notifications.config} />
      <HeroSection tiles={heroTiles} />
      <BannerCarousel banners={banners} />
```

- [ ] **Step 4: Manually verify**

Run: `npm run dev`, load `/`. Confirm the 4 hero tiles render, are clickable, and (with no rows in `hero_tiles` yet) route to `/catalog/pokemon`, `/catalog/dragon-ball-z`, `/catalog/naruto`, `/catalog/one-piece` respectively — matching the default fallback.

- [ ] **Step 5: Commit**

```bash
git add "src/app/(shop)/page.tsx"
git commit -m "feat: fetch and render homepage hero tiles from the CMS feed"
```

---

### Task 8: Regression Test — Storefront Feed Never Breaks the Homepage Pre-Migration

**Files:**
- Test: `src/lib/services/hero-tile-service.integration.test.ts`

**Interfaces:**
- Consumes: `hero-tile-service.ts` (Task 2), mocked `hero-tile-repository.ts`.

Task 2 Step 2 (`hero-tile-link.test.ts`) already proves link resolution is generic and franchise-agnostic — do not duplicate that here. This test exists to prove the storefront feed genuinely cannot crash the homepage, the same class of bug that caused today's `/admin/categories` outage (migration written but not yet applied live).

- [ ] **Step 1: Write the test**

```typescript
// src/lib/services/hero-tile-service.integration.test.ts
jest.mock("@/lib/repositories/hero-tile-repository", () => ({
  listHeroTiles: jest.fn(),
  listActiveHeroTiles: jest.fn(),
  getHeroTile: jest.fn(),
  getMaxDisplayOrder: jest.fn(),
  insertHeroTile: jest.fn(),
  updateHeroTile: jest.fn(),
  softDeleteHeroTile: jest.fn(),
  reorderHeroTiles: jest.fn(),
}));

import * as repo from "@/lib/repositories/hero-tile-repository";
import { getHomepageHeroTiles } from "@/lib/services/hero-tile-service";

describe("hero-tile-service — storefront feed resilience", () => {
  beforeEach(() => jest.clearAllMocks());

  it("the storefront feed returns an empty array (not a throw) when the table doesn't exist yet", async () => {
    // Simulates migration 013 not yet being applied live — PostgREST 400s on a
    // missing table/column, exactly like the migration-012 outage this session fixed.
    (repo.listActiveHeroTiles as jest.Mock).mockRejectedValue(
      new Error("Failed to list active hero tiles: 400")
    );

    await expect(getHomepageHeroTiles()).resolves.toEqual([]);
  });

  it("the storefront feed returns an empty array when Supabase is unreachable", async () => {
    (repo.listActiveHeroTiles as jest.Mock).mockRejectedValue(new TypeError("fetch failed"));
    await expect(getHomepageHeroTiles()).resolves.toEqual([]);
  });
});
```

- [ ] **Step 2: Run the test**

Run: `npx jest src/lib/services/hero-tile-service.integration.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 3: Run the full test suite**

Run: `npm test`
Expected: PASS, 0 failures, no regressions in previously-passing suites.

- [ ] **Step 4: Commit**

```bash
git add src/lib/services/hero-tile-service.integration.test.ts
git commit -m "test: prove hero tile link resolution is generic and the storefront feed never throws"
```

---

### Task 9: Documentation

**Files:**
- Modify: `ROADMAP.md`
- Modify: `AI_MEMORY.md`
- Modify: `CHANGELOG.md`
- Modify: `API.md`
- Modify: `DATABASE.md`
- Modify: `update.md`
- Modify: `TASKS.md`

- [ ] **Step 1: Update `ROADMAP.md`**

Mark the Phase 4 homepage hero tiles row (or add one if the sprint's phase table doesn't already have it) as complete, and remove the "generic internal linking" bullet from the "Future Enhancements (documented, not built)" section — it's now implemented, not just planned. Add one line noting `hero_tiles` is the first table using the `link_type`/`link_value` model.

- [ ] **Step 2: Update `AI_MEMORY.md`**

Add a gotcha: "Tailwind JIT and DB-driven class names — never build a Tailwind class string from database data; map a stored key to a literal class string through a lookup object physically present in source, or the class won't be included in the production build. See `COLOR_THEME_CLASSES` in `hero-section.tsx`."

- [ ] **Step 3: Update `CHANGELOG.md`**

Add an entry: "Added: Homepage hero tiles are now admin-managed (`/admin/marketing/hero-tiles`) — add, edit, reorder, hide, or delete the floating hero tiles without a deploy. Fixed: the 4 hero tiles were previously hardcoded and not clickable."

- [ ] **Step 4: Update `API.md`**

Document the 5 new endpoints: `GET/POST /api/admin/hero-tiles`, `PATCH/DELETE /api/admin/hero-tiles/:id`, `POST /api/admin/hero-tiles/reorder` — request/response shape matching the existing banners section's documentation style.

- [ ] **Step 5: Update `DATABASE.md`**

Document the `hero_tiles` table (columns, RLS policies, the `deleted_at IS NULL` convention) and add migration `013_hero_tiles.sql` to the migrations list, following the exact format used for `banners` and `categories`.

- [ ] **Step 6: Update `update.md`**

Add a deploy-order warning identical in spirit to the migration-012 one: "Migration 013 (`hero_tiles`) must be applied via the Supabase SQL Editor before deploying this branch. Unlike the categories migration, missing this one does **not** break the homepage — `getHomepageHeroTiles()` catches the failure and the hero section falls back to its 4 default tiles — but the new `/admin/marketing/hero-tiles` admin page will show an empty/broken list until it's applied."

- [ ] **Step 7: Update `TASKS.md`**

Mark the homepage hero tiles CMS task complete, referencing this plan file.

- [ ] **Step 8: Commit**

```bash
git add ROADMAP.md AI_MEMORY.md CHANGELOG.md API.md DATABASE.md update.md TASKS.md
git commit -m "docs: record homepage hero tiles CMS (generic link_type/link_value linking model)"
```

---

## Final Whole-Branch Review

After Task 9, dispatch a final code reviewer on the most capable available model against the full diff from the branch's fork point, per `superpowers:subagent-driven-development`. Specifically check: (1) the Tailwind JIT color-theme mapping actually renders in a production build (`npm run build` and visually spot-check, not just `npm run dev`), (2) `resolveHeroTileHref` has no franchise-specific branching, (3) `getHomepageHeroTiles` truly cannot throw into `page.tsx`, (4) the migration-not-applied deploy-order warning is present and accurate, (5) parity with the banners/categories admin UX (loading states, error toasts, confirm-before-delete) so this doesn't feel like a second-class CMS module.
