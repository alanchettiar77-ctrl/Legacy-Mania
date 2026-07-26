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
| 3 — Product/Category hardening | Full server-side CRUD, `/api/products/:slug` + `/search`, rarity/condition in admin form, navbar catalog tree | Not started |
| 4 — WhatsApp/SEO/Settings | Settings-table-sourced WhatsApp/SEO (fixes env-var disconnect), tabbed Settings page | Not started |
| 5 — Users/Contact/Support/Notifications | Customer Orders API, Contact form + inbox, UserService, NotificationService | Not started |
| 6 — Analytics | Real event capture wired into Phase 1–5 touchpoints | Not started |
| 7 — Audit API + full-suite polish + launch content | Audit query API, full test suites, real products/UPI QR/WhatsApp number | Not started |
| 8 — Future (reserved) | QR/Collectible system | Documented only, not built |
