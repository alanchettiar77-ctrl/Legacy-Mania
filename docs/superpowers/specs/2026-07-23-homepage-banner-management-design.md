# Homepage Banner Management — Design Spec

**Date:** 2026-07-23
**Phase:** 1 of 10 in the "Master CMS" initiative (see prompt archived below). Each phase is its own independent spec → plan → build cycle; this covers Phase 1 only.

## Context

`AUTH_AUDIT.md`'s 6 findings are all closed (see `project_legacymania_setup.md` memory). This is unrelated new work: turning the homepage into a CMS-driven surface, starting with promotional banners.

**Audit of existing state:**
- A `banners` table already exists (migration `003_platform_foundations.sql`) but is **dead schema**: only `image_url` + a required `category_id` FK, no title/subtitle/CTA/scheduling/SEO fields, and nothing in `src/` reads or writes it.
- The current homepage hero (`src/components/home/hero-section.tsx`) is a fully hardcoded static component (brand copy, floating emoji cards, framer-motion) — not a banner/carousel.
- `src/lib/services/media-service.ts` already has a working upload/validate/replace/delete pattern with per-namespace recommended dimensions, reusing a public `banners` storage bucket. A stale `banners` namespace entry (728×90, leaderboard-ad-sized) exists but was never actually used for banners.
- `homepage_notifications` (migration `007`) is the closest existing analog for a scheduled, orderable, admin-managed CMS collection: soft delete, `start_date`/`end_date` window with a CHECK constraint, `display_order`, `is_admin()` RLS for admin reads, service-role-only writes, `updated_at` trigger. The admin table UI (`notifications-table.tsx`) already implements native HTML5 drag-and-drop reordering — no drag/drop library exists in the project and none is needed.

## Decisions (from user)

1. **Scope:** Add a new CMS-driven banner carousel; do **not** replace the branded static hero. The hero stays as brand identity.
2. **Placement:** Directly below `<HeroSection />`, before `<FeaturedCollections />`.
3. **CTA link:** Support both — an optional `category_id` FK (dropdown, validated) *and* a freeform `cta_url` text field. Whichever is set wins for the click target (service-layer decides precedence: explicit `cta_url` overrides `category_id` if both are somehow set, since the admin form should only allow one at a time).
4. **SEO metadata field split:**
   - **Active today:** `alt_text` (required), `aria_label`, `image_title`.
   - **Stored only, not rendered yet** (future-ready for when banners may become standalone landing/campaign pages): `seo_meta_title`, `seo_meta_description`, `seo_keywords`, `og_title`, `og_description`, `og_image_url`, `canonical_url`, `schema_type`. Fully present in DB schema, API, validation, and admin panel (in a clearly-labeled "SEO (advanced) — not yet shown on site" section), but no frontend code reads them in this phase. Enabling them later must require only new frontend rendering — no DB/API/admin changes.
5. **Image dimensions:** Desktop 1600×600, mobile 750×1000 (mismatch triggers a warning, not a hard block, matching existing `MediaService` behavior for other namespaces).

## Database

Migration `010_banner_management.sql`. The old `banners` table has zero live rows and no code references — safe to `DROP` and recreate cleanly rather than chain `ALTER`s (documented inline in the migration as an intentional replacement, not a destructive accident).

```sql
DROP TABLE IF EXISTS public.banners CASCADE;

CREATE TABLE public.banners (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  subtitle TEXT,
  cta_text TEXT,
  cta_url TEXT,
  category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  desktop_image_url TEXT NOT NULL,
  mobile_image_url TEXT,
  alt_text TEXT NOT NULL,
  aria_label TEXT,
  image_title TEXT,
  overlay_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  overlay_opacity NUMERIC(3,2) NOT NULL DEFAULT 0.40 CHECK (overlay_opacity BETWEEN 0 AND 1),
  banner_type TEXT NOT NULL DEFAULT 'image' CHECK (banner_type IN ('image','video','promotional','seasonal')),
  video_url TEXT,
  display_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  start_date TIMESTAMPTZ,
  end_date TIMESTAMPTZ,
  seo_meta_title TEXT,
  seo_meta_description TEXT,
  seo_keywords TEXT,
  og_title TEXT,
  og_description TEXT,
  og_image_url TEXT,
  canonical_url TEXT,
  schema_type TEXT,
  created_by UUID REFERENCES public.profiles(id),
  updated_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  CONSTRAINT banners_schedule_valid CHECK (start_date IS NULL OR end_date IS NULL OR end_date > start_date)
);

CREATE INDEX idx_banners_active_order ON public.banners (is_active, display_order) WHERE deleted_at IS NULL;
CREATE INDEX idx_banners_category_id ON public.banners (category_id);

ALTER TABLE public.banners ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view live banners" ON public.banners
  FOR SELECT USING (
    is_active = TRUE AND deleted_at IS NULL
    AND (start_date IS NULL OR start_date <= NOW())
    AND (end_date IS NULL OR end_date >= NOW())
  );

CREATE POLICY "Admins can view all banners" ON public.banners
  FOR SELECT USING (public.is_admin());
-- No INSERT/UPDATE/DELETE policy: writes are service-role-only, same as homepage_notifications.

CREATE TRIGGER update_banners_updated_at BEFORE UPDATE ON public.banners
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
```

