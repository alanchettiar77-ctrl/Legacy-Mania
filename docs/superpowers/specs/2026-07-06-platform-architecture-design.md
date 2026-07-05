# Legacy Mania — Platform Architecture Design

**Status:** Approved by product owner, pending final written sign-off.
**Supersedes:** No prior architecture doc — this is the first platform-wide design. `docs/superpowers/specs/2026-07-04-faq-system-design.md` remains valid as the pattern this design generalizes from.
**Context:** What began as a Banner Management feature request was intentionally broadened, at the product owner's request, into a full-platform architecture so that Banners and every subsequent feature (Checkout hardening, Product/Category APIs, WhatsApp/SEO/Settings, Analytics, and a future QR/collectible system) are built against one consistent structure instead of each reinventing its own.

This document reflects the **real, audited as-built state** of the codebase (Next.js 16.2.9, Supabase, no Prisma/Clerk/Cloudinary despite some earlier requirement drafts assuming those — verified directly against `package.json` and source) plus the target state agreed section-by-section with the product owner.

---

## 1. Layered Architecture Pattern

Every domain follows the same three-layer shape, proven first on the FAQ feature and now the standing convention:

```
src/lib/
  repositories/   # pure data access (Supabase REST/client calls). No business rules, no auth.
  services/       # business rules, orchestration, validation composition. No direct Supabase calls.
  validation/      # zod schemas, one file per domain
  supabase/        # unchanged: client.ts, server.ts, middleware.ts, admin-auth.ts
  rate-limit.ts    # shared soft in-memory limiter (see §7)
```

**Rules:**
- Repositories know Supabase, nothing else.
- Services know business rules, call ≥1 repository, never touch `fetch`/Supabase directly.
- API routes are thin: `requireAdmin()` (admin routes) → parse+validate with zod → call one service method → shape the HTTP response. No business logic lives in a route file.
- Existing domains (products, orders, payments, users, settings, analytics — all currently direct-Supabase-call, no layering) are migrated into this shape **incrementally, module by module**, per the roadmap in §9. Nothing breaks in the process; each module's migration is verified by its own tests before the next begins.
- `CatalogService` (public tree-reading: `getTree()`, `getBreadcrumb()`) and `CategoryService` (admin mutation: create/update/reorder) both sit on the **same** `category-repository.ts` — one table (`categories`), two responsibilities. No separate "Catalog" table exists or is needed: the self-referential `categories.parent_id` already supports arbitrary-depth hierarchy (Pokémon → Indigo League → ... ), and "Series" in the original requirements maps to this same tree, not a new entity.

## 2. Target Folder Structure

```
src/lib/
  repositories/
    category-repository.ts
    product-repository.ts
    order-repository.ts
    payment-repository.ts
    banner-repository.ts
    contact-repository.ts
    audit-repository.ts
    analytics-repository.ts
    user-repository.ts
  services/
    catalog-service.ts        # read-side tree/breadcrumb over categories
    category-service.ts       # admin mutation-side over categories
    product-service.ts        # getBySlug (breadcrumb+related), search
    cart-service.ts           # thin — server-side re-validation, backs CheckoutService
    checkout-service.ts       # atomic order creation, server-side price truth
    order-service.ts          # guarded status state machine
    payment-service.ts        # verify/reject, signed screenshot URLs
    inventory-service.ts      # reservation lifecycle + expiry
    whatsapp-service.ts       # settings-table-sourced number + templates
    seo-service.ts            # JSON-LD builders, sitemap helpers
    analytics-service.ts      # real event capture + read aggregation
    user-service.ts           # profile, addresses, admin-access
    banner-service.ts
    contact-service.ts
    audit-service.ts          # record() + query(filters), used by every admin mutation
    media-service.ts          # centralized upload/replace/delete/validate/compress
    notification-service.ts   # transactional email (order confirmed, payment verified, low-stock)
  validation/
    faq.ts                    # existing
    banner.ts
    product.ts
    order.ts
    contact.ts
  rate-limit.ts
src/app/api/
  media/upload/route.ts, media/[...path]/route.ts
  contact/route.ts
  checkout/route.ts, checkout/[orderId]/screenshot/route.ts
  categories/route.ts, categories/tree/route.ts
  products/[slug]/route.ts, products/search/route.ts
  account/orders/route.ts, account/orders/[id]/route.ts
  admin/banners/... , admin/payments/[id]/verify|reject/route.ts
  admin/orders/[id]/status/route.ts
  admin/inventory/[productId]/route.ts, admin/inventory/low-stock/route.ts
  admin/audit/route.ts
```

