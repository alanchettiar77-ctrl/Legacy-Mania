# update.md — Legacy Mania Deployment Log

---

## [2026-06-22] — v0.1.0 — Initial Platform Build ✅

### Date
June 22, 2026

### Type
Initial Build — Production-Ready Foundation

### Status
✅ Build passes. All routes compile. TypeScript clean.

### Features Added
- Complete Next.js 15 + TypeScript + TailwindCSS project setup
- Supabase database schema (11 tables, full RLS)
- Authentication system (Login, Register, Session Management)
- Home page with 7 sections (Hero, Featured, Categories, Latest, Testimonials, WhatsApp CTA, Newsletter)
- Catalog page with search, filter, and sort
- Product detail page with image gallery, add to cart, wishlist
- Cart drawer with 5-card minimum enforcement
- Checkout flow with UPI QR payment + screenshot upload
- User account pages (Profile, Orders, Wishlist)
- Admin Dashboard with full CMS
- Admin: Products, Orders, Categories, Users, Analytics, Settings
- UPI payment verification workflow
- WhatsApp floating button + inquiry + order confirmation
- Dynamic sitemap.xml + robots.txt
- Security headers via vercel.json

### Features Modified
- N/A (Initial build)

### Bugs Fixed
- Removed non-existent `@radix-ui/react-badge` and `@radix-ui/react-sheet` packages
- Fixed font loading (Google Fonts SSL issue → system font fallback)
- Added `autoprefixer` to devDependencies (was missing, caused PostCSS build failure)
- Fixed Supabase client type inference (removed Database generic, use explicit casts)
- Fixed ThemeProviderProps import from next-themes

### Migrations Performed
- `001_initial_schema.sql` — Initial database schema (pending: must be run in Supabase)

### Build Output
- 22 routes compiled
- All admin, shop, auth, account, API routes working
- Static + Dynamic rendering configured correctly

### Environment
- Framework: Next.js 15.0.0
- Node: 18+
- Database: Supabase PostgreSQL
- Hosting: Vercel Free Tier (configured)

### Next Steps for Launch
1. ✅ Code complete — run this file in Supabase SQL Editor: `supabase/migrations/001_initial_schema.sql`
2. Create storage buckets: `products` (public), `payments` (private), `settings` (public)
3. Copy `.env.local.example` to `.env.local`, fill Supabase credentials
4. Set first user as admin: `UPDATE profiles SET role = 'admin' WHERE email = 'your@email.com';`
5. Upload UPI QR code via Admin → Settings → UPI Payment
6. Set WhatsApp number via Admin → Settings → WhatsApp
7. Add products via Admin → Products → Add Product
8. Deploy to Vercel: `vercel --prod`
9. Set environment variables in Vercel dashboard

---

## [2026-06-22] — v0.2.0 — Priority 2 Feature Completion ✅

### Date
June 22, 2026

### Type
Feature Addition — Missing Core Pages

### Status
✅ Build passes. 33 routes. Zero TypeScript errors.

### Features Added
- `/catalog/[slug]` — Category browse page (Pokémon, Naruto, DBZ etc.)
- `/account/addresses` — Full CRUD address manager with modal form, default address
- `/account/settings` — Edit name/phone, change password
- `/forgot-password` — Send Supabase password reset email
- `/reset-password` — Confirm new password from email link
- `/account/orders/[id]` — Order detail with items, timeline, delivery, payment info
- `/admin/products/[id]/edit` — Edit existing product via ProductForm

### Features Modified
- Catalog client: added `pageTitle`/`pageDescription` props for category pages
- Orders list: links to detail pages
- addresses SQL schema: added `label`, `updated_at`; renamed `address_line1` → `street`

### Build Output
- 33 routes compiled (was 22 in v0.1.0)

### Next Steps
- Soft-delete products from admin table
- Catalog pagination
- Product JSON-LD schema
- Policy pages (FAQ, Shipping, Returns, Privacy, Terms, Contact)
- OG image file

---

## [2026-06-22] — v0.3.0 — Policy Pages, Admin Improvements ✅

### Type
Feature Addition — SEO, Policy Pages, Admin UX

### Status
✅ 39 routes. Zero TypeScript errors.

### Features Added
- `/faq` — 12 accordion Q&As
- `/shipping-policy`, `/return-policy`, `/privacy-policy`, `/terms`, `/contact`
- Admin products: soft-delete (toggle `is_active`) and visibility toggle
- Product pages: JSON-LD `Product` structured data for Google Shopping

