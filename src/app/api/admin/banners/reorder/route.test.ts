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

const mockReorder = jest.fn();
jest.mock("@/lib/services/banner-service", () => ({
  reorder: (...args: unknown[]) => mockReorder(...args),
}));

import { NextRequest } from "next/server";
import { POST } from "@/app/api/admin/banners/reorder/route";

const adminOk = { ok: true, userId: "admin-1" };

function makeRequest(body: unknown) {
  return new NextRequest("http://localhost/api/admin/banners/reorder", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

describe("POST /api/admin/banners/reorder", () => {
  afterEach(() => jest.clearAllMocks());

  it("returns 400 for an empty ids array", async () => {
    mockCheckRateLimit.mockReturnValue({ allowed: true, remaining: 10, resetAt: Date.now() });
    mockRequireAdmin.mockResolvedValue(adminOk);

    const response = await POST(makeRequest({ ids: [] }));
    expect(response.status).toBe(400);
  });

  it("reorders and audit-logs the new order", async () => {
    mockCheckRateLimit.mockReturnValue({ allowed: true, remaining: 10, resetAt: Date.now() });
    mockRequireAdmin.mockResolvedValue(adminOk);
    mockReorder.mockResolvedValue(undefined);

    const ids = ["550e8400-e29b-41d4-a716-446655440000"];
    const response = await POST(makeRequest({ ids }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(mockReorder).toHaveBeenCalledWith(ids, "admin-1");
    expect(mockRecordAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: "banner.reorder", newValues: { ids } })
    );
  });
});
