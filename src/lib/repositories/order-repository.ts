import type { OrderStatus } from "@/types";

const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;

export interface OrderRow {
  id: string;
  status: OrderStatus;
}

export interface OrderItemRow {
  product_id: string | null;
  quantity: number;
}

export async function getOrderById(orderId: string): Promise<OrderRow | null> {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/orders?id=eq.${encodeURIComponent(orderId)}&select=id,status&limit=1`,
    { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` }, cache: "no-store" }
  );
  if (!res.ok) throw new Error(`Failed to fetch order: ${res.status}`);
  const rows = await res.json();
  return rows?.[0] ?? null;
}

export async function updateOrderStatusInDb(orderId: string, status: OrderStatus): Promise<void> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/orders?id=eq.${encodeURIComponent(orderId)}`, {
    method: "PATCH",
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify({ status }),
  });
  if (!res.ok) throw new Error(`Failed to update order status: ${res.status}`);
}

export async function getOrderItemsForOrder(orderId: string): Promise<OrderItemRow[]> {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/order_items?order_id=eq.${encodeURIComponent(orderId)}&select=product_id,quantity`,
    { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` }, cache: "no-store" }
  );
  if (!res.ok) throw new Error(`Failed to fetch order items: ${res.status}`);
  return res.json();
}