### Next Steps
- Catalog pagination
- Product image lightbox
- WhatsApp admin notification on new order
- Newsletter email storage in DB

---

## [2026-06-22] — v0.4.0 — Pagination + Newsletter Backend ✅

### Type
Feature Addition

### Status
✅ 40 routes. Zero errors.

### Features Added
- URL-based catalog pagination (24 per page, prev/next, smart ellipsis)
- Newsletter subscription wired to Supabase `newsletter_subscribers` table
- `newsletter_subscribers` added to SQL migration

### Next Steps
- Product image lightbox on product detail page
- Price range filter in catalog
- WhatsApp admin notification on new order
- OG image placeholder
- Admin newsletter subscriber list

---

## [2026-06-30] — v0.5.0 — Security, Admin Access Control, Auth Fixes ✅

### Type
Security Patch + Bug Fixes — Admin Auth Flow, Access Management

### Status
✅ Build passes. Deployed to production. Supabase fully wired up (env vars set, live URL/keys confirmed).

### Features Added
- `/admin/admins` — Admin access management page (list/add/remove admins)
- Owner protection — the designated store owner account can't be demoted or removed via admin access management
- `/auth/redirect` — Server page that checks role post-login and routes admins → `/admin`, customers → `/account`
- Scrolling announcement banner on homepage (`announcement-bar.tsx`)
- Google Search Console verification (meta tag + verification file)

### Bugs Fixed
- Admin login redirect: navbar user icon linked to `/account`, so unauthenticated admins were bounced to `/account` post-login instead of `/admin`. Login now always redirects to `/admin` and lets middleware route by role.
- Profile update silently failing — now routes through a server API using the service role key instead of the browser client
- **Upgraded Next.js to 16.2.9** — patches CVE-2025-66478 (RCE vulnerability) in previous version

### Migrations Performed
- `supabase/migrations/001_initial_schema.sql` — local working changes pending (uncommitted in git); verify against live Supabase schema before next deploy

### Environment
- `.env.local` fully populated: Supabase URL/anon key/service role key, WhatsApp number, analytics IDs
- Framework: Next.js 16.2.9

### Next Steps
- Confirm uncommitted `supabase/migrations/001_initial_schema.sql` changes are applied to the live Supabase project, then commit
- Product image lightbox on product detail page
- Price range filter in catalog
- WhatsApp admin notification on new order
- OG image (`/public/og-image.jpg`) — still missing
- Order confirmation email (Supabase Edge Function or Resend)
- Admin audit log viewer, CSV order export, bulk product upload (Priority 3, later)

---

## [2026-07-05] — v0.6.0 — FAQ System (Public Page + Admin Management) ✅

### Type
Feature Addition — Database-Backed FAQ System

### Status
✅ Jest (33 tests), `tsc --noEmit`, and Playwright E2E (11 passed, 1 intentionally skipped) all pass against the live dev server and live Supabase database.

### Features Added
- `faqs` table (migration, RLS: public read of active rows only; writes via service-role API routes)
- `GET /api/faqs` — public, active FAQs only, ordered by `display_order`
- `POST /api/admin/faqs`, `PATCH`/`DELETE /api/admin/faqs/:id` — admin-only (via `requireAdmin()`), validated with shared `faqCreateSchema`/`faqUpdateSchema`
- `/faq` — public accordion page now reads from the `faqs` table instead of being hardcoded
- `/admin/faqs` — new admin page: add/edit FAQs via modal form, reorder (swaps `display_order` between two rows), toggle active/hidden, delete with confirmation
- Sidebar nav entry for FAQs (between Categories and Users)
- `e2e/admin-faqs.spec.ts` — full admin flow test (add → edit → reorder → deactivate → delete), logging in as a real admin account and cleaning up its own test data

### Features Modified
- `src/components/admin/admin-sidebar.tsx` — added `HelpCircle` nav item for `/admin/faqs`
- `playwright.config.ts` — now loads `.env.local` manually so `E2E_ADMIN_EMAIL`/`E2E_ADMIN_PASSWORD` reach the Playwright test process (Next.js's own `.env.local` auto-load doesn't extend to the separate Playwright runner)

