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
