# API.md — Legacy Mania Endpoint Reference

Reflects the actual routes present in `src/app/api/` as of Phase 0. Routes planned for later
phases are tracked in `ROADMAP.md`, not documented here until they exist.

## Public (no auth)

| Method | Path | Description |
|---|---|---|
| GET | `/api/faqs` | Active FAQs, ordered by `display_order` |
| GET | `/api/products` | Product listing. Query params: `sort` (`display_order` \| `featured` \| `newest` \| `oldest` \| `price_asc` \| `price_desc` \| `name_asc` \| `name_desc`, default `display_order`); `category_id` (filter by category); `search` (search text); page/limit (pagination). Default sort is `display_order ASC, created_at ASC` within each category. |
| GET | `/api/categories` | Flat list of active categories |
| GET | `/api/categories/tree` | Nested category tree (parent → children) |
| POST | `/api/newsletter` | Newsletter signup |
| POST | `/api/media/upload` | **Admin-only**, see below — listed here because the route lives under `/api/media`, not `/api/admin` |

## Customer (authenticated)

| Method | Path | Description |
|---|---|---|
| GET | `/api/auth/role` | Get the signed-in user's role for client-side auth gating |
| PATCH | `/api/account/profile` | Update the signed-in user's profile |

## Admin (`requireAdmin()` required)

Every route below is regression-tested for 401 (anonymous) / 403 (authenticated, non-admin) via
a dedicated `route.test.ts`; page-level access to `/admin/*` is separately covered by
`src/lib/supabase/middleware.test.ts`. See CHANGELOG 0.11.1.

| Method | Path | Description |
|---|---|---|
| GET/POST/DELETE | `/api/admin/admins` | Manage admin accounts |
| GET | `/api/admin/analytics` | Aggregate metrics (orders/products/users counts, revenue, orders-by-status). Rate-limited (30/min per IP). All access (granted + denied) audit-logged. `401` anon / `403` non-admin / `429` over limit. |
| POST | `/api/admin/faqs` | Create a FAQ |
| GET/POST | `/api/admin/notifications` | List all / create homepage notifications. Rate-limited (60/min per IP). Mutations audit-logged. |
| PATCH/DELETE | `/api/admin/notifications/:id` | Update / soft-delete a notification |
| POST | `/api/admin/notifications/:id/duplicate` | Copy a notification as a hidden draft |
| POST | `/api/admin/notifications/reorder` | Body `{ ids: uuid[] }` — rewrites `display_order` to match |
| POST | `/api/admin/notifications/bulk` | Body `{ ids, action: activate\|deactivate\|delete }` |
| GET/PATCH | `/api/admin/notifications/display-settings` | Marquee display config (speed, direction, colors, visibility) |
| GET/POST | `/api/admin/banners` | List all / create homepage banners. Rate-limited (60/min per IP). Mutations audit-logged. |
| PATCH/DELETE | `/api/admin/banners/:id` | Update / soft-delete a banner |
| POST | `/api/admin/banners/:id/duplicate` | Copy a banner as a hidden draft |
| POST | `/api/admin/banners/reorder` | Body `{ ids: uuid[] }` — rewrites `display_order` to match |
| GET/POST | `/api/admin/hero-tiles` | List all / create homepage hero tiles. Rate-limited (60/min per IP). Mutations audit-logged. Body: `label`/`icon_emoji`/`color_theme` (`sunrise`\|`ember`\|`citrus`\|`blossom`\|`ocean`\|`violet`, default `sunrise`)/`link_type` (`category`\|`product`\|`collection`\|`search`\|`page`\|`custom_url`, default `category`)/`link_value` (slug, relative path, or http(s) URL)/`display_order`/`is_active`. |
| PATCH/DELETE | `/api/admin/hero-tiles/:id` | Update (partial body, same fields as create) / soft-delete a hero tile. `404` if not found. |
| POST | `/api/admin/hero-tiles/reorder` | Body `{ ids: uuid[] }` — rewrites `display_order` to match |
| GET/PATCH | `/api/admin/branding` | Brand asset slots (logo, favicon, OG/Twitter/PWA images) + `logo_hidden`. PATCH with `""` clears a slot back to default. Audit-logged with old+new values. |
| POST | `/api/admin/categories` | Create a category. Body: `name`/`slug`/`description`/`parent_id`/`display_order`/`is_active`/`meta_title`/`meta_description`. Rate-limited (60/min per IP). Audit-logged. |
| PATCH | `/api/admin/categories/:id` | Update category content fields (`name`/`slug`/`description`/`parent_id`/`display_order`/`is_active`/`meta_title`/`meta_description`). Rate-limited (60/min per IP). Audit-logged. `409` on slug conflict or a `parent_id` that would create a cycle (moving a category under itself or one of its own descendants). |
| DELETE | `/api/admin/categories/:id` | Soft-deletes a category (`deleted_at`). Body `{ reassignChildrenTo?, reassignProductsTo? }` — optionally reassign children/products to another category in the same request. `409` if the category still has children or active products and no reassignment target was given. Rate-limited (60/min per IP). Audit-logged. |
| POST | `/api/admin/categories/:id/reassign-products` | Body `{ toCategoryId }` — moves every product from `:id` to `toCategoryId`. Rate-limited (60/min per IP). Audit-logged. |
| PATCH | `/api/admin/categories/order` | Body `{ ids: uuid[] }` — rewrites category `display_order` |
| PATCH | `/api/admin/categories/:id/branding` | Category `icon_url`/`appearance`/`is_featured`/`show_on_homepage` — `is_active` was removed from this schema; it's a content-endpoint (Activate/Deactivate) concern now, not a visual one. |
| POST | `/api/admin/products/reorder` | Body `{ ids: string[] }` — rewrites product `display_order`. No rate limit or audit log (matches `/api/admin/products` sibling route behavior). `requireAdmin()` only. |
| PATCH/DELETE | `/api/admin/faqs/:id` | Update/delete a FAQ |
| POST | `/api/media/upload` | Upload a file. Form fields: `file` (binary), `namespace` (`"banner-desktop"` \| `"banner-mobile"` \| `"products"` \| `"branding"`). Returns `201` with `{ path, publicUrl, dimensionWarning }`. Rate-limited (30/min per admin). PNG/JPG/WEBP only, 2 MB max — SVG rejected (XSS risk). |
| DELETE | `/api/media/:namespace/:filename` | Delete an uploaded file by its storage path. |

## Known dead/removed code (not yet cleaned up — scheduled for Phase 1)

- `POST /api/orders` — dead code, unused by the real checkout flow (which currently writes to Supabase directly from the browser). Removed in Phase 1 alongside the checkout security fix.
- `/api/setup/` — empty directory, no route file.

## Reserved (not implemented)

`POST /api/scan`, `GET /api/cards/:id` — names reserved for a future QR/collectible phase. See `ROADMAP.md`.
