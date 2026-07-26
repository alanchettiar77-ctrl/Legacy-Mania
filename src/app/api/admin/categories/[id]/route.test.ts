/**
 * @jest-environment node
 */
const mockRequireAdmin = jest.fn();
jest.mock("@/lib/supabase/admin-auth", () => ({
  requireAdmin: () => mockRequireAdmin(),
}));

jest.mock("@/lib/services/category-service", () => ({
  editCategory: jest.fn(),
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const mockService = jest.requireMock("@/lib/services/category-service");

import { NextRequest, NextResponse } from "next/server";
import { PATCH } from "@/app/api/admin/categories/[id]/route";

function makeRequest(method: string, body?: unknown) {
  return new NextRequest("http://localhost/api/admin/categories/test-id", {
    method,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}

const validBody = { name: "Pokemon" };

afterEach(() => jest.clearAllMocks());

describe("PATCH /api/admin/categories/[id]", () => {
  it("returns requireAdmin's rejection response when not authenticated (401)", async () => {
    mockRequireAdmin.mockResolvedValue({
      ok: false,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    });
    const response = await PATCH(makeRequest("PATCH", validBody), {
      params: Promise.resolve({ id: "test-id" }),
    });
    expect(response.status).toBe(401);
    expect(mockService.editCategory).not.toHaveBeenCalled();
  });

  it("returns requireAdmin's rejection response when authenticated but not admin (403)", async () => {
    mockRequireAdmin.mockResolvedValue({
      ok: false,
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    });
    const response = await PATCH(makeRequest("PATCH", validBody), {
      params: Promise.resolve({ id: "test-id" }),
    });
    expect(response.status).toBe(403);
    expect(mockService.editCategory).not.toHaveBeenCalled();
  });

  it("proceeds and returns success when the caller is an admin", async () => {
    mockRequireAdmin.mockResolvedValue({ ok: true, userId: "admin-1" });
    mockService.editCategory.mockResolvedValue({ id: "test-id", name: "Pokemon" });
    const response = await PATCH(makeRequest("PATCH", validBody), {
      params: Promise.resolve({ id: "test-id" }),
    });
    expect(response.status).toBe(200);
    expect(mockService.editCategory).toHaveBeenCalledWith(
      "test-id",
      expect.objectContaining(validBody)
    );
  });
});
