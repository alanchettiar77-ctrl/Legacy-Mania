-- supabase/migrations/013_hero_tiles.sql
-- Homepage hero "floating tile" CMS (admin-managed, replaces the hardcoded
-- Pikachu/Goku/Naruto/Luffy tiles in src/components/home/hero-section.tsx).
-- Apply manually via Supabase SQL Editor, then verify via a PostgREST curl GET on
-- /rest/v1/hero_tiles?select=id&limit=1 (see DATABASE.md).
--
-- Uses the generic link_type/link_value model (not a bare category_id FK) so future
-- tiles can point at products, collections, search results, or arbitrary pages without
-- another migration. See the "Generic internal linking" note in ROADMAP.md.

CREATE TABLE public.hero_tiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  label TEXT NOT NULL,
  icon_emoji TEXT NOT NULL,
  color_theme TEXT NOT NULL DEFAULT 'sunrise'
    CHECK (color_theme IN ('sunrise','ember','citrus','blossom','ocean','violet')),
  link_type TEXT NOT NULL DEFAULT 'category'
    CHECK (link_type IN ('category','product','collection','search','page','custom_url')),
  link_value TEXT NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by UUID REFERENCES public.profiles(id),
  updated_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_hero_tiles_active_order ON public.hero_tiles (is_active, display_order)
  WHERE deleted_at IS NULL;

ALTER TABLE public.hero_tiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view live hero tiles" ON public.hero_tiles
  FOR SELECT USING (is_active = TRUE AND deleted_at IS NULL);

CREATE POLICY "Admins can view all hero tiles" ON public.hero_tiles
  FOR SELECT USING (public.is_admin());
-- No INSERT/UPDATE/DELETE policy: writes are service-role-only, same as banners.

CREATE TRIGGER update_hero_tiles_updated_at BEFORE UPDATE ON public.hero_tiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
