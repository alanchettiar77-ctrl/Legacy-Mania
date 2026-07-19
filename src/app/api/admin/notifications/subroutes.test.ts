/**
 * @jest-environment node
 *
 * Covers the notification sub-routes: [id] PATCH/DELETE, duplicate, reorder, bulk,
 * display-settings. Shared mocks — each route uses the same rateLimit -> requireAdmin
 * -> validate -> service -> audit pipeline.
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
  duplicateNotification: jest.fn(),
  reorder: jest.fn(),
  bulkAction: jest.fn(),
  getDisplayConfig: jest.fn(),
  updateDisplayConfig: jest.fn(),
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const svc = jest.requireMock("@/lib/services/notification-service");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const audit = jest.requireMock("@/lib/services/audit-service");

import { NextRequest, NextResponse } from "next/server";
import { PATCH as patchById, DELETE as deleteById } from "@/app/api/admin/notifications/[id]/route";
import { POST as duplicate } from "@/app/api/admin/notifications/[id]/duplicate/route";
import { POST as reorderRoute } from "@/app/api/admin/notifications/reorder/route";
import { POST as bulkRoute } from "@/app/api/admin/notifications/bulk/route";
import { GET as getSettings, PATCH as patchSettings } from "@/app/api/admin/notifications/display-settings/route";

const UUID = "123e4567-e89b-12d3-a456-426614174000";
const ctx = { params: Promise.resolve({ id: UUID }) };

function req(method: string, body?: unknown) {
  return new NextRequest("http://localhost/api/admin/notifications/x", {
    method,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}

beforeEach(() => {
  mockCheckRateLimit.mockReturnValue({ allowed: true, remaining: 59, resetAt: Date.now() + 60_000 });
  mockRequireAdmin.mockResolvedValue({ ok: true, userId: "admin-1" });
});
afterEach(() => jest.clearAllMocks());

describe("PATCH /api/admin/notifications/:id", () => {
  it("403 passthrough from requireAdmin", async () => {
    mockRequireAdmin.mockResolvedValue({
      ok: false,
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    });
    const response = await patchById(req("PATCH", { is_active: false }), ctx);
    expect(response.status).toBe(403);
  });

  it("400 on empty patch", async () => {
    const response = await patchById(req("PATCH", {}), ctx);
    expect(response.status).toBe(400);
  });

  it("404 when notification missing", async () => {
    svc.updateNotification.mockResolvedValue(null);
    const response = await patchById(req("PATCH", { is_active: false }), ctx);
    expect(response.status).toBe(404);
  });

  it("200 + audit on success", async () => {
    svc.updateNotification.mockResolvedValue({ id: UUID, is_active: false });
    const response = await patchById(req("PATCH", { is_active: false }), ctx);
    expect(response.status).toBe(200);
    expect(audit.recordAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: "notification.update", recordId: UUID })
    );
  });
});

describe("DELETE /api/admin/notifications/:id", () => {
  it("soft-deletes and audit-logs", async () => {
    svc.deleteNotification.mockResolvedValue(true);
    const response = await deleteById(req("DELETE"), ctx);
    expect(response.status).toBe(200);
    expect(svc.deleteNotification).toHaveBeenCalledWith(UUID, "admin-1");
    expect(audit.recordAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: "notification.delete" })
    );
  });

  it("404 when missing", async () => {
    svc.deleteNotification.mockResolvedValue(false);
    const response = await deleteById(req("DELETE"), ctx);
    expect(response.status).toBe(404);
  });
});

describe("POST /api/admin/notifications/:id/duplicate", () => {
  it("201 + audit on success, 404 when source missing", async () => {
    svc.duplicateNotification.mockResolvedValue({ id: "copy-1" });
    let response = await duplicate(req("POST"), ctx);
    expect(response.status).toBe(201);
    expect(audit.recordAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: "notification.duplicate", recordId: "copy-1" })
    );

    svc.duplicateNotification.mockResolvedValue(null);
    response = await duplicate(req("POST"), ctx);
    expect(response.status).toBe(404);
  });
});

describe("POST /api/admin/notifications/reorder", () => {
  it("400 on invalid ids, 200 + audit on success", async () => {
    let response = await reorderRoute(req("POST", { ids: ["nope"] }));
    expect(response.status).toBe(400);

    svc.reorder.mockResolvedValue(undefined);
    response = await reorderRoute(req("POST", { ids: [UUID] }));
    expect(response.status).toBe(200);
    expect(svc.reorder).toHaveBeenCalledWith([UUID], "admin-1");
    expect(audit.recordAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: "notification.reorder" })
    );
  });
});

describe("POST /api/admin/notifications/bulk", () => {
  it("400 on bad action; 200 + audit for valid bulk", async () => {
    let response = await bulkRoute(req("POST", { ids: [UUID], action: "explode" }));
    expect(response.status).toBe(400);

    svc.bulkAction.mockResolvedValue({ processed: 1 });
    response = await bulkRoute(req("POST", { ids: [UUID], action: "deactivate" }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ processed: 1 });
    expect(audit.recordAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: "notification.bulk_deactivate" })
    );
  });

  it("429 before auth when rate limited", async () => {
    mockCheckRateLimit.mockReturnValue({ allowed: false, remaining: 0, resetAt: Date.now() + 5_000 });
    const response = await bulkRoute(req("POST", { ids: [UUID], action: "delete" }));
    expect(response.status).toBe(429);
    expect(mockRequireAdmin).not.toHaveBeenCalled();
  });
});

describe("display-settings", () => {
  it("GET returns config for admins", async () => {
    svc.getDisplayConfig.mockResolvedValue({ marqueeSpeedSeconds: 30 });
    const response = await getSettings(req("GET"));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ marqueeSpeedSeconds: 30 });
  });

  it("PATCH validates, merges, audit-logs", async () => {
    let response = await patchSettings(req("PATCH", { marqueeSpeedSeconds: 2 }));
    expect(response.status).toBe(400);

    svc.updateDisplayConfig.mockResolvedValue({ marqueeSpeedSeconds: 20 });
    response = await patchSettings(req("PATCH", { marqueeSpeedSeconds: 20 }));
    expect(response.status).toBe(200);
    expect(svc.updateDisplayConfig).toHaveBeenCalledWith({ marqueeSpeedSeconds: 20 }, "admin-1");
    expect(audit.recordAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: "notification.display_settings_update" })
    );
  });
});