### Bugs Fixed / Notes
- The admin FAQ E2E test is restricted to the desktop (chromium) Playwright project — the site-wide fixed WhatsApp contact widget overlaps the FAQ table's row action buttons on the narrow Pixel 5 mobile viewport used by the "mobile" project, causing spurious click interception unrelated to the feature itself.
- **Critical, found in final review:** `/admin/faqs` read via the session-scoped Supabase client, which is RLS-enforced — the `faqs` table's only RLS policy allows reading active rows only, so hiding a FAQ made it vanish from the admin table on reload (no way to re-activate/edit/delete it afterward). Fixed by reading via `createAdminClient()` instead.
- **Deeper bug found while fixing the above:** `createAdminClient()` itself (shared helper in `src/lib/supabase/server.ts`, also used by `/admin/users` and `/api/admin/analytics`) was silently broken — it wired the request's session cookies into the service-role client, and `supabase-js` prefers a discovered session's own access token over the service-role key, so it was never actually bypassing RLS when an admin was logged in (which is always). Fixed by no longer passing cookies into that client at all, guaranteeing the service-role key is always used. Verified against the installed `supabase-js` source and confirmed the other two callers are unaffected (both do plain full-table admin reads, which this fix makes more reliable, not less).
- Reorder (`move()` in the admin table) now calls `router.refresh()` on a partial `Promise.all` failure so the UI can't silently diverge from the database.
- FAQ `question`/`answer` now strip control characters (per the original design spec) via a Zod transform.
- Public `/faq` page's JSON-LD now escapes `<` to prevent a script-tag breakout if an admin-authored answer ever contained `</script>`.
- Added a regression test for the cart drawer's `inert`/`aria-modal` behavior (mirroring the one already added for the mobile menu).

### Environment
- `E2E_ADMIN_EMAIL` / `E2E_ADMIN_PASSWORD` set in `.env.local` for a real admin account, enabling the admin E2E test to log in for real

### Status of This Work
Implemented via subagent-driven development in an isolated worktree (`.claude/worktrees/faq-system`, branch `worktree-faq-system`) — **not yet merged to `master`**. All 10 plan tasks complete and individually reviewed; a final whole-branch review (2 rounds) found and fixed one Critical bug (above) plus minor items, and gave a final "ready to merge" verdict. Paused here for the day before executing the merge/PR decision — resume by asking to finish the FAQ system branch.

**One pre-existing, unrelated finding surfaced during the final review (not fixed, flagged as a follow-up):** `/api/admin/analytics` has no `requireAdmin()` guard and no middleware coverage (unlike every `/api/admin/faqs*` route), so it's technically reachable without authentication. Not caused by this branch; worth a separate look.

### Next Steps
- Decide how to land the FAQ system branch: merge locally, push + PR, or keep as-is (ask to resume `finishing-a-development-branch`)
- Consider closing the unguarded `/api/admin/analytics` route (separate from this feature)
- Confirm uncommitted `supabase/migrations/001_initial_schema.sql` changes are applied to the live Supabase project, then commit
- Product image lightbox on product detail page
- Price range filter in catalog
- WhatsApp admin notification on new order
- OG image (`/public/og-image.jpg`) — still missing
- Order confirmation email (Supabase Edge Function or Resend)
- Admin audit log viewer, CSV order export, bulk product upload (Priority 3, later)

---

## [2026-07-26] — v0.11.1 — Catalog Pagination Fix & Admin Authorization Regression Coverage ✅

### Type
Production Hardening — Two Reported Launch Blockers

### Status
✅ Full test suite (82 suites / 434 tests) and `tsc --noEmit` pass. Both blockers investigated via root-cause analysis before any fix was written (per systematic-debugging).

### Bug 1: Catalog pagination showed the same 24 products on every page
**Root cause:** `CatalogClient` (`src/app/(shop)/catalog/catalog-client.tsx`) copied the
`initialProducts` prop into `useState` on mount and never updated it. The parent Server
Component (`catalog/page.tsx`, `catalog/[slug]/page.tsx`) already computed the correct
`range()`/offset per page and re-rendered with the right slice on every navigation — the
server-side logic from the earlier product-display-order fix was never broken. But
`router.push` to a new `?page=` doesn't remount the client component, so React kept the
frozen first-mount state forever; the URL and the `totalCount` (read straight from props,
not state) updated correctly while the rendered list didn't.
**Fix:** removed the redundant `useState`, render `initialProducts` directly.
**Tests added:** `catalog-client.test.tsx` (confirmed to fail on the pre-fix code, pass on
the fix), `e2e/catalog-pagination.spec.ts`.

