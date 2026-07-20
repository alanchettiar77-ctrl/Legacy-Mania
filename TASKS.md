# TASKS.md — Legacy Mania

Pending and future work. AI Developer: check this before every session.

> **Note:** The FAQ system (previously tracked here as in-progress on an unmerged worktree) has
> since been merged to master. The follow-up item it surfaced (`/api/admin/analytics` had no
> admin auth guard) was fixed 2026-07-19: requireAdmin + rate limit + audit logging.
>
> **Migration 009** (`login_attempts` table + cleanup cron) must be applied in the Supabase SQL
> Editor before account lockout works live — same manual-apply step as migration 007.

---

## 🔴 Priority 1 — Required Before Launch

- [x] **Supabase setup** — Project created, `.env.local` has live Supabase URL/anon/service-role keys
- [x] **Environment variables** — `.env.local` fully populated (Supabase, WhatsApp, analytics)
- [x] **Admin account** — Admin login/redirect flow working; `/admin/admins` page manages access with owner protection
- [ ] **Upload UPI QR** — via Admin → Settings → UPI Payment (verify still set after recent settings work)
- [x] **Set WhatsApp number** — `NEXT_PUBLIC_WHATSAPP_NUMBER` set in `.env.local`
- [ ] **Add product catalog** — Verify real products are uploaded via Admin → Products → Add Product
- [ ] **Set up categories** — Verify seeded categories are correct
- [ ] **Deploy to Vercel** — Confirm production deploy is live and env vars match `.env.local`
- [ ] **Reconcile migration** — `supabase/migrations/001_initial_schema.sql` has uncommitted local changes; confirm they match the live Supabase schema, then commit

---

## 🟡 Priority 2 — Core Features

- [x] **Category catalog page** — `/catalog/[slug]` page for individual category browsing
- [x] **Account addresses** — `/account/addresses` CRUD page (add, edit, delete, default)
- [x] **Account settings** — `/account/settings` — Edit name, phone, change password
- [x] **Forgot password** — `/forgot-password` + `/reset-password` flow via Supabase
- [x] **Order tracking** — Customer-facing order detail page `/account/orders/[id]`
- [x] **Edit product** — `/admin/products/[id]/edit` page
- [ ] **Order confirmation email** — Send email via Supabase Edge Functions or Resend
- [ ] **Delete product** — Soft-delete with `is_active = false` from admin table
- [ ] **Pagination** — Catalog and admin product list pagination
- [ ] **OG Image** — Create `/public/og-image.jpg` for social sharing

---

## 🟢 Priority 3 — Enhancement (recent, undocumented until now)

- [x] **Admin access management** — `/admin/admins` page to add/remove admins, with owner-account protection
- [x] **Post-login role routing** — `/auth/redirect` server page routes admins → `/admin`, customers → `/account` after login
- [x] **Homepage announcement banner** — Scrolling announcement bar component (now database-driven — see below)
- [x] **Dynamic homepage notifications (2026-07-19)** — `homepage_notifications` table + Marketing → Homepage Notifications admin page (search/filter/reorder/schedule/bulk/preview); announcement bar fetches from DB, hides when empty. **Migration `007` must be applied in the Supabase SQL Editor before this works live**
- [x] **Google Search Console verification** — Meta tag + verification file added
- [x] **Next.js security upgrade** — Upgraded to 16.2.9, patches CVE-2025-66478 (RCE)
- [x] **Profile update fix** — Routed through server API with service role key (was silently failing via browser client)

## 🟢 Priority 3 — Enhancement

