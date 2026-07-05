import type { Category } from "@/types";

const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;

export async function listActiveCategories(): Promise<Category[]> {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/categories?select=*&is_active=eq.true&order=display_order.asc`,
    { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` }, cache: "no-store" }
  );
  if (!res.ok) throw new Error(`Failed to fetch categories: ${res.status}`);
  return res.json();
}
