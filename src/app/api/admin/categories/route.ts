import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/supabase/admin-auth";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { recordAuditLog } from "@/lib/services/audit-service";
import { createCategory, CategorySlugConflictError } from "@/lib/services/category-service";
import { categorySchema } from "@/lib/validation/category";

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for") ?? "unknown";
  const rl = checkRateLimit(`categories-admin:${ip}`, 60, 60_000);
  if (!rl.allowed) return rateLimitResponse(rl.resetAt);

  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const json = await req.json().catch(() => null);
  const parsed = categorySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid category details" }, { status: 400 });
  }

  try {
    const category = await createCategory({
      ...parsed.data,
      description: parsed.data.description ?? null,
      parent_id: parsed.data.parent_id ?? null,
    });
    await recordAuditLog({
      userId: auth.userId,
      action: "category.create",
      tableName: "categories",
      recordId: category.id,
      newValues: parsed.data,
    });
    return NextResponse.json(category, { status: 201 });
  } catch (error) {
    if (error instanceof CategorySlugConflictError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    return NextResponse.json({ error: "Failed to create category" }, { status: 500 });
  }
}
