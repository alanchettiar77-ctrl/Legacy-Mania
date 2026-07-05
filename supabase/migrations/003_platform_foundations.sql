-- supabase/migrations/003_platform_foundations.sql

-- ============================================================
-- BANNERS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.banners (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  description TEXT,
  image_url TEXT NOT NULL,
  category_id UUID NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  display_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_banners_display_order ON public.banners(display_order) WHERE deleted_at IS NULL;
CREATE INDEX idx_banners_is_active ON public.banners(is_active) WHERE deleted_at IS NULL;
CREATE INDEX idx_banners_category_id ON public.banners(category_id);
CREATE UNIQUE INDEX idx_banners_display_order_unique ON public.banners(display_order) WHERE deleted_at IS NULL;

ALTER TABLE public.banners ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active banners" ON public.banners
  FOR SELECT USING (is_active = TRUE AND deleted_at IS NULL);

CREATE TRIGGER update_banners_updated_at BEFORE UPDATE ON public.banners
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- CONTACT MESSAGES
-- ============================================================
CREATE TABLE IF NOT EXISTS public.contact_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new','read','replied')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_contact_messages_status ON public.contact_messages(status);

ALTER TABLE public.contact_messages ENABLE ROW LEVEL SECURITY;
-- Deliberately no public SELECT policy: rows are written only via the service-role-backed
-- POST /api/contact route (Phase 5); admin reads use the service-role key directly.

-- ============================================================
-- PRODUCTS: collectible metadata + inventory reservation
-- ============================================================
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS rarity TEXT,
  ADD COLUMN IF NOT EXISTS condition TEXT,
  ADD COLUMN IF NOT EXISTS reserved_quantity INTEGER NOT NULL DEFAULT 0;

-- ============================================================
-- STORAGE: banners bucket
-- ============================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('banners', 'banners', true)
ON CONFLICT (id) DO NOTHING;
