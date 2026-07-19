# CHANGELOG — Legacy Mania

All notable changes are recorded here.

---

## [0.1.0] — 2026-06-22 — Initial Build

### Added — Core Platform

#### Configuration
- `package.json` with Next.js 15, TypeScript, TailwindCSS, Shadcn UI dependencies
- `next.config.ts` with image optimization and remote patterns
- `tailwind.config.ts` with custom color system, animations, and utilities
- `tsconfig.json` with strict mode
- `.env.local.example` with all required environment variables
- `vercel.json` with security headers and deployment config
- `.gitignore` configured

#### Database
- `supabase/migrations/001_initial_schema.sql` — Complete PostgreSQL schema
  - Tables: profiles, addresses, categories, products, wishlists, orders, order_items, payments, settings, audit_logs, analytics_events
  - Row Level Security on all tables
  - Auto-create profile trigger on user signup
  - Updated_at trigger on all tables
  - Seeded default categories (Pokémon, DBZ, Naruto, One Piece, Digimon, Yu-Gi-Oh!)
  - Seeded subcategories for Pokémon and Dragon Ball Z
  - Seeded default settings

#### TypeScript Types
- `src/types/supabase.ts` — Full database type definitions
- `src/types/index.ts` — App-level types (Cart, Order, Product, etc.)

#### Supabase Library
- `src/lib/supabase/client.ts` — Browser client
- `src/lib/supabase/server.ts` — Server client + admin client
- `src/lib/supabase/middleware.ts` — Auth session management

#### Utilities
- `src/lib/utils.ts` — formatCurrency, slugify, generateOrderNumber, WhatsApp URL helpers, status helpers, Indian states list
- `src/middleware.ts` — Route protection for admin and account pages

#### State Management
- `src/store/cart.ts` — Zustand cart store with persistence
- `src/store/wishlist.ts` — Zustand wishlist store with persistence

#### Providers
- `src/components/providers/theme-provider.tsx` — Dark/light theme
- `src/components/providers/cart-provider.tsx` — Cart hydration
- `src/components/providers/analytics-provider.tsx` — GTM + GA4

#### Layout Components
- `src/app/layout.tsx` — Root layout with metadata, fonts, providers
- `src/app/globals.css` — Global styles with CSS variables, utilities, animations
- `src/components/layout/navbar.tsx` — Sticky navbar with cart badge
- `src/components/layout/mobile-menu.tsx` — Slide-out mobile navigation
- `src/components/layout/footer.tsx` — Full footer with links and social
- `src/components/layout/whatsapp-button.tsx` — Floating WhatsApp button

#### Pages — Shop
- `src/app/(shop)/layout.tsx` — Shop layout with Navbar + Footer
- `src/app/(shop)/page.tsx` — Home page (server component)
- `src/app/(shop)/about/page.tsx` — About Us page
- `src/app/(shop)/catalog/page.tsx` — Catalog page (server)
- `src/app/(shop)/catalog/catalog-client.tsx` — Catalog with filters
- `src/app/(shop)/products/[slug]/page.tsx` — Product detail (server)
- `src/app/(shop)/products/[slug]/product-page-client.tsx` — Product detail (client)
- `src/app/(shop)/checkout/page.tsx` — Checkout page
- `src/app/(shop)/checkout/checkout-client.tsx` — Full checkout flow with UPI payment
- `src/app/(shop)/search/page.tsx` — Search results

#### Home Sections
- `src/components/home/hero-section.tsx` — Animated hero with floating cards
- `src/components/home/featured-collections.tsx` — Featured products grid
- `src/components/home/popular-categories.tsx` — Category browser
- `src/components/home/latest-releases.tsx` — Latest products
- `src/components/home/testimonials.tsx` — Customer reviews
- `src/components/home/whatsapp-cta.tsx` — WhatsApp call-to-action
- `src/components/home/newsletter.tsx` — Email subscription

#### Product Components
- `src/components/product/product-card.tsx` — Product card with quick-add, wishlist

#### Cart
- `src/components/cart/cart-drawer.tsx` — Slide-out cart with minimum order enforcement

#### Auth Pages
- `src/app/(auth)/layout.tsx` — Auth layout
- `src/app/(auth)/login/page.tsx` — Login form
- `src/app/(auth)/register/page.tsx` — Registration form

