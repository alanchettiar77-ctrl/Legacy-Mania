import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { validateFile, uploadMedia } from "@/lib/services/media-service";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { updateStatus } from "@/lib/services/order-service";

type RouteParams = { params: Promise<{ orderId: string }> };

export async function POST(req: NextRequest, { params }: RouteParams) {
  const { orderId } = await params;

  const rateLimit = checkRateLimit(`checkout-screenshot:${orderId}`, 5, 60_000);
  if (!rateLimit.allowed) return rateLimitResponse(rateLimit.resetAt);

  const formData = await req.formData();
  const file = formData.get("file");
  if (!(file instanceof Blob) || file.size === 0) {
    return NextResponse.json({ error: "A file is required" }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const mimeType = file.type;

  const validation = await validateFile(buffer, mimeType, "payments");
  if (!validation.valid) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  try {
    const result = await uploadMedia(buffer, mimeType, "payments");

    const supabase = await createAdminClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any;

    const { error: paymentError } = await db
      .from("payments")
      .update({ screenshot_url: result.path })
      .eq("order_id", orderId);
    if (paymentError) throw new Error(paymentError.message);

    await updateStatus(orderId, "payment_verification");

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to submit payment screenshot";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
