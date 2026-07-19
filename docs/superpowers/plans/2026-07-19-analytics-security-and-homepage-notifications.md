# Analytics Security + Dynamic Homepage Notifications — Implementation Plan

> **For agentic workers:** Execute inline (executing-plans). Checkbox tracking below.

**Goal:** (1) Close the unauthenticated `/api/admin/analytics` hole. (2) Replace hardcoded announcement bar with admin-managed `homepage_notifications` system.

**Architecture:** Existing layered pattern — Repository (raw PostgREST fetch w/ service key) → Service (business rules) → thin Route (auth → validate → service → shape) → UI. Auth via `requireAdmin()`, rate limit via `checkRateLimit()`, audit via `recordAuditLog()`.

**Tech Stack:** Next.js 16 App Router, Supabase (PostgREST via fetch), Zod, Jest (node env, mock `requireAdmin` + `global.fetch`), TailwindCSS/Shadcn.

## Global Constraints

- Migrations must be applied manually via Supabase SQL Editor (no CLI), then verified via curl w/ service-role key (`-k` flag needed).
- audit_logs table live since 001; `user_id` nullable in DB.
- Rate limiter is per-instance soft limiter (documented limitation).
- Homepage is a server component — public notifications fetched server-side, NO public API endpoint needed.
- Existing `settings` table (key/JSONB value) holds display config under key `homepage_notifications_display`.

---

## TASK 1 — Analytics Security

### T1.1 Analytics repository + service

**Files:** Create `src/lib/repositories/analytics-repository.ts`, `src/lib/services/analytics-service.ts`, `src/lib/services/analytics-service.test.ts`.

- Repo: `fetchAnalyticsCounts()` → `{ totalOrders, totalProducts, totalUsers, revenueRows: {total}[], statusRows: {status}[] }` (moves the 5 queries out of the route; keep `createAdminClient` since count queries already work there).
- Service: `getAnalyticsSummary()` → `{ totalOrders, totalProducts, totalUsers, totalRevenue, ordersByStatus }` (aggregation moves here). No customer PII in response — counts + aggregates only.

### T1.2 Audit repo: optional userId

**Files:** Modify `src/lib/repositories/audit-repository.ts` (`userId?: string`, send `user_id: input.userId ?? null`), extend `src/lib/services/audit-service.test.ts`.

Needed so failed (anonymous) access attempts can be recorded.

### T1.3 Secure route

**Files:** Rewrite `src/app/api/admin/analytics/route.ts`, create `route.test.ts`.

Order: rate limit (`analytics:{ip}`, 30/60s) → `requireAdmin()`; on fail record audit `analytics.access_denied` (userId omitted for 401) and return auth.response (401/403) → `recordAuditLog({userId, action: "analytics.view", tableName: "analytics"})` → `getAnalyticsSummary()` → 200 JSON. Response shape unchanged (admin page untouched).

Tests: 429 over limit; 401 anon + denied audit row; 403 non-admin + denied audit row; 200 admin + view audit row; 500 on service throw.

### T1.4 Docs

Update `API.md` (analytics entry: auth, rate limit, codes), `CHANGELOG.md`, `PROJECT_CONTEXT.md`, `TASKS.md` (check off analytics guard). Create `SECURITY.md` (auth model, RLS, rate limiting, audit logging, this fix).

---

## TASK 2 — Homepage Notifications

### T2.1 Migration `supabase/migrations/007_homepage_notifications.sql`

Table `homepage_notifications`: id uuid pk, title text NOT NULL, message text NOT NULL, short_message text, type text CHECK IN ('sale','limited_stock','new_arrival','trending','recently_sold','new_collection','offer','flash_sale','announcement','shipping_update','event','countdown','custom') DEFAULT 'announcement', cta_text text, cta_url text, priority int DEFAULT 0, display_order int DEFAULT 0, is_active bool DEFAULT true, theme text DEFAULT 'primary', icon text, animation text DEFAULT 'marquee', background_color text, text_color text, start_date timestamptz, end_date timestamptz, device text CHECK IN ('desktop','mobile','both') DEFAULT 'both', target_audience jsonb, country text, created_by uuid REFERENCES profiles(id), updated_by uuid REFERENCES profiles(id), created_at/updated_at timestamptz DEFAULT NOW(), deleted_at timestamptz.

