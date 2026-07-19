import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/supabase/admin-auth";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { recordAuditLog } from "@/lib/services/audit-service";
import { bulkSchema } from "@/lib/validation/notification";
import { bulkAction } from "@/lib/services/notification-service";

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for") ?? "unknown";
  const rl = checkRateLimit(`notifications:${ip}`, 60, 60_000);
  if (!rl.allowed) return rateLimitResponse(rl.resetAt);

  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const parsed = bulkSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  try {
    const result = await bulkAction(parsed.data.ids, parsed.data.action, auth.userId);
    await recordAuditLog({
      userId: auth.userId,
      action: `notification.bulk_${parsed.data.action}`,
      tableName: "homepage_notifications",
      newValues: { ids: parsed.data.ids, processed: result.processed },
    });
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: "Bulk action failed" }, { status: 500 });
  }
}
