import type { OrderStatus } from "@/types";
import {
  getOrderById,
  updateOrderStatusInDb,
  getOrderItemsForOrder,
} from "@/lib/repositories/order-repository";
import { consumeReservation, releaseReservation } from "@/lib/services/inventory-service";

const ALLOWED_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  pending: ["payment_verification", "cancelled"],
  payment_verification: ["confirmed", "cancelled"],
  confirmed: ["processing", "cancelled", "refunded"],
  processing: ["shipped", "cancelled", "refunded"],
  shipped: ["delivered", "refunded"],
  delivered: ["refunded"],
  cancelled: [],
  refunded: [],
};

const PRE_CONFIRM_STATUSES: OrderStatus[] = ["pending", "payment_verification"];

export class InvalidStatusTransitionError extends Error {}

export async function updateStatus(orderId: string, newStatus: OrderStatus): Promise<void> {
  const order = await getOrderById(orderId);
  if (!order) throw new Error("Order not found");

  const allowed = ALLOWED_TRANSITIONS[order.status] ?? [];
  if (!allowed.includes(newStatus)) {
    throw new InvalidStatusTransitionError(
      `Cannot transition from ${order.status} to ${newStatus}`
    );
  }

  if (newStatus === "confirmed") {
    const items = await getOrderItemsForOrder(orderId);
    const withProduct = items.filter(
      (item): item is { product_id: string; quantity: number } => item.product_id !== null
    );
    await consumeReservation(withProduct.map((i) => ({ productId: i.product_id, quantity: i.quantity })));
  } else if (newStatus === "cancelled" && PRE_CONFIRM_STATUSES.includes(order.status)) {
    const items = await getOrderItemsForOrder(orderId);
    const withProduct = items.filter(
      (item): item is { product_id: string; quantity: number } => item.product_id !== null
    );
    await releaseReservation(withProduct.map((i) => ({ productId: i.product_id, quantity: i.quantity })));
  }

  await updateOrderStatusInDb(orderId, newStatus);
}
