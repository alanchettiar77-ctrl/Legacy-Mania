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
  updateNotification: jest.fn(),
  deleteNotification: jest.fn(),
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const mockService = jest.requireMock("@/lib/services/notification-service");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const mockAudit = jest.requireMock("@/lib/services/audit-service");

import { NextRequest, NextResponse } from "next/server";
import { PATCH, DELETE } from "@/app/api/admin/notifications/[id]/route";

function makeRequest(method: string, body?: unknown) {
  return new NextRequest("http://localhost/api/admin/notifications/test-id", {
    method,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}

beforeEach(() => {
  mockCheckRateLimit.mockReturnValue({ allowed: true });
});
afterEach(() => jest.clearAllMocks());

describe("PATCH /api/admin/notifications/[id]", () => {
  const validBody = { title: "Updated title" };

  it("returns requireAdmin's rejection response when not authenticated (401)", async () => {
    mockRequireAdmin.mockResolvedValue({
      ok: false,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    });
    const response = await PATCH(makeRequest("PATCH", validBody), {
      params: Promise.resolve({ id: "test-id" }),
    });
    expect(response.status).toBe(401);
    expect(mockService.updateNotification).not.toHaveBeenCalled();
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
    expect(mockService.updateNotification).not.toHaveBeenCalled();
  });

  it("proceeds and returns success when the caller is an admin", async () => {
    mockRequireAdmin.mockResolvedValue({ ok: true, userId: "admin-1" });
    mockService.updateNotification.mockResolvedValue({ id: "test-id", title: "Updated title" });
    const response = await PATCH(makeRequest("PATCH", validBody), {
      params: Promise.resolve({ id: "test-id" }),
    });
    expect(response.status).toBe(200);
    expect(mockService.updateNotification).toHaveBeenCalledWith(
      "test-id",
      expect.objectContaining(validBody),
      "admin-1"
    );
    expect(mockAudit.recordAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: "notification.update", recordId: "test-id" })
    );
  });
});

describe("DELETE /api/admin/notifications/[id]", () => {
  it("returns requireAdmin's rejection response when not authenticated (401)", async () => {
    mockRequireAdmin.mockResolvedValue({
      ok: false,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    });
    const response = await DELETE(makeRequest("DELETE"), {
      params: Promise.resolve({ id: "test-id" }),
    });
    expect(response.status).toBe(401);
    expect(mockService.deleteNotification).not.toHaveBeenCalled();
  });

  it("returns requireAdmin's rejection response when authenticated but not admin (403)", async () => {
    mockRequireAdmin.mockResolvedValue({
      ok: false,
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    });
    const response = await DELETE(makeRequest("DELETE"), {
      params: Promise.resolve({ id: "test-id" }),
    });
    expect(response.status).toBe(403);
    expect(mockService.deleteNotification).not.toHaveBeenCalled();
  });

  it("proceeds and returns success when the caller is an admin", async () => {
    mockRequireAdmin.mockResolvedValue({ ok: true, userId: "admin-1" });
    mockService.deleteNotification.mockResolvedValue(true);
    const response = await DELETE(makeRequest("DELETE"), {
      params: Promise.resolve({ id: "test-id" }),
    });
    expect(response.status).toBe(200);
    expect(mockService.deleteNotification).toHaveBeenCalledWith("test-id", "admin-1");
    expect(mockAudit.recordAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: "notification.delete", recordId: "test-id" })
    );
  });
});
