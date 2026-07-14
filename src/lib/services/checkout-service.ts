import type { CheckoutInput } from "@/lib/validation/checkout";
import { createOrderViaRpc } from "@/lib/repositories/checkout-repository";
import { generateOrderNumber } from "@/lib/utils";

const MIN_ORDER_QUANTITY = 5;

export interface CreateOrderResult {
  orderId: string;
  orderNumber: string;
  total: number;
}

export async function createOrder(
  input: CheckoutInput,
  userId: string | null
): Promise<CreateOrderResult> {
  const totalQuantity = input.items.reduce((sum, item) => sum + item.quantity, 0);
  if (totalQuantity < MIN_ORDER_QUANTITY) {
    throw new Error(`Minimum order quantity is ${MIN_ORDER_QUANTITY} cards`);
  }

  const order = await createOrderViaRpc({
    orderNumber: generateOrderNumber(),
    userId,
    guestEmail: userId ? null : input.email,
    shippingName: input.name,
    shippingEmail: input.email,
    shippingPhone: input.phone,
    shippingAddress: input.address,
    shippingCity: input.city,
    shippingState: input.state,
    shippingPincode: input.pincode,
    notes: input.notes ?? null,
    items: input.items.map((i) => ({ productId: i.productId, quantity: i.quantity })),
  });

  return { orderId: order.id, orderNumber: order.order_number, total: order.total };
}
