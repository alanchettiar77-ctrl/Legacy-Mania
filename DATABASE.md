# DATABASE.md — Legacy Mania Schema Reference

Reflects the actual live schema as of `supabase/migrations/003_platform_foundations.sql`.

## Tables

- **profiles** — id (PK, FK→auth.users), email, full_name, phone, avatar_url, role (`customer`|`admin`), created_at, updated_at
- **addresses** — id (PK), user_id (FK→profiles), label, name, phone, street, city, state, pincode, is_default, timestamps
- **categories** — id (PK), name, slug (unique), description, image_url, parent_id (self-referential FK, `ON DELETE SET NULL`), display_order, is_active, meta_title, meta_description, timestamps. Self-referential `parent_id` supports arbitrary-depth hierarchy (e.g. Pokémon → Indigo League) — this is the platform's "catalog," there is no separate Catalog table.
- **products** — id (PK), name, slug (unique), description, price, compare_price, images (text[]), category_id (FK→categories, `SET NULL`), series, saga, collection, **rarity, condition** (added in `003`), stock_quantity, **reserved_quantity** (added in `003`, default 0 — available-to-sell stock is always `stock_quantity - reserved_quantity`), sku (unique), is_active, is_featured, is_new, tags (text[]), meta_title, meta_description, timestamps
- **wishlists** — id (PK), user_id (FK→profiles), product_id (FK→products), created_at, unique(user_id, product_id)
- **orders** — id (PK), order_number (unique), user_id (FK→profiles, `SET NULL`), guest_email, status (`pending`|`payment_verification`|`confirmed`|`processing`|`shipped`|`delivered`|`cancelled`|`refunded`), subtotal, shipping_cost, total, shipping_* fields, notes, timestamps
- **order_items** — id (PK), order_id (FK→orders, cascade), product_id (FK→products, `SET NULL`), product_name, product_image, quantity, unit_price, total_price
- **payments** — id (PK), order_id (FK→orders, cascade, **unique** — 1:1), amount, payment_method, status (`pending`|`verified`|`rejected`), screenshot_url, upi_ref, verified_by (FK→profiles), verified_at, timestamps
- **settings** — id (PK), key (unique), value (jsonb), description, updated_by (FK→profiles), updated_at — generic key-value store
- **audit_logs** — id (PK), user_id (FK→profiles), action, table_name, record_id, old_values/new_values (jsonb), ip_address, created_at. **Now has a real writer as of Phase 0** — `AuditService.recordAuditLog()`.
- **analytics_events** — id (PK), event_type, user_id, session_id, product_id, category_id, order_id, metadata (jsonb), created_at. Still has no writer as of Phase 0 — scheduled for Phase 6.
- **newsletter_subscribers** — id (PK), email (unique), subscribed_at
- **faqs** — id (PK), question, answer, display_order, is_active, timestamps
- **banners** *(new in `003`)* — id (PK), title, description, image_url, category_id (FK→categories, `ON DELETE CASCADE`), display_order (partial-unique where `deleted_at IS NULL`), is_active, timestamps, deleted_at (soft delete). Public RLS: `is_active = TRUE AND deleted_at IS NULL`.
- **contact_messages** *(new in `003`)* — id (PK), name, email, message, status (`new`|`read`|`replied`), created_at. No public SELECT policy — insert-only via the service-role-backed `/api/contact` route (Phase 5).

## Storage buckets

- `products` (public)
- `payments` (private)
- `settings` (public)
- `banners` (public) *(new in `003`)*

## Known inconsistency (not yet fixed — scheduled for Phase 1)

`payments.screenshot_url` currently stores a public URL despite the bucket being private; the checkout code calls `getPublicUrl()` on a private bucket. Target fix: store the storage path instead, generate signed URLs server-side via `PaymentService`.
