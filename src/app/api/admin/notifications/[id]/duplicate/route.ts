import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/supabase/admin-auth";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { recordAuditLog } from "@/lib/services/audit-service";
import { duplicateNotification } from "@/lib/services/notification-service";

type RouteParams = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: RouteParams) {
  const ip = req.headers.get("x-forwarded-for") ?? "unknown";
  const rl = checkRateLimit(`notifications:${ip}`, 60, 60_000);
  if (!rl.allowed) return rateLimitResponse(rl.resetAt);

  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const { id } = await params;
  try {
    const copy = await duplicateNotification(id, auth.userId);
    if (!copy) return NextResponse.json({ error: "Notification not found" }, { status: 404 });

    await recordAuditLog({
      userId: auth.userId,
      action: "notification.duplicate",
      tableName: "homepage_notifications",
      recordId: copy.id,
      oldValues: { sourceId: id },
    });
    return NextResponse.json(copy, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Failed to duplicate notification" }, { status: 500 });
  }
}
