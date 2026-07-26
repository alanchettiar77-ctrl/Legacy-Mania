import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/supabase/admin-auth";
import { reorderProducts } from "@/lib/services/product-service";

export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const json = await req.json().catch(() => null);
  const ids = json?.ids;
  if (!Array.isArray(ids) || ids.length === 0 || !ids.every((id) => typeof id === "string")) {
    return NextResponse.json({ error: "ids must be a non-empty array of strings" }, { status: 400 });
  }

  try {
    await reorderProducts(ids);
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Failed to reorder products" }, { status: 500 });
  }
}
