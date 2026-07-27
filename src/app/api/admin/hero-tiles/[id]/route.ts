import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/supabase/admin-auth";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { recordAuditLog } from "@/lib/services/audit-service";
import { heroTileUpdateSchema } from "@/lib/validation/hero-tile";
import { updateHeroTileById, deleteHeroTile } from "@/lib/services/hero-tile-service";

type RouteParams = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const ip = req.headers.get("x-forwarded-for") ?? "unknown";
  const rl = checkRateLimit(`hero-tiles:${ip}`, 60, 60_000);
  if (!rl.allowed) return rateLimitResponse(rl.resetAt);

  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const parsed = heroTileUpdateSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  try {
    const updated = await updateHeroTileById(id, parsed.data, auth.userId);
    if (!updated) return NextResponse.json({ error: "Hero tile not found" }, { status: 404 });

    await recordAuditLog({
      userId: auth.userId,
      action: "hero_tile.update",
      tableName: "hero_tiles",
      recordId: id,
      newValues: parsed.data,
    });
    return NextResponse.json(updated);
  } catch {
    return NextResponse.json({ error: "Failed to update hero tile" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: RouteParams) {
  const ip = req.headers.get("x-forwarded-for") ?? "unknown";
  const rl = checkRateLimit(`hero-tiles:${ip}`, 60, 60_000);
  if (!rl.allowed) return rateLimitResponse(rl.resetAt);

  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const { id } = await params;
  try {
    const deleted = await deleteHeroTile(id, auth.userId);
    if (!deleted) return NextResponse.json({ error: "Hero tile not found" }, { status: 404 });

    await recordAuditLog({
      userId: auth.userId,
      action: "hero_tile.delete",
      tableName: "hero_tiles",
      recordId: id,
    });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Failed to delete hero tile" }, { status: 500 });
  }
}
