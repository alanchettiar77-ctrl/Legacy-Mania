const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;

async function callRpc(name: string, params: Record<string, unknown>): Promise<void> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(params),
  });
  if (!res.ok) throw new Error(`RPC ${name} failed: ${res.status}`);
}

export async function consumeReservationForProduct(productId: string, quantity: number): Promise<void> {
  await callRpc("consume_reservation", { p_product_id: productId, p_quantity: quantity });
}

export async function releaseReservationForProduct(productId: string, quantity: number): Promise<void> {
  await callRpc("release_reservation", { p_product_id: productId, p_quantity: quantity });
}
