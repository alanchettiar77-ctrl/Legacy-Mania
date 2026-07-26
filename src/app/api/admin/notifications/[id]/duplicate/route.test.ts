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
  duplicateNotification: jest.fn(),
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const mockService = jest.requireMock("@/lib/services/notification-service");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const mockAudit = jest.requireMock("@/lib/services/audit-service");

import { NextRequest, NextResponse } from "next/server";
import { POST } from "@/app/api/admin/notifications/[id]/duplicate/route";

function makeRequest(method: string) {
  return new NextRequest("http://localhost/api/admin/notifications/test-id/duplicate", {
    method,
  });
}

beforeEach(() => {
  mockCheckRateLimit.mockReturnValue({ allowed: true });
});
afterEach(() => jest.clearAllMocks());

describe("POST /api/admin/notifications/[id]/duplicate", () => {
  it("returns requireAdmin's rejection response when not authenticated (401)", async () => {
    mockRequireAdmin.mockResolvedValue({
      ok: false,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    });
    const response = await POST(makeRequest("POST"), {
      params: Promise.resolve({ id: "test-id" }),
    });
    expect(response.status).toBe(401);
    expect(mockService.duplicateNotification).not.toHaveBeenCalled();
  });

  it("returns requireAdmin's rejection response when authenticated but not admin (403)", async () => {
    mockRequireAdmin.mockResolvedValue({
      ok: false,
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    });
    const response = await POST(makeRequest("POST"), {
      params: Promise.resolve({ id: "test-id" }),
    });
    expect(response.status).toBe(403);
    expect(mockService.duplicateNotification).not.toHaveBeenCalled();
  });

  it("proceeds and returns the duplicated notification when the caller is an admin", async () => {
    mockRequireAdmin.mockResolvedValue({ ok: true, userId: "admin-1" });
    mockService.duplicateNotification.mockResolvedValue({ id: "n2", title: "copy" });
    const response = await POST(makeRequest("POST"), {
      params: Promise.resolve({ id: "test-id" }),
    });
    expect(response.status).toBe(201);
    expect(mockService.duplicateNotification).toHaveBeenCalledWith("test-id", "admin-1");
    expect(mockAudit.recordAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: "notification.duplicate", recordId: "n2" })
    );
  });
});
