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
| GET | `/api/admin/analytics` | Analytics overview data |
| POST | `/api/admin/faqs` | Create a FAQ |
| PATCH/DELETE | `/api/admin/faqs/:id` | Update/delete a FAQ |
| POST | `/api/media/upload` | Upload a file. Form fields: `file` (binary), `namespace` (`"banners"` \| `"products"`). Returns `201` with `{ path, publicUrl, dimensionWarning }`. Rate-limited (30/min per admin). |
| DELETE | `/api/media/:namespace/:filename` | Delete an uploaded file by its storage path. |

## Known dead/removed code (not yet cleaned up — scheduled for Phase 1)

- `POST /api/orders` — dead code, unused by the real checkout flow (which currently writes to Supabase directly from the browser). Removed in Phase 1 alongside the checkout security fix.
- `/api/setup/` — empty directory, no route file.

## Reserved (not implemented)

`POST /api/scan`, `GET /api/cards/:id` — names reserved for a future QR/collectible phase. See `ROADMAP.md`.
