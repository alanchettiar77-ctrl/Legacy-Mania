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

const mockUpdateBannerById = jest.fn();
const mockDeleteBanner = jest.fn();
jest.mock("@/lib/services/banner-service", () => ({
  updateBannerById: (...args: unknown[]) => mockUpdateBannerById(...args),
  deleteBanner: (...args: unknown[]) => mockDeleteBanner(...args),
}));

import { NextRequest } from "next/server";
import { PATCH, DELETE } from "@/app/api/admin/banners/[id]/route";

const adminOk = { ok: true, userId: "admin-1" };
const params = Promise.resolve({ id: "b1" });

function makePatch(body: unknown) {
  return new NextRequest("http://localhost/api/admin/banners/b1", {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}
function makeDelete() {
  return new NextRequest("http://localhost/api/admin/banners/b1", { method: "DELETE" });
}

describe("PATCH /api/admin/banners/[id]", () => {
  afterEach(() => jest.clearAllMocks());

  it("returns 404 when the banner doesn't exist", async () => {
    mockCheckRateLimit.mockReturnValue({ allowed: true, remaining: 10, resetAt: Date.now() });
    mockRequireAdmin.mockResolvedValue(adminOk);
    mockUpdateBannerById.mockResolvedValue(null);

    const response = await PATCH(makePatch({ is_active: false }), { params });
    expect(response.status).toBe(404);
  });

  it("updates and audit-logs the change", async () => {
    mockCheckRateLimit.mockReturnValue({ allowed: true, remaining: 10, resetAt: Date.now() });
    mockRequireAdmin.mockResolvedValue(adminOk);
    mockUpdateBannerById.mockResolvedValue({ id: "b1", is_active: false });

    const response = await PATCH(makePatch({ is_active: false }), { params });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.is_active).toBe(false);
    expect(mockRecordAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: "banner.update", recordId: "b1" })
    );
  });
});

describe("DELETE /api/admin/banners/[id]", () => {
  afterEach(() => jest.clearAllMocks());

  it("returns 404 when the banner doesn't exist", async () => {
    mockCheckRateLimit.mockReturnValue({ allowed: true, remaining: 10, resetAt: Date.now() });
    mockRequireAdmin.mockResolvedValue(adminOk);
    mockDeleteBanner.mockResolvedValue(false);

    const response = await DELETE(makeDelete(), { params });
    expect(response.status).toBe(404);
  });

  it("soft-deletes and audit-logs", async () => {
    mockCheckRateLimit.mockReturnValue({ allowed: true, remaining: 10, resetAt: Date.now() });
    mockRequireAdmin.mockResolvedValue(adminOk);
    mockDeleteBanner.mockResolvedValue(true);

    const response = await DELETE(makeDelete(), { params });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(mockRecordAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: "banner.delete", recordId: "b1" })
    );
  });
});
