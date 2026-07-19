-- supabase/migrations/008_branding.sql
-- Dynamic branding: brand asset slots in settings + category icon/appearance/visibility columns.
-- Apply manually via Supabase SQL Editor, then verify via PostgREST curl (see DATABASE.md).

-- ============================================================
-- CATEGORY BRANDING COLUMNS
-- ============================================================
ALTER TABLE public.categories
  ADD COLUMN IF NOT EXISTS icon_url TEXT,
  ADD COLUMN IF NOT EXISTS appearance JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS is_featured BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS show_on_homepage BOOLEAN NOT NULL DEFAULT TRUE;

-- ============================================================
-- BRAND ASSET SLOTS (single JSON config in the existing settings table)
-- Empty string = slot unset (falls back to built-in text logo / default icons).
-- ============================================================
INSERT INTO public.settings (key, value, description) VALUES (
  'branding',
  '{
    "logo_url": "",
    "logo_hidden": false,
    "hero_logo_url": "",
    "badge_logo_url": "",
    "favicon_url": "",
    "apple_touch_icon_url": "",
    "og_image_url": "",
    "twitter_card_url": "",
    "pwa_icon_url": ""
  }'::jsonb,
  'Site-wide brand asset slots (logo, favicon, social images)'
) ON CONFLICT (key) DO NOTHING;
