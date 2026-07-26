-- supabase/migrations/011_product_display_order.sql
-- Adds manual catalog ordering to products, fixing the bug where every
-- storefront surface defaulted to created_at DESC (newest-upload-first)
-- because no ordering column ever existed. Extends the exact pattern
-- categories.display_order already uses (001_initial_schema.sql).
--
-- Backfill preserves current insertion order per category — no alphabetical
-- reordering, no name-based guessing — so deploying this does not reshuffle
-- the live catalog. Admins fine-tune exact numbers afterward via the admin panel.

ALTER TABLE public.products
  ADD COLUMN display_order INTEGER NOT NULL DEFAULT 0 CHECK (display_order >= 0);

WITH ordered AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY category_id ORDER BY created_at ASC) AS rn
  FROM public.products
)
UPDATE public.products
SET display_order = ordered.rn
FROM ordered
WHERE public.products.id = ordered.id;

CREATE INDEX idx_products_category_display_order ON public.products (category_id, display_order);
CREATE INDEX idx_products_display_order ON public.products (display_order);
