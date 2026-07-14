import {
  consumeReservationForProduct,
  releaseReservationForProduct,
} from "@/lib/repositories/inventory-repository";

export interface ReservationItem {
  productId: string;
  quantity: number;
}

export async function consumeReservation(items: ReservationItem[]): Promise<void> {
  for (const item of items) {
    await consumeReservationForProduct(item.productId, item.quantity);
  }
}

export async function releaseReservation(items: ReservationItem[]): Promise<void> {
  for (const item of items) {
    await releaseReservationForProduct(item.productId, item.quantity);
  }
}
