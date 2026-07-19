import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/supabase/admin-auth";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { recordAuditLog } from "@/lib/services/audit-service";
import { notificationUpdateSchema } from "@/lib/validation/notification";
import { updateNotification, deleteNotification } from "@/lib/services/notification-service";

type RouteParams = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const ip = req.headers.get("x-forwarded-for") ?? "unknown";
  const rl = checkRateLimit(`notifications:${ip}`, 60, 60_000);
  if (!rl.allowed) return rateLimitResponse(rl.resetAt);

  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const parsed = notificationUpdateSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  try {
    const updated = await updateNotification(id, parsed.data, auth.userId);
    if (!updated) return NextResponse.json({ error: "Notification not found" }, { status: 404 });

    await recordAuditLog({
      userId: auth.userId,
      action: "notification.update",
      tableName: "homepage_notifications",
      recordId: id,
      newValues: parsed.data,
    });
    return NextResponse.json(updated);
  } catch {
    return NextResponse.json({ error: "Failed to update notification" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: RouteParams) {
  const ip = req.headers.get("x-forwarded-for") ?? "unknown";
  const rl = checkRateLimit(`notifications:${ip}`, 60, 60_000);
  if (!rl.allowed) return rateLimitResponse(rl.resetAt);

  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const { id } = await params;
  try {
    const deleted = await deleteNotification(id, auth.userId);
    if (!deleted) return NextResponse.json({ error: "Notification not found" }, { status: 404 });

    await recordAuditLog({
      userId: auth.userId,
      action: "notification.delete",
      tableName: "homepage_notifications",
      recordId: id,
    });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Failed to delete notification" }, { status: 500 });
  }
}
