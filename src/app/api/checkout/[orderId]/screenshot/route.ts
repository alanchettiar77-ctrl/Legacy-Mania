import { NextRequest, NextResponse } from "next/server";
import { validateFile, uploadMedia } from "@/lib/services/media-service";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { updateStatus } from "@/lib/services/order-service";
import { updateScreenshotUrl } from "@/lib/repositories/payment-repository";

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

    await updateScreenshotUrl(orderId, result.path);

    await updateStatus(orderId, "payment_verification");

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to submit payment screenshot";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
