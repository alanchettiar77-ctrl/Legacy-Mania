/**
 * @jest-environment node
 */
const mockRequireAdmin = jest.fn();
jest.mock("@/lib/supabase/admin-auth", () => ({
  requireAdmin: () => mockRequireAdmin(),
}));

const mockCheckRateLimit = jest.fn();
jest.mock("@/lib/rate-limit", () => ({
  checkRateLimit: (...args: unknown[]) => mockCheckRateLimit(...args),
  rateLimitResponse: jest.requireActual("@/lib/rate-limit").rateLimitResponse,
}));

jest.mock("@/lib/services/audit-service", () => ({ recordAuditLog: jest.fn() }));
jest.mock("@/lib/services/branding-service", () => ({
  reorderCategories: jest.fn(),
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const mockService = jest.requireMock("@/lib/services/branding-service");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const mockAudit = jest.requireMock("@/lib/services/audit-service");

import { NextRequest, NextResponse } from "next/server";
import { PATCH } from "@/app/api/admin/categories/order/route";

function makeRequest(method: string, body?: unknown) {
  return new NextRequest("http://localhost/api/admin/categories/order", {
    method,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}

const validBody = { ids: ["11111111-1111-1111-1111-111111111111"] };

beforeEach(() => {
  mockCheckRateLimit.mockReturnValue({ allowed: true });
});
afterEach(() => jest.clearAllMocks());

describe("PATCH /api/admin/categories/order", () => {
  it("returns requireAdmin's rejection response when not authenticated (401)", async () => {
    mockRequireAdmin.mockResolvedValue({
      ok: false,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    });
    const response = await PATCH(makeRequest("PATCH", validBody));
    expect(response.status).toBe(401);
    expect(mockService.reorderCategories).not.toHaveBeenCalled();
  });

  it("returns requireAdmin's rejection response when authenticated but not admin (403)", async () => {
    mockRequireAdmin.mockResolvedValue({
      ok: false,
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    });
    const response = await PATCH(makeRequest("PATCH", validBody));
    expect(response.status).toBe(403);
    expect(mockService.reorderCategories).not.toHaveBeenCalled();
  });

  it("proceeds and returns success when the caller is an admin", async () => {
    mockRequireAdmin.mockResolvedValue({ ok: true, userId: "admin-1" });
    mockService.reorderCategories.mockResolvedValue(undefined);
    const response = await PATCH(makeRequest("PATCH", validBody));
    expect(response.status).toBe(200);
    expect(mockService.reorderCategories).toHaveBeenCalledWith(validBody.ids);
    expect(mockAudit.recordAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: "category.reorder" })
    );
  });
});
