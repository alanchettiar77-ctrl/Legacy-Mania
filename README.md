# Legacy Mania 🃏

**"Collect The Stories That Shaped Generations."**

India's premier collectible marketplace for anime cards, trading cards, Pokémon, Dragon Ball Z, Naruto, One Piece and nostalgic memorabilia.

---

## 📋 AI DEVELOPER — READ THIS FIRST

Every coding session **must** start by reading these files:

1. `README.md` — This file. Project overview and setup.
2. `PROJECT_CONTEXT.md` — Architecture, decisions, and feature map.
3. `CHANGELOG.md` — What has been built.
4. `TASKS.md` — What still needs to be done.
5. `update.md` — Latest deployment log.

---

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- npm or yarn
- Supabase account (free tier)
- Vercel account (free tier)

### Local Development

```bash
# Clone the repo
git clone https://github.com/your-username/legacy-mania.git
cd legacy-mania

# Install dependencies
npm install

# Set up environment variables
cp .env.local.example .env.local
# Fill in your Supabase credentials

# Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## 🔑 Environment Variables

```env
# Required
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_WHATSAPP_NUMBER=919876543210

# Optional analytics
NEXT_PUBLIC_GTM_ID=GTM-XXXXXXX
NEXT_PUBLIC_GA_ID=G-XXXXXXXXXX
```

---

## 🗄️ Database Setup

1. Create a Supabase project at [supabase.com](https://supabase.com)
2. Go to SQL Editor
3. Run `supabase/migrations/001_initial_schema.sql`
4. Create storage buckets:
   - `products` (public) — product images
   - `payments` (private) — payment screenshots
   - `settings` (public) — UPI QR code

---

## 📁 Project Structure

```
src/
├── app/
│   ├── (shop)/          # Public store pages
│   │   ├── page.tsx     # Home
│   │   ├── catalog/     # Product catalog
│   │   ├── products/    # Product detail
│   │   ├── about/       # About page
│   │   ├── checkout/    # Checkout + UPI payment
│   │   └── search/      # Search
│   ├── (auth)/          # Login / Register
│   ├── (account)/       # User account pages
│   ├── admin/           # Admin dashboard
│   └── api/             # API routes
├── components/
│   ├── layout/          # Navbar, Footer, WhatsApp
│   ├── home/            # Home sections
│   ├── product/         # Product card
│   ├── cart/            # Cart drawer
│   ├── admin/           # Admin components
│   ├── account/         # Account components
│   └── providers/       # Context providers
├── lib/
│   ├── supabase/        # Client, server, middleware
│   └── utils.ts         # Utility functions
├── store/
│   ├── cart.ts          # Zustand cart store
│   └── wishlist.ts      # Zustand wishlist store
└── types/               # TypeScript types
```

---

## 🌐 Deployment

### Vercel (Free Tier)

```bash
# Install Vercel CLI
npm install -g vercel

# Deploy
vercel --prod
```

Set environment variables in Vercel dashboard.

### GitHub Repository

```bash
git init
git add .
git commit -m "feat: initial Legacy Mania platform"
git remote add origin https://github.com/your-username/legacy-mania.git
git push -u origin main
```

---

## ⚡ Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 15, TypeScript, TailwindCSS |
| UI Components | Shadcn UI, Radix UI, Framer Motion |
| Backend | Supabase (PostgreSQL + Auth + Storage) |
| State | Zustand |
| Forms | React Hook Form + Zod |
| Hosting | Vercel Free Tier |
| CDN | Vercel Edge Network |

---

## 🛒 Key Features

- **Hierarchical Catalog** — Pokémon, DBZ, Naruto, One Piece, Digimon, Yu-Gi-Oh
- **Minimum Order** — 5 cards minimum with cart enforcement
- **UPI Payment** — Admin uploads QR, customer pays manually
- **Payment Screenshot** — Customer uploads proof, admin verifies
- **WhatsApp Integration** — Floating button, order confirmation, product inquiry
- **Guest Checkout** — No account required
- **Admin Dashboard** — Full CMS for products, orders, categories
- **SEO Optimized** — Dynamic sitemap, robots.txt, meta tags
- **Analytics** — GTM, GA4, Meta Pixel, Mixpanel

---

## 🔐 Admin Access

1. Register with your email
2. In Supabase SQL Editor, run:
   ```sql
   UPDATE profiles SET role = 'admin' WHERE email = 'your@email.com';
   ```
3. Visit `/admin`

---

## 📞 Support

WhatsApp: [Chat with us](https://wa.me/919876543210)

---

*Last updated: 2026-06-22*
