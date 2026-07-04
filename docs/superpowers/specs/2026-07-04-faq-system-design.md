# FAQ System — Design Spec

Date: 2026-07-04
Status: Approved (design), pending implementation plan

## Context

Legacy Mania currently has a hardcoded `/faq` page (`src/app/(shop)/faq/page.tsx`) with a static
array of 12 Q&As about card conditions, MOQ, etc. This spec replaces it with a database-driven FAQ
system so admins can add/edit/delete/reorder/toggle FAQs without a code deploy, and reseeds the page
with 12 new, e-commerce-general Q&As.

This is the first of two related subsystems (FAQ, then a promotional Banner carousel). Banner is
scoped separately.

**Stack correction**: the originating request assumed Prisma + Clerk + Cloudinary. The actual stack
is Next.js 16 + TypeScript + Tailwind + **Supabase** (direct `@supabase/supabase-js` /
`@supabase/ssr`, Postgres RLS, Supabase Storage, custom cookie-session auth — no Prisma, no Clerk,
no Cloudinary). This spec follows the actual stack, confirmed with the user.

## Database

New migration file (next in sequence after `001_initial_schema.sql`) adds:

```sql
create table faqs (
  id uuid primary key default gen_random_uuid(),
  question text not null,
  answer text not null,
  display_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- reuse the existing set_updated_at trigger function from 001_initial_schema.sql
create trigger faqs_updated_at before update on faqs
  for each row execute function set_updated_at();

alter table faqs enable row level security;

create policy "Public can read active faqs" on faqs
  for select using (is_active = true);

-- no insert/update/delete policy for anon/authenticated: all writes go through
-- the service-role API routes, matching the profiles/admins pattern.
```

Seed data: the migration inserts the 12 new Q&As (verbatim from the request) with `display_order`
0–11. The old hardcoded 12 Q&As are dropped entirely (confirmed with user).

## Shared backend utility

`src/lib/supabase/admin-auth.ts` (new file):

```ts
export async function requireAdmin(): Promise<
  { ok: true; userId: string } | { ok: false; response: NextResponse }
>
```

Extracted from the pattern already used in `src/app/api/admin/admins/route.ts` (get session user →
fetch `profiles.role` via service-role REST call → 401 if no user, 403 if not admin). Existing
`admin/admins/route.ts` is left untouched; only new routes (FAQ, and later Banner) adopt the shared
helper. This avoids a third copy-paste of the same ~10 lines.

## API routes

- `GET /api/faqs` — public. Queries `faqs` where `is_active = true`, ordered by `display_order`.
  No auth required (RLS already restricts to active rows regardless).
- `POST /api/admin/faqs` — admin-only (`requireAdmin`). Body: `{ question, answer, display_order? }`.
  Zod-validated (non-empty strings, `question` ≤ 500 chars, `answer` ≤ 5000 chars). If
  `display_order` omitted, defaults to `max(display_order) + 1`.
- `PATCH /api/admin/faqs/:id` — admin-only. Partial update of any of
  `question | answer | display_order | is_active`. Used for edit, toggle-active, and reorder
  (reorder calls this twice — once per swapped row — from the client).
- `DELETE /api/admin/faqs/:id` — admin-only. Hard delete (FAQs aren't referenced by other tables,
  unlike products, so soft-delete isn't needed).

All admin routes sanitize `question`/`answer` (strip control characters; React's default escaping
handles HTML/XSS on render, so no HTML sanitization library is needed since FAQ content is rendered
as plain text, never `dangerouslySetInnerHTML`).

## Frontend

### Public `/faq` page

`src/app/(shop)/faq/page.tsx` becomes an async server component: fetches active FAQs directly via
the server Supabase client (same pattern as other shop pages), passes them to:

- `src/components/faq/FAQAccordion.tsx` — client component wrapping
  `@radix-ui/react-accordion` (already an installed, currently-unused dependency). Type
  `single collapsible` or `multiple` — multiple, so users can compare answers side by side.
  Styled with existing design tokens (`bg-card`, `border-border`, `text-foreground`,
  `text-muted-foreground`) to match the current look — no shadcn scaffold introduced.
- `src/components/faq/FAQItem.tsx` — one accordion item: `Accordion.Trigger` (question + rotating
  `ChevronDown`) and `Accordion.Content` (answer), using Radix's built-in open/close animation
  (height transition via CSS custom property, matching Radix's standard recipe) for smooth
  expand/collapse. Fully keyboard-navigable and ARIA-compliant out of the box via Radix.
- Page emits `FAQPage` JSON-LD (`mainEntity` array of `Question`/`Answer`) — same precedent as the
  existing `Product` JSON-LD on product pages.
- Dark/light theme: inherits from existing CSS-variable-based theme tokens — no new theme-specific
  code needed.
- The existing "Still have questions? Contact Us" CTA block at the bottom is kept as-is.

### Admin `/admin/faqs`

- New sidebar entry in `src/components/admin/admin-sidebar.tsx`: `{ href: "/admin/faqs", label:
  "FAQs", icon: HelpCircle }`, inserted after "Categories" (top-level, matching the flat nav
  structure — confirmed with user).
- `src/app/admin/faqs/page.tsx` — server component, fetches all FAQs (active + inactive) via admin
  client, passes to:
- `src/app/admin/faqs/faqs-table.tsx` — client component modeled directly on
  `src/app/admin/products/products-table.tsx`: table rows show question (truncated), active/inactive
  badge, up/down reorder arrow buttons (disabled at the top/bottom row), edit button, delete button
  (with `confirm()`, matching existing convention), "Add FAQ" button.
- Add/edit uses a modal form (`FAQForm`, following the existing address-modal-form shape used in
  `/account/addresses`) with `question` (input) and `answer` (textarea) fields, `react-hook-form` +
  `zod` validation (matching existing form conventions elsewhere in the app).
- All mutations call the new `/api/admin/faqs*` routes (fetch), not direct
  `supabase.from("faqs")` client calls — unlike `ProductsTable`'s direct-client pattern, because
  writes to `faqs` have no anon/authenticated RLS policy (service-role only), so they must go
  through the server routes.
- `sonner` toasts on every action; optimistic local state update after success, matching
  `ProductsTable`.

## Error handling

- API routes return `{ error: string }` with appropriate status codes (400 validation, 401
  unauthenticated, 403 not-admin, 404 not found, 500 unexpected) — matching `admin/admins/route.ts`.
- Client table catches fetch failures and shows a `sonner` error toast without mutating local state.
- Public `/faq` page: if the Supabase fetch fails or returns zero rows, render an empty-state message
  ("No FAQs yet — check back soon, or contact us") rather than crashing.

## Testing

- **Unit**: Zod schema validation (question/answer length/emptiness), `requireAdmin` helper
  (mocked fetch responses for user/role lookups).
- **Integration/API**: each of the 4 admin route handlers — auth guard behavior (401/403), create,
  update (including reorder swap), delete.
- **E2E (Playwright)**: `/faq` renders all active FAQs, one item expands/collapses on click; admin
  flow — log in as admin, add a FAQ, edit it, reorder it, deactivate it (disappears from `/faq`),
  delete it.
- **Accessibility**: axe-core scan of `/faq` (keyboard nav through accordion, ARIA attributes present).
- **Responsive**: Playwright viewport check at mobile width (375px) — accordion items don't overflow,
  text wraps correctly.

## Out of scope

- The Banner carousel system (separate spec, to follow).
- Any change to `admin/admins/route.ts` (left untouched per "don't rewrite existing code").
- Rich text / HTML formatting in FAQ answers (plain text only, per the provided content).
