# ROADMAP.md — Legacy Mania Platform Roadmap

Full design rationale lives in `docs/superpowers/specs/2026-07-06-platform-architecture-design.md`.
This file tracks phase-level progress; day-to-day granular tasks stay in `TASKS.md`.

| Phase | Scope | Status |
|---|---|---|
| 0 — Foundations | Banners/contact_messages/products schema, MediaService, AuditService, rate limiter, CatalogService, doc scaffolding | Complete |
| 1 — Checkout/Order/Payment/Inventory integrity | Server-side price truth, guarded order state machine, payment verify/reject, inventory reservation + expiry, remove dead checkout code | **Complete** |
| 2 — Banners | Full banner feature (admin CRUD/reorder, homepage carousel) | Not started |
| 3 — Product/Category hardening | Full server-side CRUD, `/api/products/:slug` + `/search`, rarity/condition in admin form, navbar catalog tree | Not started |
| 4 — WhatsApp/SEO/Settings | Settings-table-sourced WhatsApp/SEO (fixes env-var disconnect), tabbed Settings page | Not started |
| 5 — Users/Contact/Support/Notifications | Customer Orders API, Contact form + inbox, UserService, NotificationService | Not started |
| 6 — Analytics | Real event capture wired into Phase 1–5 touchpoints | Not started |
| 7 — Audit API + full-suite polish + launch content | Audit query API, full test suites, real products/UPI QR/WhatsApp number | Not started |
| 8 — Future (reserved) | QR/Collectible system | Documented only, not built |
