# DATABASE.md — Legacy Mania Schema Reference

Reflects the actual live schema as of `supabase/migrations/003_platform_foundations.sql`.

## Tables

- **profiles** — id (PK, FK→auth.users), email, full_name, phone, avatar_url, role (`customer`|`admin`), created_at, updated_at
- **addresses** — id (PK), user_id (FK→profiles), label, name, phone, street, city, state, pincode, is_default, timestamps
- **categories** — id (PK), name, slug (unique), description, image_url, parent_id (self-referential FK, `ON DELETE SET NULL`), display_order, is_active, meta_title, meta_description, timestamps, **icon_url, appearance (jsonb: colors/gradient/radius/shadow/badge/animation), is_featured, show_on_homepage** *(added in `008` — admin-managed branding; `is_active=false` hides everywhere without touching products)*, **deleted_at TIMESTAMPTZ** *(added in `012` — soft delete, matching the `banners`/`homepage_notifications` convention: `deleted_at IS NULL` = visible everywhere; delete is blocked with a `409` if the category still has children or active products unless the request reassigns them first)*. Self-referential `parent_id` supports arbitrary-depth hierarchy (e.g. Pokémon → Indigo League) — this is the platform's "catalog," there is no separate Catalog table.
- **products** — id (PK), name, slug (unique), description, price, compare_price, images (text[]), category_id (FK→categories, `SET NULL`), series, saga, collection, **rarity, condition** (added in `003`), stock_quantity, **reserved_quantity** (added in `003`, default 0 — available-to-sell stock is always `stock_quantity - reserved_quantity`), **display_order** (added in `011`, default 0 — backfilled with insertion order, one counter per category), sku (unique), is_active, is_featured, is_new, tags (text[]), meta_title, meta_description, timestamps. Default catalog sort is `display_order ASC, created_at ASC` (tie-break) — see `API.md` for the full sort option list.
- **wishlists** — id (PK), user_id (FK→profiles), product_id (FK→products), created_at, unique(user_id, product_id)
- **orders** — id (PK), order_number (unique), user_id (FK→profiles, `SET NULL`), guest_email, status (`pending`|`payment_verification`|`confirmed`|`processing`|`shipped`|`delivered`|`cancelled`|`refunded`), subtotal, shipping_cost, total, shipping_* fields, notes, timestamps
- **order_items** — id (PK), order_id (FK→orders, cascade), product_id (FK→products, `SET NULL`), product_name, product_image, quantity, unit_price, total_price
- **payments** — id (PK), order_id (FK→orders, cascade, **unique** — 1:1), amount, payment_method, status (`pending`|`verified`|`rejected`), screenshot_url, upi_ref, verified_by (FK→profiles), verified_at, timestamps
- **settings** — id (PK), key (unique), value (jsonb), description, updated_by (FK→profiles), updated_at — generic key-value store
- **audit_logs** — id (PK), user_id (FK→profiles), action, table_name, record_id, old_values/new_values (jsonb), ip_address, created_at. **Now has a real writer as of Phase 0** — `AuditService.recordAuditLog()`.
- **analytics_events** — id (PK), event_type, user_id, session_id, product_id, category_id, order_id, metadata (jsonb), created_at. Still has no writer as of Phase 0 — scheduled for Phase 6.
- **newsletter_subscribers** — id (PK), email (unique), subscribed_at
- **faqs** — id (PK), question, answer, display_order, is_active, timestamps
- **banners** *(replaced in `010`, live as of 2026-07-26 — old `003` schema dropped, zero rows lost)* — id (PK), title, subtitle, cta_text, cta_url, category_id (FK→categories, set null), desktop_image_url, mobile_image_url, alt_text, aria_label, image_title, overlay_enabled, overlay_opacity, banner_type, video_url (schema-ready, unused), display_order, is_active, start_date/end_date (schedule window), seo_meta_title/seo_meta_description/seo_keywords/og_title/og_description/og_image_url/canonical_url/schema_type (stored, admin-editable, not yet rendered on the storefront), created_by/updated_by, timestamps, deleted_at (soft delete). Public RLS: active + in-schedule + not deleted only; admin RLS: full read via `is_admin()`; no anon/authenticated write policies (service-role only).
- **contact_messages** *(new in `003`)* — id (PK), name, email, message, status (`new`|`read`|`replied`), created_at. No public SELECT policy — insert-only via the service-role-backed `/api/contact` route (Phase 5).
- **homepage_notifications** *(new in `007`)* — id (PK), title (internal label), message, short_message, type (13-value CHECK: sale, limited_stock, new_arrival, trending, recently_sold, new_collection, offer, flash_sale, announcement, shipping_update, event, countdown, custom), cta_text, cta_url, priority, display_order, is_active, theme, icon, animation, background_color, text_color, start_date/end_date (schedule window, CHECK end > start), device (`desktop`|`mobile`|`both`), target_audience (jsonb, future-ready), country (future-ready), created_by/updated_by (FK→profiles), timestamps, deleted_at (soft delete). Public RLS: active + not deleted + inside schedule window; admin-read via `is_admin()`; **no anon write policies** — all writes via service-role API routes. Display config lives in `settings.homepage_notifications_display` (jsonb).
- **hero_tiles** *(new in `013`)* — id (PK), label, icon_emoji, color_theme (CHECK: `sunrise`|`ember`|`citrus`|`blossom`|`ocean`|`violet`, default `sunrise`), link_type (CHECK: `category`|`product`|`collection`|`search`|`page`|`custom_url`, default `category`), link_value, display_order, is_active, created_by/updated_by (FK→profiles), timestamps, deleted_at (soft delete). The first table to use the generic `link_type`/`link_value` linking model instead of a bare `category_id` FK — see the "Generic internal linking" note in `ROADMAP.md`. Index on `(is_active, display_order) WHERE deleted_at IS NULL`. Public RLS: active + not deleted only (`is_active = TRUE AND deleted_at IS NULL`); admin-read via `is_admin()`; no anon/authenticated write policies (service-role only, same as `banners`). Powers the homepage's floating hero tiles (`src/components/home/hero-section.tsx`), replacing the previously-hardcoded Pikachu/Goku/Naruto/Luffy tiles; `getHomepageHeroTiles()` falls back to the 4 built-in defaults if the table/migration isn't reachable.

## Storage buckets

- `products` (public)
- `payments` (private)
- `settings` (public)
- `banners` (public) *(new in `003`)*

## Known inconsistency (not yet fixed — scheduled for Phase 1)

`payments.screenshot_url` currently stores a public URL despite the bucket being private; the checkout code calls `getPublicUrl()` on a private bucket. Target fix: store the storage path instead, generate signed URLs server-side via `PaymentService`.
