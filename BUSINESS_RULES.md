# BUSINESS_RULES.md — Legacy Mania

Domain rules that live in the service layer. Code is the enforcement point; this file is the human-readable contract.

## Checkout & Orders (Phase 1)

- Prices are always re-derived server-side from `products` — client-submitted prices are ignored.
- Minimum 5 items per order (`CheckoutService`).
- Order status transitions follow the guarded state machine in `OrderService`; invalid transitions → 409.
- Stock: `reserved_quantity` increments at order creation; consumed on payment verify, released on reject/expiry (hourly `pg_cron`).

## Homepage Notifications (2026-07-19)

- A notification is **live** only when: `is_active = TRUE` AND not soft-deleted AND now is inside `[start_date, end_date]` (open-ended when NULL) AND device matches (`both` always matches).
- Ordering on the storefront: `priority` DESC, then `display_order` ASC.
- If zero notifications are live (or the DB is unreachable), the homepage bar renders **nothing** — never an empty strip, never an error.
- Duplicating a notification always creates a **hidden draft** (`is_active = FALSE`, title suffixed "(copy)") appended at the end.
- Delete is always soft (`deleted_at`); rows never leave the table.
- Every admin mutation is audit-logged with the acting admin's id.
- Display styling (speed, direction, colors, per-device visibility) is one JSON config in `settings.homepage_notifications_display`, editable only by admins.
- Future automation (live "X just purchased" feeds): to be built as a service that inserts/updates rows in `homepage_notifications` — the schema (`type`, `target_audience`, `country`) is ready; **no fake live notifications** are ever to be hardcoded.

## Branding (2026-07-19)

- Branding is content: logo, favicon, social images, category icons/appearance all come from the DB (`settings.branding` + `categories` columns) — never hardcoded.
- Empty slot (`""`) = use the built-in default (text wordmark, static og-image). `logo_hidden` hides the logo entirely without deleting the uploaded asset.
- Hiding a category (`is_active=false`) removes it from homepage, navigation, catalog and search — products are never deleted or unlinked.
- `show_on_homepage=false` hides only the homepage card; the category stays browsable in the catalog.
- Storefront branding/category reads are cached 5 minutes and tag-revalidated on every admin edit — changes appear within seconds without redeploys.
- Only PNG/JPG/WEBP up to 2 MB via MediaService; SVG is always rejected (XSS).

## Admin & Analytics

- Analytics responses contain aggregates only (counts, revenue totals, status breakdown) — never per-customer rows.
- All admin API access follows: rate limit → `requireAdmin()` → validate → service → audit log.
