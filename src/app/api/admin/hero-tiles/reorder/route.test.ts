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
import { reorder } from "@/lib/services/hero-tile-service";
import { POST } from "./route";

const adminAuth = { ok: true as const, userId: "admin-1" };
const VALID_ID = "11111111-1111-1111-1111-111111111111";

function req(body: unknown) {
  return new NextRequest("http://localhost/api/admin/hero-tiles/reorder", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

describe("POST /api/admin/hero-tiles/reorder", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns 401 when not authenticated", async () => {
    (requireAdmin as jest.Mock).mockResolvedValue({ ok: false, response: new Response(null, { status: 401 }) });
    const res = await POST(req({ ids: [VALID_ID] }));
    expect(res.status).toBe(401);
  });

  it("returns 400 when ids is empty", async () => {
    (requireAdmin as jest.Mock).mockResolvedValue(adminAuth);
    const res = await POST(req({ ids: [] }));
    expect(res.status).toBe(400);
  });

  it("reorders and returns success", async () => {
    (requireAdmin as jest.Mock).mockResolvedValue(adminAuth);
    const res = await POST(req({ ids: [VALID_ID] }));
    expect(res.status).toBe(200);
    expect(reorder).toHaveBeenCalledWith([VALID_ID], "admin-1");
  });
});
