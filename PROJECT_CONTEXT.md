# PROJECT_CONTEXT.md — Legacy Mania

**AI Developer: Read this file before every coding session.**

---

## Project Identity

- **Name:** Legacy Mania
- **Tagline:** "Collect The Stories That Shaped Generations."
- **Domain:** legacymania.in (planned)
- **Type:** B2C E-commerce — Anime Collectible Cards
- **Target Market:** India (INR currency, Indian states, UPI payment)

---

## Business Rules

### Ordering
- Minimum order quantity: **5 cards**
- Cart must enforce this — block checkout if count < 5
- Show warning: "Minimum order quantity is 5 cards."

### Payment
- **No payment gateway** — UPI only
- Admin uploads UPI QR code via settings panel
- Customer scans QR, pays, uploads screenshot
- Order status flow: `pending → payment_verification → confirmed → processing → shipped → delivered`
- Admin manually verifies payment and updates status

### WhatsApp
- Phone number stored in settings table (key: `whatsapp_number`)
- Default: `919876543210`
- Used for: floating button, order confirmation, product inquiry, product sharing

---

## Architecture Decisions

### Next.js App Router
- All pages use App Router (`src/app/`)
- Server Components for data fetching (no client-side fetch on page load)
- Client Components marked with `"use client"` for interactivity

### Supabase
- Database: PostgreSQL via Supabase
- Auth: Supabase Auth (email/password)
- Storage: 3 buckets — `products` (public), `payments` (private), `settings` (public)
- RLS: Row Level Security enabled on all tables

### State Management
- **Cart:** Zustand with localStorage persistence
- **Wishlist:** Zustand with localStorage persistence (guest-friendly)
- **Auth:** Supabase session (server-side, SSR-safe)

### Route Groups
- `(shop)` — Public store pages with Navbar + Footer
- `(auth)` — Login/Register with minimal header
- `(account)` — Protected user account pages
- `admin` — Protected admin pages with sidebar

---

## Database Tables

| Table | Purpose |
|-------|---------|
| `profiles` | User profiles (extends auth.users) |
| `addresses` | User saved addresses |
| `categories` | Hierarchical (parent_id for subcategories) |
| `products` | Full product catalog |
| `wishlists` | User wishlist items |
| `orders` | Order records |
| `order_items` | Line items per order |
| `payments` | UPI payment records + screenshot |
| `settings` | Key-value store for site settings |
| `audit_logs` | All changes logged |
| `analytics_events` | Custom event tracking |

---

## Category Structure

```
Pokémon
├── Indigo League
├── Orange Islands
├── Johto
├── Hoenn
└── Sinnoh

Dragon Ball Z
├── Saiyan Saga
├── Frieza Saga
├── Cell Saga
└── Buu Saga

Naruto
One Piece
Digimon
Yu-Gi-Oh!
```

Admin can add unlimited categories and subcategories from `/admin/categories`.

---

## Page Map

| URL | Description |
|-----|-------------|
| `/` | Home (Hero, Featured, Categories, Latest, Testimonials, WhatsApp CTA, Newsletter) |
| `/catalog` | Filterable product catalog |
| `/catalog/[slug]` | Category-filtered catalog |
| `/products/[slug]` | Product detail page |
| `/about` | Company story, mission, vision |
| `/search` | Search results |
| `/checkout` | 3-step checkout (Details → Payment → Confirmation) |
| `/login` | Auth |
| `/register` | Auth |
| `/account` | Profile overview |
| `/account/orders` | Order history |
| `/account/wishlist` | Wishlist |
| `/account/addresses` | Saved addresses |
| `/admin` | Dashboard |
| `/admin/products` | Product management |
| `/admin/products/new` | Add product |
| `/admin/orders` | Order management |
| `/admin/orders/[id]` | Order detail + status update |
| `/admin/categories` | Category management |
| `/admin/users` | User management |
| `/admin/analytics` | Analytics overview |
| `/admin/settings` | UPI, WhatsApp, SEO, Analytics settings |

---

## Settings Keys (stored in DB)

| Key | Description |
|-----|-------------|
| `upi_id` | UPI payment ID |
| `upi_name` | UPI display name |
| `upi_qr_url` | UPI QR code image URL |
| `whatsapp_number` | WhatsApp contact |
| `whatsapp_message` | Default message |
| `store_name` | Store name |
| `store_email` | Contact email |
| `store_phone` | Contact phone |
| `meta_title` | Default SEO title |
| `meta_description` | Default SEO description |
| `gtm_id` | Google Tag Manager ID |
| `ga_id` | Google Analytics 4 ID |
| `meta_pixel_id` | Meta Pixel ID |
| `mixpanel_token` | Mixpanel token |

---

## Security Implementation

- RLS on all Supabase tables
- Middleware protects `/admin` and `/account` routes
- Admin role check: `profiles.role = 'admin'`
- Input validation: Zod schemas on all forms
- Security headers: via `vercel.json`
- XSS protection: React's built-in + CSP headers
- CSRF: Supabase handles via JWT tokens
- API authorization: every `/api/admin/*` route calls the central `requireAdmin()` helper (401/403), sensitive routes rate-limited via `checkRateLimit()`, admin access audit-logged via `AuditService` (see `SECURITY.md`)
- `/api/admin/analytics` secured 2026-07-19 (was anonymous): requireAdmin + 30/min/IP rate limit + view/denied audit events

---

## Performance Targets

- Lighthouse score: 95+
- LCP: < 2.5s
- FID: < 100ms
- CLS: < 0.1
- Image optimization: Next.js `<Image>` + WebP/AVIF
- Server Components for all data-fetching pages
- Lazy loading on product images

---

## Color System (Dark Theme Primary)

- Primary: Orange (#f97316)
- Background: Near-black (#0f0f23)
- Card: Dark blue-gray
- Accent: Semi-transparent backgrounds
- Success: Green (#22c55e)
- Error: Red (#ef4444)
- WhatsApp: #25D366

---

*Last updated: 2026-06-22*