#### Account Pages
- `src/app/(account)/layout.tsx` — Account layout with sidebar
- `src/app/(account)/account/page.tsx` — Profile overview
- `src/app/(account)/account/orders/page.tsx` — Order history
- `src/app/(account)/account/wishlist/page.tsx` — Wishlist management
- `src/components/account/account-sidebar.tsx` — Account navigation

#### Admin Dashboard
- `src/app/admin/layout.tsx` — Admin layout with sidebar
- `src/app/admin/page.tsx` — Dashboard with stats and pending payments
- `src/app/admin/products/page.tsx` — Product table
- `src/app/admin/products/new/page.tsx` — Add product
- `src/app/admin/orders/page.tsx` — Orders table
- `src/app/admin/orders/[id]/page.tsx` — Order detail + payment verification
- `src/app/admin/categories/page.tsx` — Category management
- `src/app/admin/users/page.tsx` — User management
- `src/app/admin/analytics/page.tsx` — Analytics overview
- `src/app/admin/settings/page.tsx` — Settings (UPI, WhatsApp, SEO, Analytics)
- `src/components/admin/admin-sidebar.tsx` — Admin navigation
- `src/components/admin/admin-header.tsx` — Admin header
- `src/components/admin/product-form.tsx` — Add/edit product form
- `src/components/admin/category-form.tsx` — Add/edit category form
- `src/components/admin/order-status-updater.tsx` — Order status management

#### API Routes
- `src/app/api/products/route.ts` — Products API with filtering/sorting/pagination
- `src/app/api/orders/route.ts` — Create order API
- `src/app/api/admin/analytics/route.ts` — Analytics data API

#### SEO
- `src/app/sitemap.ts` — Dynamic sitemap generator
- `src/app/robots.ts` — Robots.txt

#### Documentation
- `README.md` — Setup guide, project overview
- `PROJECT_CONTEXT.md` — Architecture decisions, business rules
- `CHANGELOG.md` — This file
- `TASKS.md` — Pending work
- `update.md` — Deployment log

---

---

## [0.2.0] — 2026-06-22 — Priority 2 Feature Completion

### Added

#### Account Pages
- `src/app/(account)/account/addresses/page.tsx` — Full address CRUD (add/edit/delete/set default), modal form, label selector (Home/Work/Other)
- `src/app/(account)/account/settings/page.tsx` — Edit name/phone, change password, sign out all devices
- `src/app/(account)/account/orders/[id]/page.tsx` — Order detail: items, delivery address, payment status, order timeline

#### Auth Pages
- `src/app/(auth)/forgot-password/page.tsx` — Email input with success confirmation screen
- `src/app/(auth)/reset-password/page.tsx` — Set new password after clicking email reset link

#### Shop Pages
- `src/app/(shop)/catalog/[slug]/page.tsx` — Category-filtered catalog (e.g. `/catalog/pokemon`, `/catalog/naruto`)

#### Admin Pages
- `src/app/admin/products/[id]/edit/page.tsx` — Edit existing product (reuses ProductForm component)

### Changed
- `src/app/(shop)/catalog/catalog-client.tsx` — Added `pageTitle` and `pageDescription` props for category pages
- `src/app/(account)/account/orders/page.tsx` — Order list items now link to individual order detail pages
- `supabase/migrations/001_initial_schema.sql` — Addresses table: added `label` column, renamed `address_line1` → `street`, added `updated_at`
- `src/lib/supabase/middleware.ts` — `encodeURIComponent` on login redirect param

### Build
- All 33 routes compile cleanly (up from 22 in v0.1.0)
- Zero TypeScript errors

---

## [0.3.0] — 2026-06-22 — Policy Pages, Soft-Delete, JSON-LD

### Added

#### Policy & Info Pages
- `src/app/(shop)/faq/page.tsx` — 12 Q&As, accordion with `<details>/<summary>`
- `src/app/(shop)/shipping-policy/page.tsx` — Full shipping coverage, timelines, packaging info
- `src/app/(shop)/return-policy/page.tsx` — Return eligibility, process, refund timeline
- `src/app/(shop)/privacy-policy/page.tsx` — Data collection, usage, cookies, user rights
- `src/app/(shop)/terms/page.tsx` — Full T&Cs including IP, liability, governing law
- `src/app/(shop)/contact/page.tsx` — WhatsApp button, email copy, business hours, location

