import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/supabase/admin-auth";
import { updateStatus, InvalidStatusTransitionError } from "@/lib/services/order-service";

const statusSchema = z.object({
  status: z.enum([
    "pending",
    "payment_verification",
    "confirmed",
    "processing",
    "shipped",
    "delivered",
    "cancelled",
    "refunded",
  ]),
});

type RouteParams = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const json = await req.json();
  const parsed = statusSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "A valid status is required" }, { status: 400 });
  }

  try {
    await updateStatus(id, parsed.data.status);
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof InvalidStatusTransitionError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    const message = error instanceof Error ? error.message : "Failed to update order status";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
