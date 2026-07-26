import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/supabase/admin-auth";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { recordAuditLog } from "@/lib/services/audit-service";
import { bannerCreateSchema } from "@/lib/validation/banner";
import { listAllBanners, createBanner } from "@/lib/services/banner-service";

export async function GET(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for") ?? "unknown";
  const rl = checkRateLimit(`banners:${ip}`, 60, 60_000);
  if (!rl.allowed) return rateLimitResponse(rl.resetAt);

  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  try {
    return NextResponse.json(await listAllBanners());
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for") ?? "unknown";
  const rl = checkRateLimit(`banners:${ip}`, 60, 60_000);
  if (!rl.allowed) return rateLimitResponse(rl.resetAt);

  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const parsed = bannerCreateSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  try {
    const created = await createBanner(parsed.data, auth.userId);
    await recordAuditLog({
      userId: auth.userId,
      action: "banner.create",
      tableName: "banners",
      recordId: created.id,
      newValues: parsed.data,
    });
    return NextResponse.json(created, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Failed to create banner" }, { status: 500 });
  }
}