Existing route groups `(shop)`, `(auth)`, `(account)`, `admin` are unchanged. `src/app/api/orders/route.ts` (dead code — unused by the real checkout flow), the empty `src/app/api/setup/` directory, and the duplicate `src/app/auth/redirect/` (superseded by `(auth)/redirect`) are removed as part of Phase 1 cleanup.

## 3. Database Schema

### 3.1 Unchanged tables
`profiles`, `addresses`, `wishlists`, `order_items`, `settings`, `newsletter_subscribers`, `faqs` — no changes.

### 3.2 New table — `banners`
```sql
CREATE TABLE public.banners (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  description TEXT,
  image_url TEXT NOT NULL,
  category_id UUID NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  display_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);
CREATE INDEX idx_banners_display_order ON public.banners(display_order) WHERE deleted_at IS NULL;
CREATE INDEX idx_banners_is_active ON public.banners(is_active) WHERE deleted_at IS NULL;
CREATE INDEX idx_banners_category_id ON public.banners(category_id);
CREATE UNIQUE INDEX idx_banners_display_order_unique ON public.banners(display_order) WHERE deleted_at IS NULL;

ALTER TABLE public.banners ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view active banners" ON public.banners
  FOR SELECT USING (is_active = TRUE AND deleted_at IS NULL);
```
`category_id` is the "catalogId" from the original requirements, pointed at the real `categories` table. No URLs are ever stored on the banner row — the category's `slug` is resolved via join at query time, so a banner never goes stale if a category's slug changes. `ON DELETE CASCADE` is a data-integrity safety net for the rare case a category row is hard-deleted directly in SQL (no admin UI does this today — categories are currently read-only/seed-managed). The actual "hide banner when its catalog disappears" behavior comes from `GET /api/banners` joining `categories` and filtering `categories.is_active = TRUE` — a banner's category going inactive removes it from the homepage immediately without touching the banner row. The partial unique index on `display_order` makes "reject duplicate display order" a real Postgres-level guarantee (`23505` → `409 Conflict`), not just an app-level check.

**Storage:** new public Supabase bucket `banners`, mirroring `products`/`settings`. Path convention managed by `MediaService`: `{namespace}/{uuid}-{timestamp}.{ext}`.

### 3.3 New table — `contact_messages`
```sql
CREATE TABLE public.contact_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new','read','replied')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_contact_messages_status ON public.contact_messages(status);
ALTER TABLE public.contact_messages ENABLE ROW LEVEL SECURITY;
-- No public SELECT policy — insert-only via the service-role-backed POST /api/contact route;
-- admin reads go through the service-role key in the admin API, not a public RLS policy.
```

### 3.4 `products` table additions
```sql
ALTER TABLE public.products
  ADD COLUMN rarity TEXT,
  ADD COLUMN condition TEXT,
  ADD COLUMN reserved_quantity INTEGER NOT NULL DEFAULT 0;
```
`rarity`/`condition` are plain nullable text, matching the existing `series`/`saga`/`collection` free-text convention rather than introducing a lookup table (consistent with "Series = category tree" — free-text product attributes stay free-text). `reserved_quantity` supports the inventory-reservation model in §3.5. Available-to-sell stock is always `stock_quantity - reserved_quantity`, never `stock_quantity` alone.

