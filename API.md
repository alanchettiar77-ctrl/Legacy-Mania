# API.md — Legacy Mania Endpoint Reference

Reflects the actual routes present in `src/app/api/` as of Phase 0. Routes planned for later
phases are tracked in `ROADMAP.md`, not documented here until they exist.

## Public (no auth)

| Method | Path | Description |
|---|---|---|
| GET | `/api/banners` | *(not yet built — Phase 2)* |
| GET | `/api/faqs` | Active FAQs, ordered by `display_order` |
| GET | `/api/products` | Product listing |
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
| GET/PATCH | `/api/admin/branding` | Brand asset slots (logo, favicon, OG/Twitter/PWA images) + `logo_hidden`. PATCH with `""` clears a slot back to default. Audit-logged with old+new values. |
| PATCH | `/api/admin/categories/order` | Body `{ ids: uuid[] }` — rewrites category `display_order` |
| PATCH | `/api/admin/categories/:id/branding` | Category `icon_url`/`appearance`/`is_featured`/`show_on_homepage`/`is_active` |
| PATCH/DELETE | `/api/admin/faqs/:id` | Update/delete a FAQ |
| POST | `/api/media/upload` | Upload a file. Form fields: `file` (binary), `namespace` (`"banners"` \| `"products"` \| `"branding"`). Returns `201` with `{ path, publicUrl, dimensionWarning }`. Rate-limited (30/min per admin). PNG/JPG/WEBP only, 2 MB max — SVG rejected (XSS risk). |
| DELETE | `/api/media/:namespace/:filename` | Delete an uploaded file by its storage path. |

## Known dead/removed code (not yet cleaned up — scheduled for Phase 1)

- `POST /api/orders` — dead code, unused by the real checkout flow (which currently writes to Supabase directly from the browser). Removed in Phase 1 alongside the checkout security fix.
- `/api/setup/` — empty directory, no route file.

## Reserved (not implemented)

`POST /api/scan`, `GET /api/cards/:id` — names reserved for a future QR/collectible phase. See `ROADMAP.md`.