- [x] **Soft-delete products** — Admin products table now has toggle visibility + remove (sets `is_active = false`)
- [x] **JSON-LD structured data** — Product pages now emit `Product` schema with price, availability, seller
- [x] **FAQ page** — `/faq`, now database-driven (`faqs` table) instead of hardcoded, 12 seeded Q&As, Radix accordion
- [x] **Admin FAQ management** — `/admin/faqs` page: add/edit/reorder/hide/delete FAQs against the `faqs` table via `/api/admin/faqs*` routes
- [x] **Shipping policy** — `/shipping-policy` with full delivery info
- [x] **Return policy** — `/return-policy` with eligibility, process, refund timeline
- [x] **Privacy policy** — `/privacy-policy` with GDPR-style detail
- [x] **Terms & Conditions** — `/terms`
- [x] **Contact page** — `/contact` with WhatsApp button, email, business hours
- [x] **Catalog pagination** — URL-based pagination (24 per page), prev/next + page numbers with ellipsis
- [x] **Newsletter backend** — `/api/newsletter` route saves to `newsletter_subscribers` Supabase table
- [ ] **Product image gallery** — Lightbox/zoom on product page
- [ ] **Advanced filtering** — Price range filter in catalog
- [ ] **WhatsApp order notification** — Auto-send order details to admin WhatsApp on new order
- [ ] **Product reviews/ratings** — Customer review system
- [ ] **Newsletter backend** — Save emails to Supabase `newsletter_subscribers` table
- [ ] **Audit log viewer** — Admin panel for audit logs
- [ ] **Export orders** — CSV export from admin orders page
- [ ] **Bulk product upload** — CSV import for products
- [ ] **OG Image** — Create `/public/og-image.jpg` placeholder for social sharing

---

## 🔵 Priority 4 — SEO & Marketing

- [x] **Structured data** — JSON-LD Product schema on product pages ✅
- [ ] **Google Search Console** — Submit sitemap after deploy
- [ ] **Inventory alerts** — Admin notification when stock < 5

---

## 🔲 Priority 5 — Future

- [ ] **PWA** — Installable app with service worker
- [ ] **Push notifications** — Order updates
- [ ] **Referral system** — Share and earn credits
- [ ] **Gift cards** — Digital gift cards
- [ ] **Coupon codes** — Discount system
- [ ] **Stock alerts** — "Notify me when back in stock"
- [ ] **Loyalty points** — Reward system
- [ ] **Multi-language** — Hindi support

---

## ⚪ Phase 0 — Foundations

- [x] **Database schema additions** — `banners` and `contact_messages` tables; `rarity`, `condition`, `reserved_quantity` columns on `products` (migration applied to the live Supabase project during Phase 1 verification)
- [x] **Shared rate limiter** — `src/lib/rate-limit.ts`
- [x] **AuditService** — `src/lib/services/audit-service.ts` + repository; first real writer for the previously-unused `audit_logs` table
- [x] **MediaService** — `src/lib/services/media-service.ts` centralizes file uploads with `sharp` validation; new `POST /api/media/upload` and `DELETE /api/media/[...path]` routes
- [x] **Product form migrated to MediaService** — `product-form.tsx` now uploads via the new endpoint instead of calling Supabase Storage directly
- [x] **CatalogService + categories API** — `src/lib/services/catalog-service.ts` + `category-repository.ts` for category tree/breadcrumb resolution; public `GET /api/categories` and `GET /api/categories/tree` routes
- [x] **New docs** — `API.md`, `DATABASE.md`, `ROADMAP.md`, `AI_MEMORY.md`

---

## ⚪ Phase 1 — Checkout/Order/Payment/Inventory Integrity