#### Admin Improvements
- `src/app/admin/products/products-table.tsx` — New client component with toggle-visibility and soft-delete (sets `is_active = false`)

#### SEO
- Product pages now emit JSON-LD `Product` structured data with price, availability, seller

### Changed
- `src/app/admin/products/page.tsx` — Refactored to use `ProductsTable` client component
- Footer already contained correct links for all new policy pages

### Build
- 39 routes compiled (up from 33 in v0.2.0)
- Zero TypeScript errors

---

---

## [0.4.0] — 2026-06-22 — Pagination, Newsletter Backend

### Added
- `src/app/api/newsletter/route.ts` — POST endpoint that upserts email into `newsletter_subscribers` table
- `supabase/migrations/001_initial_schema.sql` — Added `newsletter_subscribers` table with RLS
- Catalog pagination — URL-param based (`?page=N`), 24 products per page, smart ellipsis pagination UI

### Changed
- `src/components/home/newsletter.tsx` — Now calls `/api/newsletter` instead of simulated timeout
- `src/app/(shop)/catalog/page.tsx` — Uses `.range()` for server-side pagination; wrapped CatalogClient in Suspense
- `src/app/(shop)/catalog/catalog-client.tsx` — Added pagination UI (prev/next + page numbers)
- `src/app/(shop)/catalog/[slug]/page.tsx` — Wrapped in Suspense

### Build
- 40 routes compiled

---

## [0.7.0] — 2026-07-06 — Phase 0 Foundations

### Added — Database

- `supabase/migrations/003_platform_foundations.sql` — Added `banners` and `contact_messages` tables; added `rarity`, `condition`, and `reserved_quantity` columns to `products` (applied to the live Supabase project during Phase 1 verification)

### Added — Services & Infrastructure

- `src/lib/rate-limit.ts` — Shared in-memory rate limiter used across API routes
- `src/lib/services/audit-service.ts` (+ repository) — `AuditService` gives the previously-unused `audit_logs` table its first real writer
- `src/lib/services/media-service.ts` — Centralized file upload service with validation via `sharp`
- `src/app/api/media/upload/route.ts` — `POST /api/media/upload` endpoint backed by `MediaService`
- `src/app/api/media/[...path]/route.ts` — `DELETE /api/media/[...path]` endpoint backed by `MediaService`
- `src/lib/services/catalog-service.ts` + `src/lib/repositories/category-repository.ts` — `CatalogService` for category tree/breadcrumb resolution
- `src/app/api/categories/route.ts` — Public `GET /api/categories`
- `src/app/api/categories/tree/route.ts` — Public `GET /api/categories/tree`

### Changed

- `src/components/admin/product-form.tsx` — Migrated to upload product images via `POST /api/media/upload` instead of calling Supabase Storage directly

### Added — Documentation

- `API.md` — API route reference
- `DATABASE.md` — Database schema reference
- `ROADMAP.md` — Product roadmap
- `AI_MEMORY.md` — AI developer context/memory notes

### Verified

- Full test suite: 18 suites / 79 tests passing
- `npm run type-check`: no errors

See `TASKS.md` for the full list.

---

## [0.8.0] — 2026-07-14 — Phase 1: Checkout/Order/Payment/Inventory Integrity

### Fixed — Security & Data Integrity

