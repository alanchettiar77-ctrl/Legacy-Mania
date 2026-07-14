const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;

export interface PaymentRow {
  id: string;
  order_id: string;
  screenshot_url: string | null;
}

export async function getPaymentById(paymentId: string): Promise<PaymentRow | null> {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/payments?id=eq.${encodeURIComponent(paymentId)}&select=id,order_id,screenshot_url&limit=1`,
    { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` }, cache: "no-store" }
  );
  if (!res.ok) throw new Error(`Failed to fetch payment: ${res.status}`);
  const rows = await res.json();
  return rows?.[0] ?? null;
}

export async function updatePaymentStatus(
  paymentId: string,
  status: "verified" | "rejected",
  verifiedBy: string
): Promise<void> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/payments?id=eq.${encodeURIComponent(paymentId)}`, {
    method: "PATCH",
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify({ status, verified_by: verifiedBy, verified_at: new Date().toISOString() }),
  });
  if (!res.ok) throw new Error(`Failed to update payment status: ${res.status}`);
}

export async function updateScreenshotUrl(orderId: string, screenshotPath: string): Promise<void> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/payments?order_id=eq.${encodeURIComponent(orderId)}`, {
    method: "PATCH",
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify({ screenshot_url: screenshotPath }),
  });
  if (!res.ok) throw new Error(`Failed to update payment screenshot: ${res.status}`);
}
