import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/supabase/admin-auth";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { recordAuditLog } from "@/lib/services/audit-service";
import { reassignProducts } from "@/lib/services/category-service";
import { categoryReassignProductsSchema } from "@/lib/validation/category";

type RouteParams = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: RouteParams) {
  const ip = req.headers.get("x-forwarded-for") ?? "unknown";
  const rl = checkRateLimit(`categories-admin:${ip}`, 60, 60_000);
  if (!rl.allowed) return rateLimitResponse(rl.resetAt);

  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const json = await req.json().catch(() => null);
  const parsed = categoryReassignProductsSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "toCategoryId is required" }, { status: 400 });
  }

  try {
    const movedCount = await reassignProducts(id, parsed.data.toCategoryId);
    await recordAuditLog({
      userId: auth.userId,
      action: "category.reassign_products",
      tableName: "categories",
      recordId: id,
      newValues: { toCategoryId: parsed.data.toCategoryId, movedCount },
    });
    return NextResponse.json({ success: true, movedCount });
  } catch {
    return NextResponse.json({ error: "Failed to reassign products" }, { status: 500 });
  }
}
