/**
 * @jest-environment node
 */
const mockRequireAdmin = jest.fn();
jest.mock("@/lib/supabase/admin-auth", () => ({
  requireAdmin: () => mockRequireAdmin(),
}));

const mockReorderProducts = jest.fn();
jest.mock("@/lib/services/product-service", () => ({
  reorderProducts: (...args: unknown[]) => mockReorderProducts(...args),
}));

import { NextRequest, NextResponse } from "next/server";
import { POST } from "@/app/api/admin/products/reorder/route";

afterEach(() => jest.clearAllMocks());

function req(body: unknown) {
  return new NextRequest("http://localhost/api/admin/products/reorder", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

describe("POST /api/admin/products/reorder", () => {
  it("passes through requireAdmin's rejection", async () => {
    mockRequireAdmin.mockResolvedValue({
      ok: false,
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    });
    const response = await POST(req({ ids: ["p1", "p2"] }));
    expect(response.status).toBe(403);
    expect(mockReorderProducts).not.toHaveBeenCalled();
  });

  it("400 on an empty ids array", async () => {
    mockRequireAdmin.mockResolvedValue({ ok: true, userId: "admin-1" });
    const response = await POST(req({ ids: [] }));
    expect(response.status).toBe(400);
    expect(mockReorderProducts).not.toHaveBeenCalled();
  });

  it("400 when ids is missing", async () => {
    mockRequireAdmin.mockResolvedValue({ ok: true, userId: "admin-1" });
    const response = await POST(req({}));
    expect(response.status).toBe(400);
  });

  it("reorders and returns success", async () => {
    mockRequireAdmin.mockResolvedValue({ ok: true, userId: "admin-1" });
    mockReorderProducts.mockResolvedValue(undefined);
    const response = await POST(req({ ids: ["p1", "p2"] }));
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(mockReorderProducts).toHaveBeenCalledWith(["p1", "p2"]);
  });
});
