import type { Category } from "@/types";

const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;

const HEADERS = {
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
  "Content-Type": "application/json",
};

export async function listActiveCategories(): Promise<Category[]> {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/categories?select=*&is_active=eq.true&order=display_order.asc`,
    { headers: HEADERS, cache: "no-store" }
  );
  if (!res.ok) throw new Error(`Failed to fetch categories: ${res.status}`);
  return res.json();
}

/** Homepage "Browse by Series" cards — cached 5 min, tag-revalidated on admin edits. */
export async function listHomepageCategories(): Promise<Category[]> {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/categories?select=*&is_active=eq.true&show_on_homepage=eq.true&parent_id=is.null&order=display_order.asc`,
    { headers: HEADERS, next: { revalidate: 300, tags: ["categories-branding"] } }
  );
  if (!res.ok) throw new Error(`Failed to fetch homepage categories: ${res.status}`);
  return res.json();
}

/** All categories (any status) for the admin branding panel. */
export async function listAllCategories(): Promise<Category[]> {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/categories?select=*&order=display_order.asc`,
    { headers: HEADERS, cache: "no-store" }
  );
  if (!res.ok) throw new Error(`Failed to fetch categories: ${res.status}`);
  return res.json();
}

export async function updateCategoryBranding(
  id: string,
  patch: Record<string, unknown>
): Promise<Category | null> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/categories?id=eq.${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { ...HEADERS, Prefer: "return=representation" },
    body: JSON.stringify(patch),
  });
  if (!res.ok) throw new Error(`Failed to update category branding: ${res.status}`);
  const rows = await res.json();
  return rows[0] ?? null;
}

/** Rewrites display_order to match the given id order (0..n-1). */
export async function reorderCategories(ids: string[]): Promise<void> {
  for (let i = 0; i < ids.length; i++) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/categories?id=eq.${encodeURIComponent(ids[i])}`, {
      method: "PATCH",
      headers: HEADERS,
      body: JSON.stringify({ display_order: i }),
    });
    if (!res.ok) throw new Error(`Failed to reorder category ${ids[i]}: ${res.status}`);
  }
}
