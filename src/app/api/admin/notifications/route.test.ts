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
  listAllNotifications: jest.fn(),
  createNotification: jest.fn(),
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const mockService = jest.requireMock("@/lib/services/notification-service");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const mockAudit = jest.requireMock("@/lib/services/audit-service");

import { NextRequest, NextResponse } from "next/server";
import { GET, POST } from "@/app/api/admin/notifications/route";

function makeRequest(method: string, body?: unknown) {
  return new NextRequest("http://localhost/api/admin/notifications", {
    method,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}

describe("/api/admin/notifications", () => {
  beforeEach(() => {
    mockCheckRateLimit.mockReturnValue({ allowed: true, remaining: 59, resetAt: Date.now() + 60_000 });
    mockRequireAdmin.mockResolvedValue({ ok: true, userId: "admin-1" });
  });
  afterEach(() => jest.clearAllMocks());

  it("GET returns 429 when rate limited", async () => {
    mockCheckRateLimit.mockReturnValue({ allowed: false, remaining: 0, resetAt: Date.now() + 10_000 });
    const response = await GET(makeRequest("GET"));
    expect(response.status).toBe(429);
    expect(mockRequireAdmin).not.toHaveBeenCalled();
  });

  it("GET passes through requireAdmin failure", async () => {
    mockRequireAdmin.mockResolvedValue({
      ok: false,
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    });
    const response = await GET(makeRequest("GET"));
    expect(response.status).toBe(403);
    expect(mockService.listAllNotifications).not.toHaveBeenCalled();
  });

  it("GET returns the notification list for admins", async () => {
    mockService.listAllNotifications.mockResolvedValue([{ id: "n1" }]);
    const response = await GET(makeRequest("GET"));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual([{ id: "n1" }]);
  });

  it("POST rejects invalid body with 400", async () => {
    const response = await POST(makeRequest("POST", { title: "", message: "m" }));
    expect(response.status).toBe(400);
    expect(mockService.createNotification).not.toHaveBeenCalled();
  });

  it("POST creates and audit-logs a valid notification", async () => {
    mockService.createNotification.mockResolvedValue({ id: "n2", title: "t" });
    const response = await POST(makeRequest("POST", { title: "t", message: "🔥 msg" }));
    expect(response.status).toBe(201);
    expect(mockService.createNotification).toHaveBeenCalledWith(
      expect.objectContaining({ title: "t", message: "🔥 msg" }),
      "admin-1"
    );
    expect(mockAudit.recordAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: "notification.create", recordId: "n2" })
    );
  });

  it("POST returns 500 when the service throws", async () => {
    mockService.createNotification.mockRejectedValue(new Error("boom"));
    const response = await POST(makeRequest("POST", { title: "t", message: "m" }));
    expect(response.status).toBe(500);
  });
});
