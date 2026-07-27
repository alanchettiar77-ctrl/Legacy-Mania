/**
 * @jest-environment node
 */
jest.mock("@/lib/supabase/admin-auth");
jest.mock("@/lib/rate-limit", () => ({
  checkRateLimit: jest.fn(() => ({ allowed: true })),
  rateLimitResponse: jest.fn(),
}));
jest.mock("@/lib/services/audit-service", () => ({ recordAuditLog: jest.fn() }));
jest.mock("@/lib/services/hero-tile-service");

import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/supabase/admin-auth";
import { recordAuditLog } from "@/lib/services/audit-service";
import { listAllHeroTiles, createHeroTile } from "@/lib/services/hero-tile-service";
import { GET, POST } from "./route";

const adminAuth = { ok: true as const, userId: "admin-1" };

function req(body?: unknown) {
  return new NextRequest("http://localhost/api/admin/hero-tiles", {
    method: body ? "POST" : "GET",
    body: body ? JSON.stringify(body) : undefined,
  });
}

describe("GET /api/admin/hero-tiles", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns 401 when not authenticated", async () => {
    (requireAdmin as jest.Mock).mockResolvedValue({
      ok: false,
      response: new Response(null, { status: 401 }),
    });
    const res = await GET(req());
    expect(res.status).toBe(401);
  });

  it("returns the tile list for an authenticated admin", async () => {
    (requireAdmin as jest.Mock).mockResolvedValue(adminAuth);
    (listAllHeroTiles as jest.Mock).mockResolvedValue([{ id: "t1" }]);
    const res = await GET(req());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([{ id: "t1" }]);
  });
});

describe("POST /api/admin/hero-tiles", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns 401 when not authenticated", async () => {
    (requireAdmin as jest.Mock).mockResolvedValue({
      ok: false,
      response: new Response(null, { status: 401 }),
    });
    const res = await POST(req({ label: "Pikachu", icon_emoji: "⚡", link_value: "pokemon" }));
    expect(res.status).toBe(401);
  });

  it("returns 403 when authenticated but not admin", async () => {
    (requireAdmin as jest.Mock).mockResolvedValue({
      ok: false,
      response: new Response(null, { status: 403 }),
    });
    const res = await POST(req({ label: "Pikachu", icon_emoji: "⚡", link_value: "pokemon" }));
    expect(res.status).toBe(403);
  });

  it("returns 400 on an invalid payload", async () => {
    (requireAdmin as jest.Mock).mockResolvedValue(adminAuth);
    const res = await POST(req({ label: "" }));
    expect(res.status).toBe(400);
  });

  it("creates a tile, records an audit log with the exact payload, and returns 201", async () => {
    (requireAdmin as jest.Mock).mockResolvedValue(adminAuth);
    const created = { id: "t1", label: "Pikachu", icon_emoji: "⚡", link_type: "category", link_value: "pokemon" };
    (createHeroTile as jest.Mock).mockResolvedValue(created);

    const res = await POST(req({ label: "Pikachu", icon_emoji: "⚡", link_value: "pokemon" }));

    expect(res.status).toBe(201);
    expect(await res.json()).toEqual(created);
    expect(recordAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: "hero_tile.create", recordId: "t1" })
    );
  });
});
