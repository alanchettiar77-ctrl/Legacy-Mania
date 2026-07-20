/**
 * @jest-environment node
 */
const mockRequireAdmin = jest.fn();
jest.mock("@/lib/supabase/admin-auth", () => ({
  requireAdmin: () => mockRequireAdmin(),
}));

const mockEditProduct = jest.fn();
jest.mock("@/lib/services/product-service", () => ({
  editProduct: (...args: unknown[]) => mockEditProduct(...args),
}));

import { NextRequest, NextResponse } from "next/server";
import { PATCH } from "@/app/api/admin/products/[id]/route";

afterEach(() => jest.clearAllMocks());

function req(body: unknown) {
  return new NextRequest("http://localhost/api/admin/products/p1", {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}
const params = { params: Promise.resolve({ id: "p1" }) };

describe("PATCH /api/admin/products/[id]", () => {
  it("passes through requireAdmin's rejection", async () => {
    mockRequireAdmin.mockResolvedValue({ ok: false, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) });
    const response = await PATCH(req({ is_active: false }), params);
    expect(response.status).toBe(401);
    expect(mockEditProduct).not.toHaveBeenCalled();
  });

  it("200 and toggles is_active", async () => {
    mockRequireAdmin.mockResolvedValue({ ok: true, userId: "admin-1" });
    const response = await PATCH(req({ is_active: false }), params);
    expect(response.status).toBe(200);
    expect(mockEditProduct).toHaveBeenCalledWith("p1", { is_active: false });
  });
});
