import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/supabase/admin-auth";
import { rejectPayment } from "@/lib/services/payment-service";

type RouteParams = { params: Promise<{ id: string }> };

export async function PATCH(_req: NextRequest, { params }: RouteParams) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const { id } = await params;
  try {
    await rejectPayment(id, auth.userId);
    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to reject payment";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
