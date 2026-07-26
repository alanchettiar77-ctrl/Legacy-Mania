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
jest.mock("@/lib/services/notification-service", () => ({
  bulkAction: jest.fn(),
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const mockService = jest.requireMock("@/lib/services/notification-service");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const mockAudit = jest.requireMock("@/lib/services/audit-service");

import { NextRequest, NextResponse } from "next/server";
import { POST } from "@/app/api/admin/notifications/bulk/route";

function makeRequest(method: string, body?: unknown) {
  return new NextRequest("http://localhost/api/admin/notifications/bulk", {
    method,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}

const validBody = { ids: ["11111111-1111-1111-1111-111111111111"], action: "activate" };

beforeEach(() => {
  mockCheckRateLimit.mockReturnValue({ allowed: true });
});
afterEach(() => jest.clearAllMocks());

describe("POST /api/admin/notifications/bulk", () => {
  it("returns requireAdmin's rejection response when not authenticated (401)", async () => {
    mockRequireAdmin.mockResolvedValue({
      ok: false,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    });
    const response = await POST(makeRequest("POST", validBody));
    expect(response.status).toBe(401);
    expect(mockService.bulkAction).not.toHaveBeenCalled();
  });

  it("returns requireAdmin's rejection response when authenticated but not admin (403)", async () => {
    mockRequireAdmin.mockResolvedValue({
      ok: false,
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    });
    const response = await POST(makeRequest("POST", validBody));
    expect(response.status).toBe(403);
    expect(mockService.bulkAction).not.toHaveBeenCalled();
  });

  it("proceeds and returns success when the caller is an admin", async () => {
    mockRequireAdmin.mockResolvedValue({ ok: true, userId: "admin-1" });
    mockService.bulkAction.mockResolvedValue({ processed: 1 });
    const response = await POST(makeRequest("POST", validBody));
    expect(response.status).toBe(200);
    expect(mockService.bulkAction).toHaveBeenCalledWith(
      validBody.ids,
      validBody.action,
      "admin-1"
    );
    expect(mockAudit.recordAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: "notification.bulk_activate" })
    );
  });
});
