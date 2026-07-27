-- Adds soft-delete support to categories, matching the existing banners/homepage_notifications
-- convention: deleted_at IS NULL means visible everywhere. Apply manually via the Supabase SQL
-- Editor, then verify via a PostgREST curl GET on /rest/v1/categories?select=deleted_at&limit=1.

ALTER TABLE public.categories
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
