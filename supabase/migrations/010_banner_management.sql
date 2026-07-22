-- supabase/migrations/010_banner_management.sql
-- Homepage banner carousel (admin-managed, below the static hero).
-- Apply manually via Supabase SQL Editor, then verify via PostgREST curl (see DATABASE.md).
--
-- The old `banners` table (from 003_platform_foundations.sql) is dead schema: zero live rows,
-- no code in src/ references it, required category_id FK that doesn't fit this feature's needs.
-- Safe to drop and recreate cleanly rather than chain ALTERs.

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
