import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/supabase/admin-auth";
import { getPaymentScreenshotUrl } from "@/lib/services/payment-service";

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: RouteParams) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const { id } = await params;
  try {
    const url = await getPaymentScreenshotUrl(id);
    if (!url) return NextResponse.json({ error: "No screenshot available" }, { status: 404 });
    return NextResponse.json({ url });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to get screenshot URL";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
