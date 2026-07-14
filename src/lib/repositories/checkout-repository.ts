const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;

export interface CreateOrderParams {
  orderNumber: string;
  userId: string | null;
  guestEmail: string | null;
  shippingName: string;
  shippingEmail: string;
  shippingPhone: string;
  shippingAddress: string;
  shippingCity: string;
  shippingState: string;
  shippingPincode: string;
  notes: string | null;
  items: { productId: string; quantity: number }[];
}

export interface CreatedOrder {
  id: string;
  order_number: string;
  total: number;
}

export async function createOrderViaRpc(params: CreateOrderParams): Promise<CreatedOrder> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/create_order`, {
    method: "POST",
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      p_order_number: params.orderNumber,
      p_user_id: params.userId,
      p_guest_email: params.guestEmail,
      p_shipping_name: params.shippingName,
      p_shipping_email: params.shippingEmail,
      p_shipping_phone: params.shippingPhone,
      p_shipping_address: params.shippingAddress,
      p_shipping_city: params.shippingCity,
      p_shipping_state: params.shippingState,
      p_shipping_pincode: params.shippingPincode,
      p_notes: params.notes,
      p_items: params.items.map((i) => ({ product_id: i.productId, quantity: i.quantity })),
    }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.message || "Failed to create order");
  }

  return res.json();
}
