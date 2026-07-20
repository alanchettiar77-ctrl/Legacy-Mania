/**
 * @jest-environment node
 */
const mockRequireAdmin = jest.fn();
jest.mock("@/lib/supabase/admin-auth", () => ({
  requireAdmin: () => mockRequireAdmin(),
}));

const mockCreateCategory = jest.fn();
jest.mock("@/lib/services/category-service", () => ({
  createCategory: (...args: unknown[]) => mockCreateCategory(...args),
}));

import { NextRequest, NextResponse } from "next/server";
import { POST } from "@/app/api/admin/categories/route";

afterEach(() => jest.clearAllMocks());

const validCategory = { name: "Pokemon", slug: "pokemon", display_order: 0, is_active: true };

function req(body: unknown) {
  return new NextRequest("http://localhost/api/admin/categories", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

describe("POST /api/admin/categories", () => {
  it("passes through requireAdmin's rejection", async () => {
    mockRequireAdmin.mockResolvedValue({ ok: false, response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) });
    const response = await POST(req(validCategory));
    expect(response.status).toBe(403);
    expect(mockCreateCategory).not.toHaveBeenCalled();
  });

  it("400 on invalid input", async () => {
    mockRequireAdmin.mockResolvedValue({ ok: true, userId: "admin-1" });
    const response = await POST(req({ name: "" }));
    expect(response.status).toBe(400);
  });

  it("201 and creates the category", async () => {
    mockRequireAdmin.mockResolvedValue({ ok: true, userId: "admin-1" });
    mockCreateCategory.mockResolvedValue({ id: "c1", ...validCategory });
    const response = await POST(req(validCategory));
    expect(response.status).toBe(201);
  });
});
