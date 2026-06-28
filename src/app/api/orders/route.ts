import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateOrderNumber } from "@/lib/utils";
import { z } from "zod";

const orderSchema = z.object({
  items: z.array(z.object({
    productId: z.string(),
    name: z.string(),
    price: z.number(),
    quantity: z.number(),
    image: z.string().nullable().optional(),
  })),
  name: z.string(),
  email: z.string().email(),
  phone: z.string(),
  address: z.string(),
  city: z.string(),
  state: z.string(),
  pincode: z.string(),
  notes: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const body = await request.json();

    const parsed = orderSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const { items, name, email, phone, address, city, state, pincode, notes } = parsed.data;

    if (items.reduce((sum, i) => sum + i.quantity, 0) < 5) {
      return NextResponse.json({ error: "Minimum order quantity is 5 cards" }, { status: 400 });
    }

    const { data: { user } } = await supabase.auth.getUser();
    const subtotal = items.reduce((sum, i) => sum + i.price * i.quantity, 0);

    // Use any to bypass Supabase generic inference issues in API routes
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any;

    const { data: order, error } = await db
      .from("orders")
      .insert({
        order_number: generateOrderNumber(),
        user_id: user?.id ?? null,
        guest_email: !user ? email : null,
        status: "pending",
        subtotal,
        shipping_cost: 0,
        total: subtotal,
        shipping_name: name,
        shipping_email: email,
        shipping_phone: phone,
        shipping_address: address,
        shipping_city: city,
        shipping_state: state,
        shipping_pincode: pincode,
        notes: notes ?? null,
      })
      .select()
      .single();

    if (error || !order) {
      return NextResponse.json({ error: "Failed to create order" }, { status: 500 });
    }

    await db.from("order_items").insert(
      items.map((item: { productId: string; name: string; price: number; quantity: number; image?: string | null }) => ({
        order_id: order.id,
        product_id: item.productId,
        product_name: item.name,
        product_image: item.image ?? null,
        quantity: item.quantity,
        unit_price: item.price,
        total_price: item.price * item.quantity,
      }))
    );

    await db.from("payments").insert({
      order_id: order.id,
      amount: subtotal,
      payment_method: "upi",
      status: "pending",
    });

    return NextResponse.json({ orderId: order.id, orderNumber: order.order_number });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
