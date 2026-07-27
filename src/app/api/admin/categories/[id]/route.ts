import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/supabase/admin-auth";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { recordAuditLog } from "@/lib/services/audit-service";
import {
  editCategory,
  deleteCategory,
  CategorySlugConflictError,
  CategoryCycleError,
  CategoryHasChildrenError,
  CategoryHasProductsError,
  CategoryInvalidReassignTargetError,
} from "@/lib/services/category-service";
import { categoryUpdateSchema, categoryDeleteSchema } from "@/lib/validation/category";

type RouteParams = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const ip = req.headers.get("x-forwarded-for") ?? "unknown";
  const rl = checkRateLimit(`categories-admin:${ip}`, 60, 60_000);
  if (!rl.allowed) return rateLimitResponse(rl.resetAt);

  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const json = await req.json().catch(() => null);
  const parsed = categoryUpdateSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid category details" }, { status: 400 });
  }

  try {
    const updated = await editCategory(id, parsed.data);
    if (!updated) return NextResponse.json({ error: "Category not found" }, { status: 404 });

    await recordAuditLog({
      userId: auth.userId,
      action: "category.update",
      tableName: "categories",
      recordId: id,
      newValues: parsed.data,
    });
    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof CategorySlugConflictError || error instanceof CategoryCycleError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    return NextResponse.json({ error: "Failed to update category" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: RouteParams) {
  const ip = req.headers.get("x-forwarded-for") ?? "unknown";
  const rl = checkRateLimit(`categories-admin:${ip}`, 60, 60_000);
  if (!rl.allowed) return rateLimitResponse(rl.resetAt);

  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const json = await req.json().catch(() => ({}));
  const parsed = categoryDeleteSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid delete options" }, { status: 400 });
  }

  try {
    await deleteCategory(id, parsed.data);
    await recordAuditLog({
      userId: auth.userId,
      action: "category.delete",
      tableName: "categories",
      recordId: id,
      newValues: parsed.data,
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    if (
      error instanceof CategoryHasChildrenError ||
      error instanceof CategoryHasProductsError ||
      error instanceof CategoryInvalidReassignTargetError
    ) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    if (error instanceof Error && error.message === "Category not found") {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    return NextResponse.json({ error: "Failed to delete category" }, { status: 500 });
  }
}
