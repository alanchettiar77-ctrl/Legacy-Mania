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
  updateCategoryBranding: jest.fn(),
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const mockService = jest.requireMock("@/lib/services/branding-service");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const mockAudit = jest.requireMock("@/lib/services/audit-service");

import { NextRequest, NextResponse } from "next/server";
import { PATCH } from "@/app/api/admin/categories/[id]/branding/route";

function makeRequest(method: string, body?: unknown) {
  return new NextRequest("http://localhost/api/admin/categories/test-id/branding", {
    method,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}

const validBody = { is_featured: true };

beforeEach(() => {
  mockCheckRateLimit.mockReturnValue({ allowed: true });
});
afterEach(() => jest.clearAllMocks());

describe("PATCH /api/admin/categories/[id]/branding", () => {
  it("returns requireAdmin's rejection response when not authenticated (401)", async () => {
    mockRequireAdmin.mockResolvedValue({
      ok: false,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    });
    const response = await PATCH(makeRequest("PATCH", validBody), {
      params: Promise.resolve({ id: "test-id" }),
    });
    expect(response.status).toBe(401);
    expect(mockService.updateCategoryBranding).not.toHaveBeenCalled();
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
    expect(mockService.updateCategoryBranding).not.toHaveBeenCalled();
  });

  it("proceeds and returns success when the caller is an admin", async () => {
    mockRequireAdmin.mockResolvedValue({ ok: true, userId: "admin-1" });
    mockService.updateCategoryBranding.mockResolvedValue({ id: "test-id", is_featured: true });
    const response = await PATCH(makeRequest("PATCH", validBody), {
      params: Promise.resolve({ id: "test-id" }),
    });
    expect(response.status).toBe(200);
    expect(mockService.updateCategoryBranding).toHaveBeenCalledWith(
      "test-id",
      expect.objectContaining(validBody)
    );
    expect(mockAudit.recordAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: "category.branding_update", recordId: "test-id" })
    );
  });
});
