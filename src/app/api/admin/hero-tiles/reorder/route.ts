import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/supabase/admin-auth";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { recordAuditLog } from "@/lib/services/audit-service";
import { heroTileReorderSchema } from "@/lib/validation/hero-tile";
import { reorder } from "@/lib/services/hero-tile-service";

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for") ?? "unknown";
  const rl = checkRateLimit(`hero-tiles:${ip}`, 60, 60_000);
  if (!rl.allowed) return rateLimitResponse(rl.resetAt);

  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const parsed = heroTileReorderSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  try {
    await reorder(parsed.data.ids, auth.userId);
    await recordAuditLog({
      userId: auth.userId,
      action: "hero_tile.reorder",
      tableName: "hero_tiles",
      newValues: { ids: parsed.data.ids },
    });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Failed to reorder hero tiles" }, { status: 500 });
  }
}
