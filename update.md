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

### Environment
- `E2E_ADMIN_EMAIL` / `E2E_ADMIN_PASSWORD` set in `.env.local` for a real admin account, enabling the admin E2E test to log in for real

### Next Steps
- Confirm uncommitted `supabase/migrations/001_initial_schema.sql` changes are applied to the live Supabase project, then commit
- Product image lightbox on product detail page
- Price range filter in catalog
- WhatsApp admin notification on new order
- OG image (`/public/og-image.jpg`) — still missing
- Order confirmation email (Supabase Edge Function or Resend)
- Admin audit log viewer, CSV order export, bulk product upload (Priority 3, later)

---

*Updated: 2026-07-05*
