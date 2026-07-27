# ROADMAP.md — Legacy Mania Platform Roadmap

Full design rationale lives in `docs/superpowers/specs/2026-07-06-platform-architecture-design.md`.
This file tracks phase-level progress; day-to-day granular tasks stay in `TASKS.md`.

## CMS Initiative (10-phase)

See `docs/superpowers/specs/2026-07-23-homepage-banner-management-design.md` for design details.

| Phase | Scope | Status |
|---|---|---|
| **1 — Homepage Banner Management** | Admin CRUD/reorder, image upload (desktop/mobile variants), scheduling (live/draft), overlay customization, SEO fields, CTA configuration, duplicate/soft-delete, home carousel display | **✅ Complete (2026-07-26)** |
| **2 — Customer Authentication Improvements** | ... (next phase) | Not started |

| Phase | Scope | Status |
|---|---|---|
| 0 — Foundations | Banners/contact_messages/products schema, MediaService, AuditService, rate limiter, CatalogService, doc scaffolding | Complete |
| 1 — Checkout/Order/Payment/Inventory integrity | Server-side price truth, guarded order state machine, payment verify/reject, inventory reservation + expiry, remove dead checkout code | **Complete** |
| 2 — Banners (CMS Phase 1) | Full banner feature (admin CRUD/reorder, image upload, scheduling, overlay, SEO fields, homepage carousel) | **✅ Complete (2026-07-26)** — note: the homepage notification engine (2026-07-19, migration 007) already covers the scrolling text bar; Phase 2 is the image banner carousel only |
| — Product display order (standalone fix, unrelated to CMS initiative) | Product catalog ordering fixed to default to `display_order` ASC (migration 011, backfilled per category, live sort options: Display Order/Featured/Newest/Oldest/Price↑↓/A-Z/Z-A), admin Display Order field with drag-reorder | **✅ Complete (2026-07-26)** |
| — Catalog pagination + admin authz regression coverage (standalone launch-blocker fixes) | Fixed `CatalogClient` freezing on page-1 products across navigation (client-side `useState` bug); audited a reported `/account`→`/admin` bypass (not reproducible — already hardened) and added regression tests locking in middleware + every `/api/admin/*` route's 401/403 behavior | **✅ Complete (2026-07-26)** |
| — Parent category aggregation (standalone fix) | Fixed parent category pages (`/catalog/pokemon`) and `/api/products?category=` to aggregate products from all descendant categories at any depth (was returning zero for any parent category). Root cause: products tagged with leaf categories only; parent id never matches directly. Fixed via `CatalogService.getDescendantCategoryIds()` (BFS tree traversal), used by `/api/products`, `/catalog/[slug]`, and catalog sidebar navigation | **✅ Complete (2026-07-27)** |
| 3 — Category CMS (generic, unlimited-depth) | Full admin CRUD (create/rename/move/reorder/hide/soft-delete), cycle prevention (reuses `CatalogService.getDescendantCategoryIds()`), slug uniqueness, product/branch reassignment on delete, SEO fields (`meta_title`/`meta_description`), recursive drag-and-drop admin tree, `/admin/categories/:id/edit` (previously dead link, now built). Generic — verified via a non-card T-Shirts→Men→Hoodies hierarchy, zero category-specific code. Reused by every current and future collection type. | **✅ Complete (2026-07-27)** |
| 3b — Product/Catalog hardening (remainder of original Phase 3 scope, not yet started) | `/api/products/:slug`, `/api/products/search` (or a `search` query param on the existing listing endpoint), rarity/condition fields in the admin product form, navbar catalog tree (navbar currently has flat `Home`/`Catalog`/`About` links only — no nested category dropdown) | Not started |
| 4 — WhatsApp/SEO/Settings | Settings-table-sourced WhatsApp/SEO (fixes env-var disconnect), tabbed Settings page | Not started |
| 5 — Users/Contact/Support/Notifications | Customer Orders API, Contact form + inbox, UserService, NotificationService | Not started |
| 6 — Analytics | Real event capture wired into Phase 1–5 touchpoints | Not started |
| 7 — Audit API + full-suite polish + launch content | Audit query API, full test suites, real products/UPI QR/WhatsApp number | Not started |
| 8 — Future (reserved) | QR/Collectible system | Documented only, not built |

## Future Enhancements (documented, not built)

- **Generic internal linking (`link_type`/`link_value`) for CMS modules.** When homepage tiles, navigation items, or promotional sections are built (Phases 4-5), they should link via `link_type` (`category` | `product` | `collection` | `search` | `page` | `custom_url`) + `link_value`, not a bare `category_id` column — avoids a schema change every time a new destination type is introduced.
- **Category Slug History + 301 redirects.** A `category_slug_history` table (`category_id`, `old_slug`, `new_slug`, `created_at`) plus redirect-on-404 logic, so renaming a category's slug (e.g. `kanto` → `kanto-region`) doesn't break existing bookmarks/search-engine indexes. Not needed until slug renames are common enough to matter.
- **Richer category media fields.** `thumbnail_image`, `hero_image`, `cover_image`, `banner_image` as additional columns on `categories`, for presentation needs beyond today's `image_url`/`icon_url`.
- **Per-row audit metadata on categories.** `created_by`/`updated_by` columns on `categories` itself, so attribution doesn't require joining `audit_logs`. `audit_logs` already covers every category mutation today (see `category.create`/`category.update`/`category.delete` actions) — this would be a convenience, not a gap.
