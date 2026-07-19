-- supabase/migrations/007_homepage_notifications.sql
-- Dynamic homepage notification engine (admin-managed marquee/announcement bar).
-- Apply manually via Supabase SQL Editor, then verify via PostgREST curl (see DATABASE.md).

-- ============================================================
-- HOMEPAGE NOTIFICATIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.homepage_notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  short_message TEXT,
  type TEXT NOT NULL DEFAULT 'announcement' CHECK (type IN (
    'sale','limited_stock','new_arrival','trending','recently_sold','new_collection',
    'offer','flash_sale','announcement','shipping_update','event','countdown','custom'
  )),
  cta_text TEXT,
  cta_url TEXT,
  priority INTEGER NOT NULL DEFAULT 0,
  display_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  theme TEXT NOT NULL DEFAULT 'primary',
  icon TEXT,
  animation TEXT NOT NULL DEFAULT 'marquee',
  background_color TEXT,
  text_color TEXT,
  start_date TIMESTAMPTZ,
  end_date TIMESTAMPTZ,
  device TEXT NOT NULL DEFAULT 'both' CHECK (device IN ('desktop','mobile','both')),
  -- Future-ready targeting (segmentation / geo). NULL = everyone. Not enforced yet.
  target_audience JSONB,
  country TEXT,
  created_by UUID REFERENCES public.profiles(id),
  updated_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  CONSTRAINT homepage_notifications_schedule_valid
    CHECK (start_date IS NULL OR end_date IS NULL OR end_date > start_date)
);

CREATE INDEX idx_homepage_notifications_active_order
  ON public.homepage_notifications (is_active, priority DESC, display_order)
  WHERE deleted_at IS NULL;

ALTER TABLE public.homepage_notifications ENABLE ROW LEVEL SECURITY;

-- Public storefront read: active, not soft-deleted, within schedule window.
CREATE POLICY "Anyone can view live homepage notifications" ON public.homepage_notifications
  FOR SELECT USING (
    is_active = TRUE
    AND deleted_at IS NULL
    AND (start_date IS NULL OR start_date <= NOW())
    AND (end_date IS NULL OR end_date >= NOW())
  );

-- Admin full read (inactive/scheduled/deleted rows visible in the admin panel via anon-key
-- clients too, though the app itself uses the service-role key). Writes stay service-role-only:
-- no INSERT/UPDATE/DELETE policy is created, so the anon key cannot mutate this table.
CREATE POLICY "Admins can view all homepage notifications" ON public.homepage_notifications
  FOR SELECT USING (public.is_admin());

CREATE TRIGGER update_homepage_notifications_updated_at
  BEFORE UPDATE ON public.homepage_notifications
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- DISPLAY SETTINGS (single JSON config in the existing settings table)
-- ============================================================
INSERT INTO public.settings (key, value, description) VALUES (
  'homepage_notifications_display',
  '{
    "marqueeSpeedSeconds": 30,
    "direction": "left",
    "pauseOnHover": true,
    "loop": true,
    "backgroundColor": "",
    "textColor": "",
    "fontSize": "sm",
    "fontWeight": "medium",
    "paddingY": "2.5",
    "borderRadius": "none",
    "showOnMobile": true,
    "showOnDesktop": true
  }'::jsonb,
  'Homepage notification bar display configuration'
) ON CONFLICT (key) DO NOTHING;

-- ============================================================
-- SEED (migrate previously hardcoded announcement bar content)
-- ============================================================
INSERT INTO public.homepage_notifications (title, message, type, display_order) VALUES
  ('Pokémon restock', '🎉 New Pokémon Scarlet & Violet sets now in stock!', 'new_arrival', 0),
  ('Free shipping', '🚚 Free shipping on orders above ₹999', 'shipping_update', 1),
  ('Authenticity', '⚡ 100% Authentic cards — every single one', 'announcement', 2),
  ('DBZ Fusion World', '🐉 Dragon Ball Z Fusion World cards available', 'new_collection', 3),
  ('Naruto restock', '🍃 Naruto Kayou cards back in stock', 'new_arrival', 4),
  ('One Piece', '🏴‍☠️ One Piece Card Game — latest sets in', 'new_collection', 5),
  ('Quality promise', '✨ Premium quality. Delivered across India.', 'announcement', 6);
