import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/supabase/admin-auth";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { recordAuditLog } from "@/lib/services/audit-service";
import { brandingUpdateSchema } from "@/lib/validation/branding";
import { getBrandingForAdmin, updateBranding } from "@/lib/services/branding-service";

export async function GET(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for") ?? "unknown";
  const rl = checkRateLimit(`branding:${ip}`, 60, 60_000);
  if (!rl.allowed) return rateLimitResponse(rl.resetAt);

  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  try {
    return NextResponse.json(await getBrandingForAdmin());
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for") ?? "unknown";
  const rl = checkRateLimit(`branding:${ip}`, 60, 60_000);
  if (!rl.allowed) return rateLimitResponse(rl.resetAt);

  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const parsed = brandingUpdateSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  try {
    const old = await getBrandingForAdmin();
    const merged = await updateBranding(parsed.data, auth.userId);
    await recordAuditLog({
      userId: auth.userId,
      action: "branding.update",
      tableName: "settings",
      oldValues: old,
      newValues: parsed.data,
    });
    return NextResponse.json(merged);
  } catch {
    return NextResponse.json({ error: "Failed to update branding" }, { status: 500 });
  }
}