### Bug 2 (reported, not reproducible): `/account` → `/admin` authorization bypass
Audited every layer named in the report — `middleware.ts`, `requireAdmin()`, every
`/api/admin/*` route, Supabase RLS. All three layers already fail closed: middleware
redirects non-admins away from `/admin` server-side before any page renders, every admin API
route rejects with 401/403 via the shared `requireAdmin()` helper, and RLS gates every admin
table via `is_admin()`. This was hardened in commits predating this session
(`12007f7`, `83ba3f0`, `28d18ec`, `2e41c5f`, 2026-07-04 to 2026-07-21). No fix was made for a
vulnerability that doesn't exist in the current codebase — instead, added regression tests so
this specific bypass path can never silently regress:
- `src/lib/supabase/middleware.test.ts` (new — this file had zero test coverage before today)
- A `route.test.ts` for the 9 admin API routes that had no dedicated 401/403 test:
  `branding`, `categories/order`, `categories/[id]/branding`, `categories/[id]`,
  `notifications/bulk`, `notifications/display-settings`, `notifications/reorder`,
  `notifications/[id]/duplicate`, `notifications/[id]`

### Files Modified
- `src/app/(shop)/catalog/catalog-client.tsx` (the fix)

### Files Added
- `src/app/(shop)/catalog/catalog-client.test.tsx`, `e2e/catalog-pagination.spec.ts`,
  `src/lib/supabase/middleware.test.ts`, and 9 `route.test.ts` files under `src/app/api/admin/`

### Next Steps
- User to confirm in an incognito window against the live deployment that (a) pagination now
  shows different products per page and (b) the `/admin` bypass still cannot be reproduced —
  if it can, capture exactly what renders (redirect? blank? real admin UI?) for further
  investigation, since it doesn't reproduce against the current source.
- Minor, non-blocking: `src/app/api/admin/admins/route.ts` inlines its own auth check instead
  of calling the shared `requireAdmin()` helper (same correctness, just inconsistent with the
  DRY refactor other admin routes went through) — worth aligning later.

---

## [2026-07-27] — v0.12.0 — Generic Category CMS ✅

### Type
Feature Addition — Full Admin CRUD, Soft Delete, Reassignment, SEO Fields for `categories`

### Status
✅ Full test suite and `tsc --noEmit` pass. Migration `012` (`deleted_at` on `categories`) is
handed to the human partner to apply manually via the Supabase SQL Editor per this repo's
convention — no CLI available in this environment.

### Features Added
- `supabase/migrations/012_category_soft_delete.sql` — adds `deleted_at TIMESTAMPTZ` to
  `categories`, matching the existing `banners`/`homepage_notifications` soft-delete convention
  (`deleted_at IS NULL` = visible everywhere)
- `DELETE /api/admin/categories/:id` — soft-deletes a category; body
  `{ reassignChildrenTo?, reassignProductsTo? }` lets the admin reassign children/products in
  the same request; `409` if either is left unresolved
- `POST /api/admin/categories/:id/reassign-products` — standalone product reassignment, body
  `{ toCategoryId }`
- Cycle prevention on `PATCH /api/admin/categories/:id` — re-parenting a category under itself
  or one of its own descendants is rejected with `409`, reusing Phase 1's
  `CatalogService.getDescendantCategoryIds()` (no second tree-walk implementation)
- Slug-uniqueness validation on create/edit
- SEO fields (`meta_title`/`meta_description`) added to the category content schema
- `/admin/categories/new` and `/admin/categories/:id/edit` — the edit page was a dead link
  before this work (referenced by the admin tree, page never built); both now exist
- Recursive drag-and-drop admin category tree (replaces the old flat two-level list), reusing
  the native HTML5 drag pattern already used by the admin products table (no dnd library)
- `POST`/`PATCH /api/admin/categories*` now follow the standard admin route pattern (rate limit
  → `requireAdmin()` → zod validate → one service call → `recordAuditLog()`), matching every
  other admin route

### Features Modified
- `categoryBrandingSchema` — `is_active` removed (moved to the content-edit schema); Activate/
  Deactivate is now exclusively a content-endpoint concern, closing a two-competing-sources-of-
  truth gap
- `category-repository.ts` — `listActiveCategories()`/`listAllCategories()`/
  `listHomepageCategories()` now exclude soft-deleted rows

### Bugs Fixed (found during implementation, fixed before merge)
- Deleting a category with inactive (not just active) products previously left those products
  silently orphaned (`category_id` pointing at a soft-deleted row) — delete's product-check now
  also counts inactive products, not just active ones
- Reassigning a branch's children to a new parent previously could partially commit (some
  children moved) before a later validation failure aborted the rest, leaving the tree in a
  half-moved state — reassignment now validates every target up front before writing anything

### Tests Added
- `src/lib/repositories/category-repository.test.ts` — new; no repository tests existed for
  categories before this work
