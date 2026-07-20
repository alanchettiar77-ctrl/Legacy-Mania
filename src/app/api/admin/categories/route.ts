import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/supabase/admin-auth";
import { createCategory } from "@/lib/services/category-service";
import { categorySchema } from "@/lib/validation/category";

export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const json = await req.json().catch(() => null);
  const parsed = categorySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid category details" }, { status: 400 });
  }

  try {
    const category = await createCategory({
      name: parsed.data.name,
      slug: parsed.data.slug,
      description: parsed.data.description ?? null,
      parent_id: parsed.data.parent_id ?? null,
      display_order: parsed.data.display_order,
      is_active: parsed.data.is_active,
    });
    return NextResponse.json(category, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Failed to create category" }, { status: 500 });
  }
}
