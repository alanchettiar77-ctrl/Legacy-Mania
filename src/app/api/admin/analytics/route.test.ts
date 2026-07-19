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

const mockRecordAuditLog = jest.fn();
jest.mock("@/lib/services/audit-service", () => ({
  recordAuditLog: (...args: unknown[]) => mockRecordAuditLog(...args),
}));

const mockGetSummary = jest.fn();
jest.mock("@/lib/services/analytics-service", () => ({
  getAnalyticsSummary: () => mockGetSummary(),
}));

import { NextRequest, NextResponse } from "next/server";
import { GET } from "@/app/api/admin/analytics/route";

function makeRequest(ip = "1.2.3.4") {
  return new NextRequest("http://localhost/api/admin/analytics", {
    headers: { "x-forwarded-for": ip },
  });
}

const SUMMARY = {
  totalOrders: 2,
  totalProducts: 5,
  totalUsers: 3,
  totalRevenue: 999,
  ordersByStatus: { pending: 2 },
};

describe("GET /api/admin/analytics", () => {
  beforeEach(() => {
    mockCheckRateLimit.mockReturnValue({ allowed: true, remaining: 29, resetAt: Date.now() + 60_000 });
    mockRecordAuditLog.mockResolvedValue(undefined);
  });
  afterEach(() => jest.clearAllMocks());

  it("returns 429 when rate limited, before auth runs", async () => {
    mockCheckRateLimit.mockReturnValue({ allowed: false, remaining: 0, resetAt: Date.now() + 30_000 });

    const response = await GET(makeRequest());

    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBeDefined();
    expect(mockRequireAdmin).not.toHaveBeenCalled();
  });

  it("returns 401 for anonymous callers and records a denied audit entry", async () => {
    mockRequireAdmin.mockResolvedValue({
      ok: false,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    });

    const response = await GET(makeRequest());

    expect(response.status).toBe(401);
    expect(mockGetSummary).not.toHaveBeenCalled();
    expect(mockRecordAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: "analytics.access_denied", tableName: "analytics" })
    );
  });

  it("returns 403 for non-admin users and records a denied audit entry", async () => {
    mockRequireAdmin.mockResolvedValue({
      ok: false,
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    });

    const response = await GET(makeRequest());

    expect(response.status).toBe(403);
    expect(mockGetSummary).not.toHaveBeenCalled();
    expect(mockRecordAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "analytics.access_denied",
        newValues: expect.objectContaining({ status: 403 }),
      })
    );
  });

  it("returns the summary for admins and records a view audit entry", async () => {
    mockRequireAdmin.mockResolvedValue({ ok: true, userId: "admin-1" });
    mockGetSummary.mockResolvedValue(SUMMARY);

    const response = await GET(makeRequest("9.9.9.9"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual(SUMMARY);
    expect(mockRecordAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "admin-1",
        action: "analytics.view",
        tableName: "analytics",
        newValues: expect.objectContaining({ ip: "9.9.9.9" }),
      })
    );
  });

  it("rate limits by caller ip", async () => {
    mockRequireAdmin.mockResolvedValue({ ok: true, userId: "admin-1" });
    mockGetSummary.mockResolvedValue(SUMMARY);

    await GET(makeRequest("7.7.7.7"));

    expect(mockCheckRateLimit).toHaveBeenCalledWith("analytics:7.7.7.7", 30, 60_000);
  });

  it("returns 500 when the service throws", async () => {
    mockRequireAdmin.mockResolvedValue({ ok: true, userId: "admin-1" });
    mockGetSummary.mockRejectedValue(new Error("boom"));

    const response = await GET(makeRequest());

    expect(response.status).toBe(500);
  });
});
