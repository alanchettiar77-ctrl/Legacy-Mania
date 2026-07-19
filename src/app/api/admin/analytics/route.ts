import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/supabase/admin-auth";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { recordAuditLog } from "@/lib/services/audit-service";
import { getAnalyticsSummary } from "@/lib/services/analytics-service";

export async function GET(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for") ?? "unknown";
  const rateLimit = checkRateLimit(`analytics:${ip}`, 30, 60_000);
  if (!rateLimit.allowed) return rateLimitResponse(rateLimit.resetAt);

  const auth = await requireAdmin();
  if (!auth.ok) {
    await recordAuditLog({
      action: "analytics.access_denied",
      tableName: "analytics",
      newValues: { ip, status: auth.response.status },
    });
    return auth.response;
  }

  try {
    const summary = await getAnalyticsSummary();
    await recordAuditLog({
      userId: auth.userId,
      action: "analytics.view",
      tableName: "analytics",
      newValues: { ip },
    });
    return NextResponse.json(summary);
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
