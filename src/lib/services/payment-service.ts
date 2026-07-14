import { getPaymentById, updatePaymentStatus } from "@/lib/repositories/payment-repository";
import { updateStatus } from "@/lib/services/order-service";
import { getSignedMediaUrl } from "@/lib/services/media-service";

export async function verifyPayment(paymentId: string, adminUserId: string): Promise<void> {
  const payment = await getPaymentById(paymentId);
  if (!payment) throw new Error("Payment not found");

  await updatePaymentStatus(paymentId, "verified", adminUserId);
  await updateStatus(payment.order_id, "confirmed");
}

export async function rejectPayment(paymentId: string, adminUserId: string): Promise<void> {
  const payment = await getPaymentById(paymentId);
  if (!payment) throw new Error("Payment not found");

  await updatePaymentStatus(paymentId, "rejected", adminUserId);
  await updateStatus(payment.order_id, "cancelled");
}

export async function getPaymentScreenshotUrl(paymentId: string): Promise<string | null> {
  const payment = await getPaymentById(paymentId);
  if (!payment?.screenshot_url) return null;
  return getSignedMediaUrl(payment.screenshot_url, "payments");
}
