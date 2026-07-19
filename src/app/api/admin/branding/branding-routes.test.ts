/**
 * @jest-environment node
 *
 * Covers /api/admin/branding (GET/PATCH), /api/admin/categories/order,
 * /api/admin/categories/:id/branding — same pipeline as other admin routes.
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
  getBrandingForAdmin: jest.fn(),
  updateBranding: jest.fn(),
  updateCategoryBranding: jest.fn(),
  reorderCategories: jest.fn(),
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const svc = jest.requireMock("@/lib/services/branding-service");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const audit = jest.requireMock("@/lib/services/audit-service");

import { NextRequest, NextResponse } from "next/server";
import { GET as getBranding, PATCH as patchBranding } from "@/app/api/admin/branding/route";
import { PATCH as patchOrder } from "@/app/api/admin/categories/order/route";
import { PATCH as patchCategory } from "@/app/api/admin/categories/[id]/branding/route";

const UUID = "123e4567-e89b-12d3-a456-426614174000";
const ctx = { params: Promise.resolve({ id: UUID }) };

function req(method: string, body?: unknown) {
  return new NextRequest("http://localhost/api/admin/branding", {
    method,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}

beforeEach(() => {
  mockCheckRateLimit.mockReturnValue({ allowed: true, remaining: 59, resetAt: Date.now() + 60_000 });
  mockRequireAdmin.mockResolvedValue({ ok: true, userId: "admin-1" });
});
afterEach(() => jest.clearAllMocks());

describe("GET /api/admin/branding", () => {
  it("429 before auth when rate limited", async () => {
    mockCheckRateLimit.mockReturnValue({ allowed: false, remaining: 0, resetAt: Date.now() + 5_000 });
    const response = await getBranding(req("GET"));
    expect(response.status).toBe(429);
    expect(mockRequireAdmin).not.toHaveBeenCalled();
  });

  it("403 passthrough; 200 with slots for admins", async () => {
    mockRequireAdmin.mockResolvedValue({
      ok: false,
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    });
    expect((await getBranding(req("GET"))).status).toBe(403);

    mockRequireAdmin.mockResolvedValue({ ok: true, userId: "admin-1" });
    svc.getBrandingForAdmin.mockResolvedValue({ logo_url: "/x.png" });
    const response = await getBranding(req("GET"));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ logo_url: "/x.png" });
  });
});

describe("PATCH /api/admin/branding", () => {
  it("400 on invalid slot url; 200 + audit with old and new values", async () => {
    expect((await patchBranding(req("PATCH", { logo_url: "javascript:x" }))).status).toBe(400);

    svc.getBrandingForAdmin.mockResolvedValue({ logo_url: "/old.png" });
    svc.updateBranding.mockResolvedValue({ logo_url: "/new.png" });
    const response = await patchBranding(req("PATCH", { logo_url: "/new.png" }));
    expect(response.status).toBe(200);
    expect(svc.updateBranding).toHaveBeenCalledWith({ logo_url: "/new.png" }, "admin-1");
    expect(audit.recordAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "branding.update",
        oldValues: { logo_url: "/old.png" },
        newValues: { logo_url: "/new.png" },
      })
    );
  });

  it("accepts clearing a slot with empty string (delete semantics)", async () => {
    svc.getBrandingForAdmin.mockResolvedValue({});
    svc.updateBranding.mockResolvedValue({ logo_url: "" });
    const response = await patchBranding(req("PATCH", { logo_url: "" }));
    expect(response.status).toBe(200);
  });
});

describe("PATCH /api/admin/categories/order", () => {
  it("400 invalid ids; 200 + audit on success", async () => {
    expect((await patchOrder(req("PATCH", { ids: ["nope"] }))).status).toBe(400);

    svc.reorderCategories.mockResolvedValue(undefined);
    const response = await patchOrder(req("PATCH", { ids: [UUID] }));
    expect(response.status).toBe(200);
    expect(svc.reorderCategories).toHaveBeenCalledWith([UUID]);
    expect(audit.recordAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: "category.reorder" })
    );
  });
});

describe("PATCH /api/admin/categories/:id/branding", () => {
  it("400 empty patch; 404 missing; 200 + audit on success", async () => {
    expect((await patchCategory(req("PATCH", {}), ctx)).status).toBe(400);

    svc.updateCategoryBranding.mockResolvedValue(null);
    expect((await patchCategory(req("PATCH", { is_featured: true }), ctx)).status).toBe(404);

    svc.updateCategoryBranding.mockResolvedValue({ id: UUID, is_featured: true });
    const response = await patchCategory(
      req("PATCH", { is_featured: true, appearance: { backgroundColor: "#111" } }),
      ctx
    );
    expect(response.status).toBe(200);
    expect(audit.recordAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: "category.branding_update", recordId: UUID })
    );
  });
});