### 3.5 Inventory reservation + expiry
No new table for reservations themselves — `reserved_quantity` on `products` plus the existing `orders.status`/`created_at` is sufficient. Lifecycle:
- **Reserve:** `CheckoutService` increments each ordered product's `reserved_quantity` at order creation (inside the same transaction as the order/items/payment insert).
- **Consume:** `PaymentService.verify()` decrements both `stock_quantity` and `reserved_quantity` by the same amount when a payment is verified (order → `confirmed`).
- **Release:** `PaymentService.reject()` or `OrderService`'s cancel path decrements only `reserved_quantity` (stock is restored, nothing was ever removed from `stock_quantity`).
- **Expire (new, scheduled):** a Supabase **pg_cron** job, `release_expired_reservations`, runs hourly. It finds orders with `status IN ('pending', 'payment_verification') AND created_at < NOW() - INTERVAL '{reservation_expiry_hours}'` (new `settings` key, default `24`), releases their reservations via `InventoryService.releaseReservation()`, transitions the order to `cancelled`, and writes an `audit_logs` row (`action: 'auto_cancelled_expired'`). This closes the gap where a reservation could otherwise be held forever if a customer never uploads a screenshot or an admin never acts.

### 3.6 `payments.screenshot_url` — fix, not a schema change
Today the code uploads to the `payments` bucket (documented private) but calls `getPublicUrl()` on it — an inconsistency between the documented privacy model and actual behavior. Target: store the **storage path** (not a URL) in `payments.screenshot_url`, keep the bucket genuinely private, and have `PaymentService.getScreenshotUrl(payment)` generate a short-lived **signed URL** server-side, only for an authenticated admin viewing the order. Same column, corrected semantics — no migration required.

### 3.7 `audit_logs` / `analytics_events`
No schema changes. Both tables already have the right shape; today neither has a real application writer (`audit_logs` is entirely unused; `analytics_events` is read-only in the admin analytics widget with zero inserts anywhere). §5 and §9 make both real.

---

## 4. Complete Services & Repositories List

