# Product Display Order — Design Spec

**Date:** 2026-07-26

## Root cause (see full audit in conversation; summarized here for the record)

`products` (migration `001_initial_schema.sql:139`) has never had an ordering column. Every storefront/admin surface defaults to `created_at DESC` (newest upload first), and `search/page.tsx` has no `.order()` at all. `catalog-client.tsx` additionally re-sorts the already-paginated 24-row slice in JavaScript — redundant on page 1, wrong on every other page/sort combination, and violates "sort in SQL" (Task 8). This is a missing-field bug, not a broken-sort bug.

**Precedent to reuse:** `categories.display_order INTEGER NOT NULL DEFAULT 0` (migration `001:89`), seeded per parent group starting at 1, no DB uniqueness constraint — same shape this spec extends to `products`.

## Decisions

1. **Column:** `products.display_order INTEGER NOT NULL DEFAULT 0 CHECK (display_order >= 0)`. Not globally unique — duplicate-order conflicts are only meaningful *within the same category* (Pokémon #1 and DBZ #1 coexisting is fine), so conflict detection is scoped by `category_id`, matching how `categories.display_order` already restarts per parent.
2. **Backfill (migration, one-time):** preserve current insertion order — `ROW_NUMBER() OVER (PARTITION BY category_id ORDER BY created_at ASC)`, 1-indexed. No alphabetical reordering, no name-based guessing. Existing catalog sequence is unchanged post-deploy; admins fine-tune numbers afterward via the new field.
3. **Tie-break:** `ORDER BY display_order ASC, created_at ASC` everywhere — deterministic even before an admin has assigned real numbers.
4. **Default sort, every surface:** `display_order ASC`. No surface may default to `created_at`/`updated_at`/name/UUID.
5. **Sort options (customer-facing):** Display Order (default), Featured, Newest, Oldest, Price Low→High, Price High→Low, A→Z, Z→A — all computed in SQL via a single shared mapping (no per-page duplicated switch statements).
6. **Conflict handling:** duplicate `display_order` within a category is a **warning**, not a block (matches `categories` precedent, which also has no uniqueness constraint). Create/update responses include an optional `warning` field; the admin form surfaces it as a non-blocking toast.
7. **Auto-suggest:** new-product and edit forms compute `MAX(display_order) + 1` for the selected category server-side (existing SSR data-fetch pattern, no new endpoint) and use it as the field's default value.
8. **Bulk reorder:** reuse the exact pattern already built and tested for banners (`/api/admin/banners/reorder` + `banners-table.tsx`'s native-HTML5 drag-and-drop, no new library) — add `/api/admin/products/reorder` and drag-and-drop to the admin products list, rather than inventing a new mechanism.
9. **Client-side sort switching is removed.** Changing the sort dropdown on `/catalog` now navigates via `router.push` with a `?sort=` param (identical pattern to the existing `?page=` navigation already in `catalog-client.tsx`), so the full result set is re-sorted in SQL, not just the current page's 24 rows.
10. **Playwright/E2E (Task 10 of the original request):** this repo has no `@playwright/test` dependency and no E2E harness today. Adding one is a separate infrastructure decision, not part of this bug fix. This spec covers the existing Jest unit/integration conventions (repository, service, validation, API route tests) only; Playwright is flagged as future work, not silently skipped or silently bootstrapped.
11. **Future-proofing (no redesign needed later):** `display_order` stays the single manual-override column. Any future automatic ranking (Pokédex number, release order, popularity) is additive — a separate nullable column or a `ranking_strategy` setting that *falls back to* `display_order` when no automatic rank exists — never a replacement for it. Not built now; just confirmed the column design doesn't block it (no foreign keys or constraints tying `display_order` to today's only-use-case).

## Files touched

| Layer | File | Change |
|---|---|---|
| DB | `supabase/migrations/011_product_display_order.sql` | New column, backfill, CHECK, 2 indexes |
| Types | `src/types/supabase.ts` | Add `display_order: number` to `products.Row` (and Insert/Update if present) |
| Validation | `src/lib/validation/product.ts` | Add `display_order` to `productSchema` |
| Repository | `src/lib/repositories/product-repository.ts` | Add to `ProductWritePayload`; add `getMaxDisplayOrder(categoryId)`, `findDisplayOrderConflict(categoryId, order, excludeId?)`, `reorderProducts(ids, categoryId?)` |
| Service | `src/lib/services/product-service.ts` | Wire conflict-warning + auto-suggest + `reorder()`; add shared `applyProductSort(query, sortParam)` helper |
| API | `api/admin/products/route.ts`, `[id]/route.ts` | Already flow through schema — relay `warning` field |
| API (new) | `api/admin/products/reorder/route.ts` | Mirrors `api/admin/banners/reorder/route.ts` exactly |
| API | `api/products/route.ts` | Use shared sort helper; add `display_order`/`featured`/`oldest`/`name_desc` options |
| Storefront | `catalog/page.tsx`, `catalog/[slug]/page.tsx`, `search/page.tsx`, `(shop)/page.tsx` (featured) | `order("display_order").order("created_at")`, read `?sort=` where applicable |
| Client | `catalog/catalog-client.tsx` | Remove JS `Array.sort`; sort dropdown navigates via `router.push` like pagination already does; add missing sort options |
| Admin | `admin/products/page.tsx` | Default order by `display_order`; add column + drag-and-drop reorder (reuse `banners-table.tsx` pattern) |
| Admin | `components/admin/product-form.tsx` | Add Display Order field (local zod schema, matching this file's existing convention of a duplicated client schema — not fixing that pre-existing duplication as part of this task, out of scope), duplicate-warning toast, auto-suggested default |
| Admin | `admin/products/new/page.tsx`, `[id]/edit/page.tsx` | Compute + pass suggested `display_order` |

## Testing (Jest, existing conventions)

Repository tests (conflict/max-order helpers, mocked fetch), service tests (sort-helper mapping, warning logic, reorder), validation tests (`display_order` bounds), API route tests (new reorder route; sort param on `api/products`). No Playwright (see Decision 10).

## Docs

`API.md`, `DATABASE.md`, `ROADMAP.md`, `TASKS.md`, `CHANGELOG.md` — additive updates documenting the column, default sort, and sort-option list. `PROJECT_CONTEXT.md`/`AI_MEMORY.md`/`README.md`/`update.md` updated only if they currently describe catalog sorting (checked at implementation time — no placeholder edits to files that don't need them).
