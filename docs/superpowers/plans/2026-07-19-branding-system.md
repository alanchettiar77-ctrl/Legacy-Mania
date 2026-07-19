# Dynamic Branding & Category Management — Implementation Plan

> Execute inline. Same layered pattern as notifications (repo → service → route → UI).

**Goal:** Logo, brand asset slots, category icons/appearance/order/visibility all admin-managed; zero hardcoded branding.

## Decisions

- **Branding storage:** one `settings` key `branding` (jsonb slots) — no new table. Slots: `logo_url`, `logo_hidden`, `hero_logo_url`, `badge_logo_url`, `favicon_url`, `apple_touch_icon_url`, `og_image_url`, `twitter_card_url`, `pwa_icon_url`.
- **Category branding:** extend `categories` (migration 008): `icon_url TEXT`, `appearance JSONB DEFAULT '{}'`, `is_featured BOOL DEFAULT FALSE`, `show_on_homepage BOOL DEFAULT TRUE`. Visibility = existing `is_active` (already hides catalog/nav/search via `listActiveCategories`).
- **Uploads:** reuse existing `/api/media/upload` + MediaService; add namespace `branding` (existing public `banners` bucket, no new bucket). **SVG rejected deliberately** — script-injection/XSS risk; PNG/JPG/WEBP only (existing ALLOWED_TYPES). 2MB cap + sharp validation already enforced.
- **Cache:** public branding/category reads via `fetch` `next: { revalidate: 300, tags: [...] }`; admin PATCH routes call `revalidateTag` → instant storefront update, no per-request DB hit.
- **Logo everywhere:** `BrandLogo` shared component (image when `logo_url` set + not hidden; current Zap+text markup as fallback). `(shop)/layout.tsx` (server) fetches branding, passes to Navbar (client, prop) + Footer. Root `layout.tsx` `generateMetadata` merges favicon/apple/OG/twitter from branding. Admin sidebar uses BrandLogo too.
- **Category cards:** `popular-categories.tsx` filters `is_active && show_on_homepage`, renders `icon_url` (else emoji fallback), applies `appearance` jsonb (bg, gradient, borderColor, textColor, radius, shadow, animation off toggle, badge).

## Files

Create: `supabase/migrations/008_branding.sql`, `src/lib/validation/branding.ts` (+test), `src/lib/repositories/branding-repository.ts`, `src/lib/services/branding-service.ts` (+test), `src/app/api/admin/branding/route.ts` (+test), `src/app/api/admin/categories/order/route.ts`, `src/app/api/admin/categories/[id]/branding/route.ts` (+shared test), `src/components/brand-logo.tsx` (+test), `src/app/admin/marketing/branding/page.tsx`, `branding-dashboard.tsx`.

Modify: `media-service.ts` (+`branding` namespace), `category-repository.ts` (+`listHomepageCategories`, `updateCategoryBranding`, `reorderCategories`), `navbar.tsx`, `footer.tsx`, `admin-sidebar.tsx` (+Branding nav item, BrandLogo), `(shop)/layout.tsx`, `app/layout.tsx` (generateMetadata), `popular-categories.tsx`, `(shop)/page.tsx` (homepage category filter).

## API

- `GET/PATCH /api/admin/branding` — slots read/update (PATCH null = delete/restore-default; `logo_hidden` = hide). Rate 60/min/IP, requireAdmin, zod, audit `branding.update`.
- `PATCH /api/admin/categories/order` — `{ids}` → display_order rewrite. Audit `category.reorder`.
- `PATCH /api/admin/categories/:id/branding` — icon_url/appearance/is_featured/show_on_homepage/is_active. Audit `category.branding_update`.
- Upload flow: client POSTs `/api/media/upload` (namespace `branding`) → PATCHes slot with returned publicUrl. No new upload logic.

## Testing

Zod accept/reject; service merge/cache-tag logic (mock repo); route auth/429/400/audit; BrandLogo render fallback/image/hidden. Playwright/visual/cross-browser: no harness — recorded gap in TESTING.md.

## Future-proofing

`branding` settings key is an open slot map — banners/themes/trust badges/partner logos = new keys + UI section, no schema change. Category `appearance` jsonb likewise open.
