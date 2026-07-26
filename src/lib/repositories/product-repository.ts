const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;

const HEADERS = {
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
  "Content-Type": "application/json",
};

export interface ProductWritePayload {
  name: string;
  slug: string;
  description: string | null;
  price: number;
  compare_price: number | null;
  images: string[];
  tags: string[];
  category_id: string | null;
  series: string | null;
  saga: string | null;
  collection: string | null;
  stock_quantity: number;
  display_order: number;
  sku: string | null;
  is_active: boolean;
  is_featured: boolean;
  is_new: boolean;
  meta_title: string | null;
  meta_description: string | null;
}

export async function insertProduct(payload: ProductWritePayload): Promise<{ id: string }> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/products`, {
    method: "POST",
    headers: { ...HEADERS, Prefer: "return=representation" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`Failed to create product: ${res.status}`);
  const rows = await res.json();
  return rows[0];
}

export async function updateProduct(id: string, payload: Partial<ProductWritePayload>): Promise<void> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/products?id=eq.${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { ...HEADERS, Prefer: "return=minimal" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`Failed to update product: ${res.status}`);
}

function categoryFilter(categoryId: string | null): string {
  return categoryId ? `category_id=eq.${encodeURIComponent(categoryId)}` : "category_id=is.null";
}

/** Fetches a single product's category_id (used to resolve the real category on partial patches). */
export async function getProduct(id: string): Promise<{ category_id: string | null } | null> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/products?id=eq.${encodeURIComponent(id)}&select=category_id&limit=1`, {
    headers: HEADERS,
    cache: "no-store",
  });
  if (!res.ok) return null;
  const rows = await res.json();
  return rows[0] ?? null;
}

/** Highest display_order currently used in a category (0 if empty) — used to suggest the next value. */
export async function getMaxDisplayOrder(categoryId: string | null): Promise<number> {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/products?${categoryFilter(categoryId)}&select=display_order&order=display_order.desc&limit=1`,
    { headers: HEADERS, cache: "no-store" }
  );
  if (!res.ok) return 0;
  const rows = await res.json();
  return rows?.[0]?.display_order ?? 0;
}

/** True if another active product in the same category already uses this display_order. */
export async function findDisplayOrderConflict(
  categoryId: string | null,
  displayOrder: number,
  excludeId?: string
): Promise<boolean> {
  const params = new URLSearchParams();
  params.set("select", "id");
  params.set("display_order", `eq.${displayOrder}`);
  if (excludeId) params.set("id", `neq.${excludeId}`);
  const url = `${SUPABASE_URL}/rest/v1/products?${categoryFilter(categoryId)}&${params.toString()}`;
  const res = await fetch(url, { headers: HEADERS, cache: "no-store" });
  if (!res.ok) return false;
  const rows = await res.json();
  return rows.length > 0;
}

/** Rewrites display_order to match the given id order (0..n-1). */
export async function reorderProducts(ids: string[]): Promise<void> {
  for (let i = 0; i < ids.length; i++) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/products?id=eq.${encodeURIComponent(ids[i])}`, {
      method: "PATCH",
      headers: HEADERS,
      body: JSON.stringify({ display_order: i }),
    });
    if (!res.ok) throw new Error(`Failed to reorder product ${ids[i]}: ${res.status}`);
  }
}