| Domain | Repository | Service | Responsibility |
|---|---|---|---|
| Catalog (read) | `category-repository.ts` | `catalog-service.ts` | `getTree()`, `getBreadcrumb(categoryId)` — backs `/api/categories/tree`, product breadcrumbs, and (future work, not this pass) replacing the navbar's currently-hardcoded links |
| Categories (admin) | *(same repo)* | `category-service.ts` | create/update/reorder |
| Products | `product-repository.ts` | `product-service.ts` | `getBySlug()` (breadcrumb + related products), `search(filters)` |
| Cart | — (zustand, `src/store/cart.ts`) | `cart-service.ts` | Thin — server-side re-validation of cart contents, called by `CheckoutService`; client-side cart state itself is unchanged |
| Checkout | `order-repository.ts`, `payment-repository.ts` | `checkout-service.ts` | Atomic order+items+payment+reservation creation; re-fetches every product's real price from the DB — **never trusts client-supplied prices/totals** |
| Orders | `order-repository.ts` | `order-service.ts` | Guarded status state machine (replaces today's any-status-to-any-status update with no guard); customer + admin read methods |
| Payments | `payment-repository.ts` | `payment-service.ts` | Verify/reject workflow, signed screenshot URLs, reservation consume/release side effects |
| Inventory | `product-repository.ts` (stock fields) | `inventory-service.ts` | Reservation lifecycle + expiry, low-stock threshold queries |
| WhatsApp | `settings-repository.ts` | `whatsapp-service.ts` | Single source of truth for phone number + message templates, reading the `settings` table (fixes today's bug where every call site reads a hardcoded env var instead, so admin edits to the WhatsApp number in Settings currently do nothing) |
| SEO | — | `seo-service.ts` | JSON-LD builders (product/org/breadcrumb/FAQ), sitemap helpers |
| Analytics | `analytics-repository.ts` | `analytics-service.ts` | Real event-capture writer (fixes today's fully-dead `analytics_events` pipeline) + read-side aggregation for the admin widget |
| Users | `user-repository.ts` | `user-service.ts` | Profile, addresses, admin-access management (currently scattered across `/api/account/profile` and `/api/admin/admins`) |
| Banners | `banner-repository.ts` | `banner-service.ts` | Full CRUD/toggle/reorder as designed in §1–2 of the original feature discussion |
| Contact | `contact-repository.ts` | `contact-service.ts` | Backs `POST /api/contact` and the admin inbox |
| Audit | `audit-repository.ts` | `audit-service.ts` | `record()` called by every admin mutation across every domain; `query(filters)` backs `GET /api/admin/audit` |
| Media | — (storage abstraction, no DB table) | `media-service.ts` | `upload(file, namespace)`, `replace()`, `delete()`, `validate()` (type/size/dimension), compression + metadata extraction (via `sharp`, the same library Next.js's own image optimizer uses) — single entry point for **every** upload in the app: Banners, Products, Categories, payment screenshots |
| Notifications | — | `notification-service.ts` | Transactional email (order confirmed, payment verified, low-stock alert) via Resend — **designed now, implemented in Phase 5** per the roadmap; gives `TASKS.md`'s long-pending "order confirmation email" item an actual architectural home |
| QR/Collectible | *(none)* | *(none)* | **Reserved, not built.** `POST /api/scan` and `GET /api/cards/:id` names are reserved (nothing else may claim them) for a future phase: QR scan → card info → video → character stats → collection progress → achievements. Requires new tables (`qr_codes`/`collectible_cards`, `user_collections`, `achievements`) not created now. Documented in `ROADMAP.md`/`API.md` only — no test file, no route file, until that phase actually begins. |

---

## 5. Complete API Structure

### 5.1 Public (no auth)
| Route | Backing service | Notes |
|---|---|---|
| `GET /api/banners` | BannerService | Active, non-deleted, ordered by `display_order` |
| `GET /api/faqs` | — | Existing, unchanged |
| `GET /api/products/:slug` | ProductService.getBySlug | Images, price, stock, rarity/condition, description, breadcrumb, related products |
| `GET /api/products/search` | ProductService.search | Typed `SearchFilters`: `q, categoryId, series, rarity, minPrice, maxPrice, sort, page, pageSize` — extensible by adding optional fields, no breaking changes |
| `GET /api/categories` | CatalogService.getFlat | Flat list, active only |
| `GET /api/categories/tree` | CatalogService.getTree | Nested tree — single source of truth for catalog navigation |
| `POST /api/newsletter` | — | Existing, rate-limited |
| `POST /api/contact` | ContactService | Rate-limited, writes to `contact_messages` |
| `POST /api/checkout` | CheckoutService | Rate-limited. Server-side price truth; atomic order+items+payment+reservation |
| `POST /api/checkout/:orderId/screenshot` | MediaService + PaymentService | Rate-limited. Upload goes through MediaService, not a direct browser→Storage call |
| `POST /api/auth/login` | — (thin wrapper) | Rate-limited at the app layer as a checkpoint in front of Supabase's own `signInWithPassword` |

### 5.2 Customer (authenticated)
| Route | Backing service |
|---|---|
| `PATCH /api/account/profile` | UserService — existing, unchanged |
| `GET /api/account/orders` | OrderService.listForCustomer — userId derived from session only, never client-supplied |
| `GET /api/account/orders/:id` | OrderService.getForCustomer |

### 5.3 Admin (`requireAdmin()` + rate limiter)
| Route | Backing service |
|---|---|
| `POST/PATCH/DELETE /api/admin/banners[/:id]`, `.../toggle`, `.../reorder` | BannerService |
| `POST/PATCH/DELETE /api/admin/faqs[/:id]` | — existing, unchanged |
| `GET/POST/DELETE /api/admin/admins` | — existing, unchanged |
| `GET /api/admin/analytics` | AnalyticsService (read) |
| `PATCH /api/admin/orders/:id/status` | OrderService — guarded transitions, replaces today's unguarded direct browser write |
| `PATCH /api/admin/payments/:id/verify`, `.../reject` | PaymentService |
| `POST/PATCH /api/admin/products[/:id]` | ProductService — moves server-side (currently `product-form.tsx` writes directly to Supabase from the browser) |
| `POST/PATCH /api/admin/categories[/:id]`, `.../reorder` | CategoryService — same reasoning |
| `PATCH /api/admin/inventory/:productId` | InventoryService |
| `GET /api/admin/inventory/low-stock` | InventoryService |
| `GET/PATCH /api/admin/settings` | Dispatches per key-namespace to WhatsAppService/SEOService/PaymentService(UPI fields) |
| `GET /api/admin/audit` | AuditService.query — filters: `userId, dateFrom, dateTo, action, tableName`. No admin UI page this pass |
| `POST /api/media/upload`, `DELETE /api/media/:path` | MediaService — single endpoint for every feature's uploads |

### 5.4 Reserved, not implemented
`POST /api/scan`, `GET /api/cards/:id` — names reserved for the future QR/collectible phase (§4). No files created now.

### 5.5 Removed
`src/app/api/orders/route.ts` (dead code, superseded by `/api/checkout`), `src/app/api/setup/` (empty directory), duplicate `src/app/auth/redirect/` (keeping only the `(auth)/redirect` route-group version).

---

## 6. Admin Panel Architecture

Grouped sidebar (replaces the current flat list of 9 items):

```
Dashboard

Catalog
  ├─ Categories        (existing page, API hardened in Phase 3)
  ├─ Products          (existing page, API hardened in Phase 3)
  └─ Inventory          (new — low-stock list, manual stock adjustment)

Sales
  ├─ Orders             (existing page, gains guarded status API in Phase 1)
  └─ Payments           (new — dedicated page)

Marketing
  └─ Banners            (new)

Support
  ├─ FAQs               (existing, unchanged)
  └─ Contact Messages   (new — inbox over contact_messages, mark read/replied)

People
  ├─ Users              (existing, unchanged)
  └─ Admin Access       (existing, unchanged)

Analytics              (existing page, now backed by a real event pipeline in Phase 6)

Settings                (existing page, reorganized into tabs:
                          Store · Payment/UPI · WhatsApp · SEO · Analytics Integrations)
```

- No nav item for Audit — `GET /api/admin/audit` exists as an API only, no UI this pass.
- Settings stays one page with tabs, not five separate pages — one key-value config store doesn't need sidebar sprawl, but each tab's *validation* is still owned by its respective service (`WhatsAppService` validates phone format, `SEOService` validates meta lengths, etc.) even though the UI is unified.
- Every admin table (Categories, Products, Inventory, Orders, Payments, Banners, Contact Messages, Users) follows the FAQ/Products visual contract already established: header + subtitle, consistent table columns, row actions, `sonner` toast feedback.
- Every mutating admin action — create, update, delete/soft-delete, status change, verify/reject payment, stock adjustment — writes an `audit_logs` row via `AuditService`, not just Banners.

---

## 7. Security & Cross-Cutting Concerns

**Rate limiting** — shared `src/lib/rate-limit.ts`, a soft in-memory sliding-window limiter (keyed by IP for public routes, userId for admin routes), applied to: `POST /api/checkout`, `POST /api/checkout/:id/screenshot`, `POST /api/auth/login`, `POST /api/newsletter`, `POST /api/contact`, and all `/api/admin/*` mutations. **Honest caveat, applying everywhere this is used:** this is best-effort and per-instance — it resets on cold start and isn't shared across serverless instances on Vercel. It deters casual abuse; it is not a hard guarantee. A hard guarantee needs Upstash Redis or similar, which is new infrastructure outside this pass's scope.

**Audit logging** — `AuditService.record(userId, action, tableName, recordId, oldValues, newValues)` called by every admin service method that mutates state, across every domain — finally putting the existing-but-dead `audit_logs` table to use everywhere, not just for Banners.

**MediaService validation** — server-side, authoritative (never trust client-side checks alone): file type allowlist (png/jpg/jpeg/webp), 2MB max, dimension checks per namespace (728×90 recommended for banners, warn-not-block). Upload/DB-write sequencing always cleans up on partial failure: if upload succeeds but the DB write fails, the orphaned file is deleted; when replacing an image, the old file is deleted only after the DB write for the new one succeeds.

**Auth/authorization** — unchanged: `requireAdmin()` gates every admin route; RLS remains the last line of defense on every table (public read of active/non-deleted rows only, all writes via service-role-backed routes — never anon-key writes from the browser, which is exactly the pattern being removed from Checkout, Orders, Products, and Categories).

**Input validation** — zod schema per domain in `src/lib/validation/`, matching the `faq.ts` convention. XSS: React's default escaping + existing CSP headers in `vercel.json`. SQL injection: not applicable anywhere in this codebase — no raw SQL string interpolation, only Supabase's parameterized query builder / typed RPC calls.

---

## 8. Testing Strategy

Same tooling as the FAQ feature (Jest + Playwright + `@axe-core/playwright`, already wired up) extended as **policy for every module going forward**, organized into named suites: `unit`, `integration`, `api`, `e2e`, `accessibility`, `performance`, `security`, `business`, `visual`, `regression`, `responsive`, `media`, `analytics`, `documentation`.

- **Unit** — every `service`/`repository` gets a co-located `.test.ts`; services tested with mocked repositories, repositories tested against their Supabase REST call shape (mocked `fetch`, per `admin-auth.test.ts`'s existing pattern).
- **API** — every route handler gets a `.test.ts` mocking `requireAdmin()`/the service layer, covering every status branch (400/401/403/404/409/500).
- **E2E** — one spec per critical customer flow (checkout incl. 5-item minimum + screenshot upload, product search/filter, category navigation) and one per admin CRUD flow (Banners, Payments verify/reject, Inventory adjustment).
- **Accessibility** — `AxeBuilder` assertion (zero violations) on every new public page.
- **Visual regression** — Playwright `toHaveScreenshot()` baselines on homepage (hero+banner carousel), product detail, checkout's 3 steps, admin Banners/Payments tables. ~0.2% pixel-diff threshold; baselines committed, updated only deliberately.
- **Cross-browser** — Playwright projects: `chromium`, `firefox`, `webkit`, plus a dedicated `msedge` project (`channel: 'msedge'`).
- **Responsive** — viewport matrix: Desktop (1920×1080), Laptop (1366×768), Tablet (768×1024), Mobile (375×812), Small Mobile (320×568).
- **Performance** — LCP < 2.5s, CLS < 0.1, TTFB < 600ms, FID < 100ms, first-load JS < 200KB gzipped/route, all images via `next/image` in WebP/AVIF. Lighthouse assertions are a per-feature opt-in (as decided for the FAQ feature), not a global gate.
- **Business rules** — 5-card minimum (server-side), reservation lifecycle + expiry job, manual UPI verify/reject, price-tampering protection, invalid checkout scenarios (empty cart, deleted/inactive product mid-checkout, insufficient stock), stock availability math.
- **Security** — `requireAdmin()` bypass attempts, rate-limit burst tests (429 after threshold), injection-style strings in filters (proving Supabase's parameterized builder treats them as literal data), XSS payloads (stored literal, rendered escaped), file upload validation (wrong MIME/oversized rejected).
- **Media** — upload, replace, delete, validation, compression, metadata extraction (via `sharp`, a new dependency).
- **Analytics** — asserts `AnalyticsService.record()` inserts a real row for a defined event taxonomy: `product_viewed`, `add_to_cart`, `checkout_started`, `order_placed`, `payment_verified`, plus key admin actions.
- **Documentation** — a Jest test diffing the current migration files' table list against `DATABASE.md`, and the actual `src/app/api/**` route list against `API.md`; fails CI on drift.
- **QR** — documentation only (scenarios written into `ROADMAP.md`/`API.md`); no test file until that phase begins.
- **QA Checklist** — each feature's implementation plan ends by generating a `qa-checklist.md` next to its spec, itemizing which of the 14 suite categories apply and their pass/fail status, becoming part of that feature's definition of done.

---

## 9. Documentation & AI-Memory Practice

| File | Audience | Content | Updated when |
|---|---|---|---|
| `README.md` | Humans | Setup, quick start, stack | Rarely — setup/stack changes only |
| `PROJECT_CONTEXT.md` | Humans + AI | Architecture decisions, business rules, page map | Whenever an architectural decision changes |
| `AI_MEMORY.md` (new) | Any AI coding session | Condensed "read this first," links to other docs, known gotchas | Whenever a non-obvious gotcha is found/resolved |
| `CHANGELOG.md` | Humans + AI | What has shipped, dated | Every merged module |
| `TASKS.md` | Humans + AI | Granular day-to-day pending work | Every session |
| `ROADMAP.md` (new) | Humans + AI | Phase-level plan (this document's §10, kept current) | When a phase completes or scope shifts |
| `API.md` (new) | Humans + AI | Every endpoint: method, path, auth, request/response shape | Every route change — mechanically checked (§8) |
| `DATABASE.md` (new) | Humans + AI | Every table: columns, constraints, RLS, relationships | Every migration — mechanically checked (§8) |
| `update.md` | Humans | Deployment log | Every deploy |

`AI_MEMORY.md` is a project-local, git-tracked file distinct from Claude Code's separate cross-project memory system (the private files under the assistant's own memory directory, which persist across different projects). Both coexist; `AI_MEMORY.md` travels with the repo and is visible to any tool or teammate.

**Session ritual:** read `README.md` → `PROJECT_CONTEXT.md` → `AI_MEMORY.md` → `CHANGELOG.md` → `TASKS.md` → `ROADMAP.md` before writing code. After a module ships, update whichever of these actually changed.

---

## 10. Development Roadmap — Phase 1 → Production

Ordered by dependency and risk, not by original request order.

| Phase | Scope | Rationale |
|---|---|---|
| **0 — Foundations** | Migration for §3.2–3.4; `MediaService` + upload API; **migrate `product-form.tsx` and `category-form.tsx`'s existing browser→Storage upload calls to go through `MediaService`** (upload mechanism only — their broader CRUD server-side hardening is separate, see Phase 3); `AuditService`; shared rate limiter; `CatalogService` + categories API; scaffold `API.md`/`DATABASE.md`/`ROADMAP.md`/`AI_MEMORY.md` with real current-state content | Everything else depends on at least one of these. Uploads move to `MediaService` immediately, per the product owner's explicit call to not defer this — distinct from the separate, larger CRUD-hardening effort in Phase 3 |
| **1 — Checkout/Order/Payment/Inventory integrity** | `CheckoutService`, `OrderService`, `PaymentService`, `InventoryService` + pg_cron expiry job, new `/admin/payments` page, migrate `checkout-client.tsx`/`order-status-updater.tsx` off direct browser writes, remove dead `/api/orders`, empty `/api/setup`, duplicate `auth/redirect` | Fixes the live price-tampering gap found in the audit — highest real risk today, outranks Banners despite Banners being the original ask |
| **2 — Banners** | Full feature as designed: `banner-repository.ts`/`banner-service.ts` (via `MediaService`), admin CRUD/drag-reorder page, homepage Framer Motion carousel | Fully spec'd already; builds once Phase 0 exists |
| **3 — Product/Category hardening** | Full `ProductService`/`CategoryService` server-side CRUD (migrate `product-form.tsx`/`category-form.tsx` to `MediaService`), `GET /api/products/:slug` + `/search`, rarity/condition in the admin form, navbar switched to `CatalogService`'s tree | Natural follow-on once Media/Catalog foundations exist |
| **4 — WhatsApp/SEO/Settings** | `WhatsAppService`/`SEOService` reading from `settings` (fixes the env-var disconnect bug), Settings reorganized into tabs, JSON-LD expanded to category/home pages | Fixes the second real bug found in the audit |
| **5 — Users/Contact/Support/Notifications** | Customer Orders API, `ContactService` + `/api/contact` + admin inbox, `UserService` formalization, `NotificationService` (order confirmation, payment verified, low-stock — via Resend) | No known bugs riding on it; `NotificationService` needs Phase 1's checkout/payment touchpoints to hook into |
| **6 — Analytics** | Real `AnalyticsService` event capture wired into the touchpoints created by Phases 1–5 | Needs those touchpoints to exist first |
| **7 — Audit API + full-suite polish + launch content** | `GET /api/admin/audit`, full visual/cross-browser/responsive/performance suites site-wide, **and the still-open Priority-1 launch items**: real products uploaded, UPI QR set, real WhatsApp number configured | Last mile before this is actually launchable |
| **8 — Future (reserved, not built)** | QR/Collectible system (`POST /api/scan`, `GET /api/cards/:id`, new tables) | Explicitly deferred, documented only |

---

## 11. Known Gaps, Explicitly Accepted or Deferred

- **Wishlist** has no dedicated service — folds into `UserService`/a thin repository whenever Phase 3/5 touches that page. Low-risk, low-traffic feature.
- **Newsletter** stays as its current direct-Supabase route (already rate-limited) — formalized into a service opportunistically, not urgent.
- **Rate limiting is per-instance, not distributed** — accepted tradeoff given no Redis/Upstash infra exists; documented everywhere it's used (§7).
- **QR/Collectible system** — names reserved, nothing built, no schema (§4, §10 Phase 8).