Indexes: partial on (is_active, display_order) WHERE deleted_at IS NULL. RLS: public SELECT active+undeleted+within schedule; admin writes go through service-role (no anon write policy). updated_at trigger. Seed settings key `homepage_notifications_display` (marquee speed/direction/pauseOnHover/loop/bg/text/fontSize/fontWeight/padding/radius/mobileVisible/desktopVisible). Future automation: `type` enum + `target_audience`/`country` jsonb columns future-ready; dynamic feeds later = new service producing rows, schema unchanged.

**Manual apply via SQL Editor + curl verify (per project constraint).**

### T2.2 Validation `src/lib/validation/notification.ts` (+test)

`notificationCreateSchema` (title/message required, max lens; type enum; cta_url URL; dates ISO, end>start refine; device enum), `notificationUpdateSchema` (partial), `reorderSchema` (`{ids: string[]}`), `bulkSchema` (`{ids: string[], action: 'activate'|'deactivate'|'delete'}`).

### T2.3 Repository `src/lib/repositories/notification-repository.ts` (+test)

Raw PostgREST fetch (faq pattern). Fns: `listNotifications({includeDeleted?})`, `listActiveNotifications(now, device)` (is_active, deleted_at null, schedule window), `insertNotification`, `updateNotification(id, patch)`, `softDeleteNotification(id, userId)`, `reorderNotifications(ids)` (PATCH display_order per id), `getDisplaySettings()` / `updateDisplaySettings(value, userId)` (settings table).

### T2.4 Service `src/lib/services/notification-service.ts` (+test)

`getHomepageNotifications(device)` — active, in-window, sorted priority desc → display_order asc; returns [] on repo error (homepage must never crash). `createNotification(input, adminId)` (stamps created_by, next display_order), `updateNotification(id, patch, adminId)`, `deleteNotification(id, adminId)` (soft), `duplicateNotification(id, adminId)`, `reorder(ids)`, `bulkAction(ids, action, adminId)`, `getDisplayConfig()`/`updateDisplayConfig(cfg, adminId)`.

### T2.5 Admin APIs (all: rateLimit 60/60s → requireAdmin → zod → service → audit via recordAuditLog)

- `src/app/api/admin/notifications/route.ts` — GET list, POST create
- `.../[id]/route.ts` — PATCH, DELETE (soft)
- `.../[id]/duplicate/route.ts` — POST
- `.../reorder/route.ts` — POST
- `.../bulk/route.ts` — POST (activate/deactivate/delete)
- `.../display-settings/route.ts` — GET, PATCH
Each with route.test.ts (403 passthrough, 400 invalid, happy path, audit recorded).

### T2.6 Admin UI

- Sidebar: add "Marketing" item → `/admin/marketing/notifications` (Megaphone icon).
- `src/app/admin/marketing/notifications/page.tsx` (server: service-role list + display settings) + `notifications-table.tsx` (client: search, type/status filter, up/down + drag reorder, toggle active, edit dialog form w/ all fields, live marquee preview, duplicate, soft delete, bulk select bar, display-settings panel). Reuse faqs-table interaction patterns; dnd via native HTML5 drag events (no new dep).

### T2.7 Public bar

- `announcement-bar.tsx` → props-driven presentational (`items`, `config`); keep marquee CSS; render null when items empty.
- `(shop)/page.tsx` → server-fetch `getHomepageNotifications('both')` + config, pass down. SSR ⇒ no CLS, no SEO impact (plain div, no structured-data interference). Wrap fetch in try → [] (never break homepage).

### T2.8 Tests + docs

Full `npm test`. Docs: API.md (6 new endpoint groups), DATABASE.md (table 007), CHANGELOG.md, TASKS.md, ROADMAP.md (banner phase note), PROJECT_CONTEXT.md, AI_MEMORY.md, SECURITY.md (new endpoints), create TESTING.md + BUSINESS_RULES.md (notification scheduling/visibility rules).

## Self-review notes

- Spec's E2E/visual-regression/a11y/perf tests: no harness exists in repo — covered by jest unit/route/component tests; noted as gap in TESTING.md rather than fake coverage.
- Public API omitted deliberately (server component fetch) — cheaper, cached, no anon surface.
- Drag-drop with native events avoids new dependency.