`MediaService`: replace the stale `banners: 728×90` namespace with `"banner-desktop": { bucket: "banners", recommendedWidth: 1600, recommendedHeight: 600, public: true }` and `"banner-mobile": { bucket: "banners", recommendedWidth: 750, recommendedHeight: 1000, public: true }`.

## API (all under `/api/admin/banners`, `requireAdmin` + rate-limited + audit-logged — matching every existing admin route group)

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/admin/banners` | List all non-deleted banners (admin table) |
| POST | `/api/admin/banners` | Create |
| GET | `/api/admin/banners/[id]` | Get one |
| PATCH | `/api/admin/banners/[id]` | Update (edit, hide/activate/deactivate all go through this) |
| DELETE | `/api/admin/banners/[id]` | Soft delete |
| POST | `/api/admin/banners/[id]/duplicate` | Duplicate — copies row, appends "(Copy)" to title, `is_active: false`, new max `display_order` |
| POST | `/api/admin/banners/reorder` | Body `{ ids: string[] }`, rewrites `display_order` 0..n-1, same as notifications |
| POST | `/api/admin/banners/[id]/image` | Upload/replace desktop or mobile image via `MediaService`, body includes which slot |

Public (no new route needed): banner list fetched server-side in `(shop)/page.tsx` via a repository function, same as `listActiveNotifications`.

## Service / Repository layers

- `src/lib/repositories/banner-repository.ts` — raw PostgREST fetch, mirrors `notification-repository.ts` exactly (list/listActive/get/insert/update/softDelete/duplicate/reorder).
- `src/lib/services/banner-service.ts` — zod validation (`src/lib/validation/banner.ts`), business rules: schedule window validity, `cta_url`/`category_id` precedence, display-order assignment on create.

## Frontend

- `src/components/home/banner-carousel.tsx` (client component): framer-motion autoplay carousel + manual dot nav, reusing motion patterns from `hero-section.tsx`. Renders `null` when zero active banners (matches the announcement-bar "never show empty" rule). `next/image` for lazy load + automatic WebP/AVIF. Desktop/mobile image swapped via `hidden md:block` / `md:hidden` responsive pairs — no new `<picture>` plumbing.
- Placed in `(shop)/page.tsx` directly below `<HeroSection />`.

## Admin UI

`Admin → Marketing → Homepage Banners` (`src/app/admin/marketing/banners/`), structurally identical to `notifications-table.tsx`: table with native HTML5 drag-and-drop reorder, CRUD dialog with desktop/mobile image upload widgets (reusing the branding-dashboard upload pattern), schedule date pickers, overlay opacity slider, and a collapsible "SEO (advanced) — not yet shown on site" section for the future-ready fields.

## Testing

- `banner-repository.test.ts` — mocked fetch, same style as existing repository tests.
- `banner-service.test.ts` — validation, schedule-window logic, cta precedence, duplicate/reorder behavior.
- `route.test.ts` per API route — auth/rate-limit/validation/happy-path, matching `checkout/route.test.ts` conventions.
- `banner-carousel.test.tsx` — renders nothing when empty; renders N slides when active; respects schedule window (via the repository's already-scheduled query, not duplicated client-side).

## Docs

Update `API.md`, `DATABASE.md`, `TASKS.md`, `ROADMAP.md`. No dedicated `CMS.md` yet — that arrives in Phase 4 when the wider Website Builder CMS is built.

## Out of scope (this phase)

Video banners (schema-ready via `banner_type`/`video_url` columns, no upload/render support), the wider Website Builder CMS (Phase 4), any other phase from the master prompt. Migration `010` still needs the same manual-apply-via-SQL-Editor + curl-verify process as prior migrations (documented gotcha — no Supabase CLI in this environment).