- Service-layer tests for cycle prevention, slug conflicts, delete blocking/reassignment
- `route.test.ts` for every new/changed admin category route (401/403 + behavior)
- A full non-card regression test (`T-Shirts → Men → Hoodies` hierarchy) proving the CMS is
  generic — identical behavior to a card-franchise category tree, zero category-specific code
  anywhere in the implementation

### Documentation
- `API.md`, `DATABASE.md`, `ROADMAP.md`, `PROJECT_CONTEXT.md`, `AI_MEMORY.md`, `CHANGELOG.md`,
  `TASKS.md` all updated to reflect the CMS; `ROADMAP.md` gained a
  `## Future Enhancements (documented, not built)` section (generic internal linking for future
  CMS modules, category slug history + redirects, richer media fields, per-row audit metadata)
  capturing four forward-looking decisions raised during plan review but deliberately not built
  in this phase

### Next Steps
- Human partner to apply migration `012` via the Supabase SQL Editor, then verify live
  (`deleted_at` column present, soft-delete/reassignment flows work against production data)
- **Deploy-ordering hazard:** migration `012` MUST be applied *before* this branch is deployed,
  not after. Every category read function (`listActiveCategories`, `listAllCategories`,
  `listHomepageCategories`, `getCategoryById`, `getCategoryBySlug`) now filters on
  `deleted_at=is.null`; against a database that hasn't had `012` applied yet, PostgREST 400s on
  the unknown column and all of these throw — breaking the homepage category cards, `/catalog`,
  `/catalog/[slug]`, the branding dashboard, and the entire category admin panel, not just the
  new features.
- Reassignment (delete-with-reassignment, standalone reassign-products) is API-only today; the
  admin delete flow surfaces the resulting `409` error but has no UI to supply reassignment
  targets yet. See `ROADMAP.md`'s Category CMS entry.
- Remainder of the original Phase 3 scope is still open: `/api/products/:slug`, a products
  search endpoint, rarity/condition fields in the admin product form, and a navbar catalog tree
  (see `ROADMAP.md`'s "3b — Product/Catalog hardening" row)

---

## [2026-07-27] — v0.13.0 — Homepage Hero Tiles CMS ✅

### Type
Feature Addition — Full Admin CRUD, Reorder, Soft Delete for the Homepage Hero Tiles

### Status
✅ Full test suite and `tsc --noEmit` pass. Migration `013` (`hero_tiles` table) is handed to
the human partner to apply manually via the Supabase SQL Editor per this repo's convention — no
CLI available in this environment.

### Features Added
- `supabase/migrations/013_hero_tiles.sql` — new `hero_tiles` table using the generic
  `link_type`/`link_value` linking model (`category`|`product`|`collection`|`search`|`page`|
  `custom_url`) instead of a bare `category_id` FK — the first table built this way (see
  `ROADMAP.md`'s Future Enhancements note it implements)
- `GET`/`POST /api/admin/hero-tiles`, `PATCH`/`DELETE /api/admin/hero-tiles/:id`,
  `POST /api/admin/hero-tiles/reorder` — standard rate-limit → `requireAdmin()` → zod validate →
  service → `recordAuditLog()` pattern, matching every other admin CMS route
- `/admin/marketing/hero-tiles` — new admin page: add/edit tiles via modal form, drag-reorder,
  toggle active/hidden, delete with confirmation
- `getHomepageHeroTiles()` — public read used by the homepage hero section; falls back to the 4
  built-in default tiles if the table/migration isn't reachable, so the homepage never breaks
- `COLOR_THEME_CLASSES` lookup in `hero-section.tsx` maps the DB-driven `color_theme` key to a
  complete, literal Tailwind class string (never concatenates a class from DB data — see
  `AI_MEMORY.md` gotcha)

### Bugs Fixed
- The 4 homepage hero tiles were previously hardcoded in `hero-section.tsx` and not clickable —
  now database-driven and each links via `resolveHeroTileHref` to its configured destination.

### Documentation
- `API.md`, `DATABASE.md`, `ROADMAP.md`, `AI_MEMORY.md`, `CHANGELOG.md`, `TASKS.md`, `update.md`
  all updated to reflect the CMS.

### Next Steps
- **Deploy-ordering warning:** migration `013` (`hero_tiles`) must be applied via the Supabase
  SQL Editor before deploying this branch. Unlike migration `012` (categories), missing this one
  does **not** break the homepage — `getHomepageHeroTiles()` catches the failure and the hero
  section falls back to its 4 default tiles — but the new `/admin/marketing/hero-tiles` admin
  page will show an empty/broken list until it's applied.

---

*Updated: 2026-07-27*
