# TASKS.md — Legacy Mania

Pending and future work. AI Developer: check this before every session.

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
- [x] **Homepage announcement banner** — Scrolling announcement bar component
- [x] **Google Search Console verification** — Meta tag + verification file added
- [x] **Next.js security upgrade** — Upgraded to 16.2.9, patches CVE-2025-66478 (RCE)
- [x] **Profile update fix** — Routed through server API with service role key (was silently failing via browser client)

## 🟢 Priority 3 — Enhancement

- [x] **Soft-delete products** — Admin products table now has toggle visibility + remove (sets `is_active = false`)
- [x] **JSON-LD structured data** — Product pages now emit `Product` schema with price, availability, seller
- [x] **FAQ page** — `/faq` with 12 Q&As, accordion-style
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