- Checkout now creates orders entirely server-side via a new atomic `create_order` Postgres RPC, which re-derives every price from the live `products` table — closes the gap where a client could previously submit arbitrary prices/totals directly to the database
- Order status transitions are now guarded by an explicit state machine (`OrderService`); invalid transitions are rejected with a 409 instead of silently corrupting order state
- Payment verification/rejection now correctly manages stock reservations end-to-end: `reserved_quantity` increments on order creation and is either consumed (stock decremented) or released depending on the payment outcome — previously reservations were never tracked at all
- Payment screenshots are now served via signed URLs from a genuinely private Supabase Storage bucket — previously the code called `getPublicUrl()` on a private bucket, which never worked
- A scheduled `pg_cron` job auto-cancels stale unconfirmed orders and releases their reservations hourly
- Fixed two write-ordering bugs (found and fixed during review) where a dependent status/payment field was persisted before an operation that could still fail, risking permanently inconsistent state: `OrderService.updateStatus` and `PaymentService.verifyPayment`/`rejectPayment` now perform the risky operation first and only persist the "succeeded" status after
- Fixed a state-regression hole in the guest screenshot-upload route where resubmitting a screenshot could silently force an already-progressed order backward — the route now goes through the guarded state machine instead of a raw DB write
- Fixed a pre-existing `profiles` table RLS infinite-recursion bug (discovered during this phase's live verification) that was silently breaking the product detail page and any other query embedding an admin-gated table

### Added

- `InventoryService`, `OrderService`, `PaymentService`, `CheckoutService` — new service layer for checkout/order/payment logic, following the repository → service → route pattern from Phase 0
- `POST /api/checkout`, `POST /api/checkout/:orderId/screenshot`, `PATCH /api/admin/orders/:id/status`, payment verify/reject routes
- `/admin/payments` page for admins to verify/reject payments and view screenshots

### Removed

- Dead `/api/orders` route (superseded by `/api/checkout`), duplicate `auth/redirect` route, empty `/api/setup` directory

### Verified

- Full test suite: 29 suites / 133 tests passing
- `npm run type-check`: no errors
- Live end-to-end verification against production Supabase: real order created with server-computed pricing, reservation incremented on order, stock decremented and reservation released on admin verify

See `TASKS.md` for the full list.

---

## [0.8.1] — 2026-07-19 — Analytics API Security Fix

### Fixed — Security

- `GET /api/admin/analytics` previously had **no authentication at all** — any anonymous caller could read total revenue, order/user/product counts, and order-status breakdowns. Now guarded by `requireAdmin()` (401 anon / 403 non-admin), rate-limited (30/min per IP, 429 + Retry-After), and audit-logged via `AuditService` (`analytics.view` on success, `analytics.access_denied` on failed attempts, including caller IP)
- Analytics queries moved out of the route into a proper `analytics-repository` → `analytics-service` layer per project architecture; response shape unchanged (admin dashboard untouched). Response contains aggregates only — no per-customer rows, so no PII can leak
- `audit-repository`'s `userId` is now optional (stored as `NULL`) so anonymous failed-auth events can be recorded

### Verified

- Full test suite: 31 suites / 145 tests passing (10 new: service aggregation, PII-shape guard, 401/403/429/500 route paths, audit-log assertions)

---

## [0.9.0] — 2026-07-19 — Dynamic Homepage Notification Engine

### Added

- `homepage_notifications` table (migration `007`, **must be applied manually via Supabase SQL Editor**): 13 notification types, schedule window, device targeting, priority + display order, theme/icon/colors, soft delete, future-ready `target_audience`/`country` columns. Seeds the 7 previously hardcoded announcement messages
- Display config stored in `settings.homepage_notifications_display` (marquee speed, direction, pause-on-hover, colors, font, per-device visibility)
- Notification repository + service (`notification-repository.ts`, `notification-service.ts`) with storefront feed (`getHomepageNotifications` — never throws, homepage degrades to no bar), CRUD, duplicate-as-draft, reorder, bulk actions, display-config merge
- Admin APIs under `/api/admin/notifications` (list/create, update/soft-delete, duplicate, reorder, bulk, display-settings) — all rate-limited (60/min/IP), `requireAdmin()`-guarded, zod-validated, audit-logged
- Admin UI: **Marketing → Homepage Notifications** (`/admin/marketing/notifications`) — search, type/status filters, drag-and-drop + arrow reordering, live marquee preview, create/edit dialog with scheduling, duplicate, bulk activate/hide/delete, display-settings panel

### Changed

- Homepage announcement bar is now fully dynamic: server-fetched from the database (SSR — no layout shift, no client fetch), renders nothing when no live notifications exist, honors admin-configured speed/direction/colors/visibility. Hardcoded message array removed

### Verified

- Full test suite: 36 suites / 187 tests passing (42 new across validation, repository/service, API routes, announcement-bar component)
- `npx tsc --noEmit`: clean