- [x] **RLS tightening** — Removed wide-open `WITH CHECK (TRUE)`/`USING (TRUE)` insert/update policies on `orders`/`order_items`/`payments`; all writes now go through service-role-backed API routes
- [x] **`create_order`/`consume_reservation`/`release_reservation` RPCs** — Atomic order creation with row locks, server-derived pricing, and stock reservation (`supabase/migrations/004_checkout_integrity.sql`)
- [x] **Reservation-expiry cron** — Hourly `pg_cron` job auto-cancels stale `pending`/`payment_verification` orders and releases their reservations
- [x] **`MediaService` payments namespace + signed URLs** — Private `payments` storage bucket, `getSignedMediaUrl()` for screenshot access (fixes previously-broken `getPublicUrl()` call on a private bucket)
- [x] **`InventoryService`** — `consumeReservation`/`releaseReservation` wrapping the new RPCs
- [x] **`OrderService`** — Guarded status state machine (`ALLOWED_TRANSITIONS`); inventory mutation now runs and succeeds before the DB status write is persisted, so a partial inventory failure can't leave an order stuck in a corrupted, unretryable state
- [x] **`PaymentService`** — `verifyPayment`/`rejectPayment`/`getPaymentScreenshotUrl`; order transition now runs before the payment status write, for the same reason as above
- [x] **`CheckoutService`** — Server-side price truth (RPC re-derives prices from `products`, never trusts client input) + 5-card minimum enforced server-side
- [x] **`POST /api/checkout`** — Guest-friendly order creation, rate-limited
- [x] **`POST /api/checkout/:orderId/screenshot`** — Payment screenshot upload; order status change now routed through `OrderService.updateStatus` instead of a raw write, closing a state-regression hole where a guest could resubmit a screenshot and silently force an already-progressed order backward
- [x] **`PATCH /api/admin/orders/:id/status`** — Admin-guarded status transitions (409 on invalid transition)
- [x] **Payment verify/reject routes + `/admin/payments` page** — Admin UI to verify/reject payments and view signed screenshot URLs
- [x] **Migrated `checkout-client.tsx` and `order-status-updater.tsx`** — Both now call the new server-side APIs; "Confirmed" removed from the admin status dropdown (reachable only via Payments page Verify)
- [x] **Removed dead code** — `/api/orders` (superseded), duplicate `auth/redirect` route, empty `/api/setup`
- [x] **Fixed `profiles` RLS infinite recursion** (discovered during live verification, unrelated to this phase's plan but blocking it) — `public.is_admin()` `SECURITY DEFINER` helper replaces 10 self-referencing `EXISTS (SELECT ... FROM profiles ...)` policy checks that were causing Postgres error 42P17 on any query embedding an admin-gated table (this was silently breaking the product detail page's category join) — `supabase/migrations/005_fix_profiles_rls_recursion.sql`
- [x] **Live verification** — Full checkout → screenshot → admin-verify flow run against production Supabase with a real product: order created with correct server-computed price, `reserved_quantity` incremented on order, `stock_quantity` decremented and `reserved_quantity` released on verify

---

## ✅ Completed

- [x] `/catalog/[slug]` — Category browse page with filtered products
- [x] `/account/addresses` — Full address CRUD (add, edit, delete, set default)
- [x] `/account/settings` — Edit profile name/phone, change password
- [x] `/forgot-password` — Email input + success screen
- [x] `/reset-password` — Set new password from email link
- [x] `/account/orders/[id]` — Order detail with items, timeline, payment, delivery
- [x] `/admin/products/[id]/edit` — Edit existing product
- [x] DB migration updated — addresses table: added `label`, renamed `address_line1` → `street`
- [x] Orders list — now links to individual order detail pages
- [x] Project initialization (Next.js 15 + TypeScript + TailwindCSS)
- [x] Database schema (11 tables, RLS, triggers)
- [x] Supabase client setup (browser + server + middleware)
- [x] TypeScript types (full database types)
- [x] Zustand stores (cart + wishlist)
- [x] Root layout with metadata and SEO
- [x] Navbar with cart badge
- [x] Mobile menu
- [x] Footer
- [x] WhatsApp floating button
- [x] Cart drawer with minimum order enforcement
- [x] Home page (all 7 sections)
- [x] About Us page
- [x] Catalog page with search + filter + sort
- [x] Product detail page
- [x] Checkout flow (3 steps: details → UPI payment → confirmation)
- [x] Login page
- [x] Registration page
- [x] Account profile page
- [x] Order history page
- [x] Wishlist page
- [x] Admin dashboard with stats
- [x] Admin products table + add product form
- [x] Admin orders table + order detail + status updater
- [x] Admin categories page with hierarchical form
- [x] Admin users page
- [x] Admin analytics page
- [x] Admin settings (UPI, WhatsApp, SEO, Analytics, Store)
- [x] API routes (products, orders, admin analytics)
- [x] Dynamic sitemap.xml
- [x] robots.txt
- [x] vercel.json with security headers
- [x] README.md
- [x] PROJECT_CONTEXT.md
- [x] CHANGELOG.md
- [x] TASKS.md
- [x] update.md
