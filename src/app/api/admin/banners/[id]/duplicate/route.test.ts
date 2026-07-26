/**
 * @jest-environment node
 */
const mockCheckRateLimit = jest.fn();
jest.mock("@/lib/rate-limit", () => {
  const actual = jest.requireActual("@/lib/rate-limit");
  return { ...actual, checkRateLimit: (...args: unknown[]) => mockCheckRateLimit(...args) };
});

const mockRequireAdmin = jest.fn();
jest.mock("@/lib/supabase/admin-auth", () => ({ requireAdmin: () => mockRequireAdmin() }));

const mockRecordAuditLog = jest.fn();
jest.mock("@/lib/services/audit-service", () => ({
  recordAuditLog: (...args: unknown[]) => mockRecordAuditLog(...args),
}));

const mockDuplicateBanner = jest.fn();
jest.mock("@/lib/services/banner-service", () => ({
  duplicateBanner: (...args: unknown[]) => mockDuplicateBanner(...args),
}));

import { NextRequest } from "next/server";
import { POST } from "@/app/api/admin/banners/[id]/duplicate/route";

const adminOk = { ok: true, userId: "admin-1" };
const params = Promise.resolve({ id: "b1" });

function makeRequest() {
  return new NextRequest("http://localhost/api/admin/banners/b1/duplicate", { method: "POST" });
}

describe("POST /api/admin/banners/[id]/duplicate", () => {
  afterEach(() => jest.clearAllMocks());

  it("returns 404 when the source banner doesn't exist", async () => {
    mockCheckRateLimit.mockReturnValue({ allowed: true, remaining: 10, resetAt: Date.now() });
    mockRequireAdmin.mockResolvedValue(adminOk);
    mockDuplicateBanner.mockResolvedValue(null);

    const response = await POST(makeRequest(), { params });
    expect(response.status).toBe(404);
  });

  it("duplicates and audit-logs with the source id", async () => {
    mockCheckRateLimit.mockReturnValue({ allowed: true, remaining: 10, resetAt: Date.now() });
    mockRequireAdmin.mockResolvedValue(adminOk);
    mockDuplicateBanner.mockResolvedValue({ id: "b2", title: "Sale (Copy)" });

    const response = await POST(makeRequest(), { params });
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.id).toBe("b2");
    expect(mockRecordAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: "banner.duplicate", recordId: "b2", oldValues: { sourceId: "b1" } })
    );
  });
});
