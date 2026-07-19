# AI_MEMORY.md — Read This First

Project-local, git-tracked onboarding doc for any AI (or human) starting work on Legacy Mania.
Distinct from any assistant-specific private memory system — this file travels with the repo.

## Session ritual

Before writing code, read in this order: `README.md` → `PROJECT_CONTEXT.md` → this file →
`CHANGELOG.md` → `TASKS.md` → `ROADMAP.md`. After a module ships, update whichever of these
actually changed.

## Architecture

Full platform design: `docs/superpowers/specs/2026-07-06-platform-architecture-design.md`.
Layered pattern: `src/lib/repositories/` (pure data access) → `src/lib/services/` (business
rules) → `src/app/api/**/route.ts` (thin — auth, validate, call one service method).

## Known gotchas (update this list as things are fixed or discovered)

- ~~Checkout browser-writes / unguarded status transitions~~ — **fixed in Phase 1** (server-side
  `CheckoutService` + guarded `OrderService` state machine; see CHANGELOG 0.8.0).
- **Migration `007_homepage_notifications.sql` must be applied manually** in the Supabase SQL
  Editor (no CLI in this environment) before the notification engine works live. Until then the
  homepage bar renders nothing (by design — `getHomepageNotifications` swallows errors) and
  `/admin/marketing/notifications` shows an empty list. Verify after applying via a curl GET on
  `/rest/v1/homepage_notifications` with the service-role key (`curl -k` needed on this machine).
- **`/api/admin/analytics` was fully anonymous until 2026-07-19** — now requireAdmin + rate
  limit + audit logging. Pattern to copy for any new admin route: rate limit → `requireAdmin()`
  → zod validate → one service call → `recordAuditLog()`.
- **WhatsApp number / GA4 / GTM IDs** are editable in Admin → Settings but the app currently
  reads hardcoded env vars at every call site instead of the `settings` table — so admin edits
  silently do nothing today. Fix is Phase 4 (`WhatsAppService`/`SEOService`).
- **`payments.screenshot_url`** stores a public URL despite the bucket being documented private.
  Fix is Phase 1 (store the path, generate signed URLs via `PaymentService`).
- **`analytics_events`** has no writer yet (Phase 6 adds one via `AnalyticsService`).
- **As of Phase 0:** `audit_logs` has a real writer (`AuditService`), file uploads for
  Banners/Products go through the centralized `MediaService` (`POST /api/media/upload`), and
  `categories`' existing self-referential `parent_id` is the platform's "catalog" — there is no
  separate Catalog table; `CatalogService` just reads that same tree.
- **Migrations are applied manually** via the Supabase dashboard SQL Editor — there is no
  Supabase CLI/local config in this repo.
