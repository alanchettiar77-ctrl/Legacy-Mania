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
import { updateHeroTileById, deleteHeroTile } from "@/lib/services/hero-tile-service";
import { PATCH, DELETE } from "./route";

const adminAuth = { ok: true as const, userId: "admin-1" };
const params = Promise.resolve({ id: "t1" });

function patchReq(body: unknown) {
  return new NextRequest("http://localhost/api/admin/hero-tiles/t1", {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}
function deleteReq() {
  return new NextRequest("http://localhost/api/admin/hero-tiles/t1", { method: "DELETE" });
}

describe("PATCH /api/admin/hero-tiles/:id", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns 401 when not authenticated", async () => {
    (requireAdmin as jest.Mock).mockResolvedValue({ ok: false, response: new Response(null, { status: 401 }) });
    const res = await PATCH(patchReq({ is_active: false }), { params });
    expect(res.status).toBe(401);
  });

  it("returns 404 when the tile does not exist", async () => {
    (requireAdmin as jest.Mock).mockResolvedValue(adminAuth);
    (updateHeroTileById as jest.Mock).mockResolvedValue(null);
    const res = await PATCH(patchReq({ is_active: false }), { params });
    expect(res.status).toBe(404);
  });

  it("updates the tile, records the audit log, and returns 200", async () => {
    (requireAdmin as jest.Mock).mockResolvedValue(adminAuth);
    (updateHeroTileById as jest.Mock).mockResolvedValue({ id: "t1", is_active: false });

    const res = await PATCH(patchReq({ is_active: false }), { params });

    expect(res.status).toBe(200);
    expect(recordAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: "hero_tile.update", recordId: "t1" })
    );
  });
});

describe("DELETE /api/admin/hero-tiles/:id", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns 401 when not authenticated", async () => {
    (requireAdmin as jest.Mock).mockResolvedValue({ ok: false, response: new Response(null, { status: 401 }) });
    const res = await DELETE(deleteReq(), { params });
    expect(res.status).toBe(401);
  });

  it("returns 404 when the tile does not exist", async () => {
    (requireAdmin as jest.Mock).mockResolvedValue(adminAuth);
    (deleteHeroTile as jest.Mock).mockResolvedValue(false);
    const res = await DELETE(deleteReq(), { params });
    expect(res.status).toBe(404);
  });

  it("soft-deletes the tile and records the audit log", async () => {
    (requireAdmin as jest.Mock).mockResolvedValue(adminAuth);
    (deleteHeroTile as jest.Mock).mockResolvedValue(true);

    const res = await DELETE(deleteReq(), { params });

    expect(res.status).toBe(200);
    expect(recordAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: "hero_tile.delete", recordId: "t1" })
    );
  });
});
