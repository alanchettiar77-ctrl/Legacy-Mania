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
  getDisplayConfig: jest.fn(),
  updateDisplayConfig: jest.fn(),
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const mockService = jest.requireMock("@/lib/services/notification-service");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const mockAudit = jest.requireMock("@/lib/services/audit-service");

import { NextRequest, NextResponse } from "next/server";
import { GET, PATCH } from "@/app/api/admin/notifications/display-settings/route";

function makeRequest(method: string, body?: unknown) {
  return new NextRequest("http://localhost/api/admin/notifications/display-settings", {
    method,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}

beforeEach(() => {
  mockCheckRateLimit.mockReturnValue({ allowed: true });
});
afterEach(() => jest.clearAllMocks());

describe("GET /api/admin/notifications/display-settings", () => {
  it("returns requireAdmin's rejection response when not authenticated (401)", async () => {
    mockRequireAdmin.mockResolvedValue({
      ok: false,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    });
    const response = await GET(makeRequest("GET"));
    expect(response.status).toBe(401);
    expect(mockService.getDisplayConfig).not.toHaveBeenCalled();
  });

  it("returns requireAdmin's rejection response when authenticated but not admin (403)", async () => {
    mockRequireAdmin.mockResolvedValue({
      ok: false,
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    });
    const response = await GET(makeRequest("GET"));
    expect(response.status).toBe(403);
    expect(mockService.getDisplayConfig).not.toHaveBeenCalled();
  });

  it("proceeds and returns config when the caller is an admin", async () => {
    mockRequireAdmin.mockResolvedValue({ ok: true, userId: "admin-1" });
    mockService.getDisplayConfig.mockResolvedValue({ direction: "left" });
    const response = await GET(makeRequest("GET"));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ direction: "left" });
  });
});

describe("PATCH /api/admin/notifications/display-settings", () => {
  const validBody = { direction: "right" };

  it("returns requireAdmin's rejection response when not authenticated (401)", async () => {
    mockRequireAdmin.mockResolvedValue({
      ok: false,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    });
    const response = await PATCH(makeRequest("PATCH", validBody));
    expect(response.status).toBe(401);
    expect(mockService.updateDisplayConfig).not.toHaveBeenCalled();
  });

  it("returns requireAdmin's rejection response when authenticated but not admin (403)", async () => {
    mockRequireAdmin.mockResolvedValue({
      ok: false,
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    });
    const response = await PATCH(makeRequest("PATCH", validBody));
    expect(response.status).toBe(403);
    expect(mockService.updateDisplayConfig).not.toHaveBeenCalled();
  });

  it("proceeds and returns success when the caller is an admin", async () => {
    mockRequireAdmin.mockResolvedValue({ ok: true, userId: "admin-1" });
    mockService.updateDisplayConfig.mockResolvedValue({ direction: "right" });
    const response = await PATCH(makeRequest("PATCH", validBody));
    expect(response.status).toBe(200);
    expect(mockService.updateDisplayConfig).toHaveBeenCalledWith(
      expect.objectContaining(validBody),
      "admin-1"
    );
    expect(mockAudit.recordAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: "notification.display_settings_update" })
    );
  });
});
