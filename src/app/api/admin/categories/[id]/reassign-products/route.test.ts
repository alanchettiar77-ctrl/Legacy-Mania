/**
 * @jest-environment node
 */
jest.mock("@/lib/supabase/admin-auth", () => ({ requireAdmin: jest.fn() }));
jest.mock("@/lib/rate-limit", () => ({
  checkRateLimit: jest.fn(),
  rateLimitResponse: jest.fn(() => new Response(null, { status: 429 })),
}));
jest.mock("@/lib/services/audit-service", () => ({ recordAuditLog: jest.fn() }));
jest.mock("@/lib/services/category-service", () => ({
  reassignProducts: jest.fn(),
}));

import { requireAdmin } from "@/lib/supabase/admin-auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { recordAuditLog } from "@/lib/services/audit-service";
import { reassignProducts } from "@/lib/services/category-service";
import { NextRequest } from "next/server";
import { POST } from "./route";

function makeRequest(body?: unknown) {
  return new NextRequest("http://localhost/api/admin/categories/test-id/reassign-products", {
    method: "POST",
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}

const params = { params: Promise.resolve({ id: "test-id" }) };
const validBody = { toCategoryId: "22222222-2222-2222-2222-222222222222" };

beforeEach(() => {
  (checkRateLimit as jest.Mock).mockReturnValue({ allowed: true });
  (requireAdmin as jest.Mock).mockResolvedValue({ ok: true, userId: "admin-1" });
});
afterEach(() => jest.clearAllMocks());

describe("POST /api/admin/categories/[id]/reassign-products", () => {
  it("returns 429 when rate-limited, before touching auth or the service", async () => {
    (checkRateLimit as jest.Mock).mockReturnValue({ allowed: false, resetAt: Date.now() });
    const res = await POST(makeRequest(validBody), params);
    expect(res.status).toBe(429);
    expect(requireAdmin).not.toHaveBeenCalled();
    expect(reassignProducts).not.toHaveBeenCalled();
  });

  it("returns 401 from requireAdmin before touching the service", async () => {
    (requireAdmin as jest.Mock).mockResolvedValue({ ok: false, response: new Response(null, { status: 401 }) });
    const res = await POST(makeRequest(validBody), params);
    expect(res.status).toBe(401);
    expect(reassignProducts).not.toHaveBeenCalled();
  });

  it("returns 403 from requireAdmin before touching the service", async () => {
    (requireAdmin as jest.Mock).mockResolvedValue({ ok: false, response: new Response(null, { status: 403 }) });
    const res = await POST(makeRequest(validBody), params);
    expect(res.status).toBe(403);
    expect(reassignProducts).not.toHaveBeenCalled();
  });

  it("returns 400 when toCategoryId is missing or invalid", async () => {
    const res = await POST(makeRequest({}), params);
    expect(res.status).toBe(400);
    expect(reassignProducts).not.toHaveBeenCalled();
  });

  it("reassigns products and audit-logs on success", async () => {
    (reassignProducts as jest.Mock).mockResolvedValue(3);
    const res = await POST(makeRequest(validBody), params);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ success: true, movedCount: 3 });
    expect(reassignProducts).toHaveBeenCalledWith("test-id", validBody.toCategoryId);
    expect(recordAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "admin-1",
        action: "category.reassign_products",
        tableName: "categories",
        recordId: "test-id",
      })
    );
  });

  it("returns 500 when the service throws", async () => {
    (reassignProducts as jest.Mock).mockRejectedValue(new Error("boom"));
    const res = await POST(makeRequest(validBody), params);
    expect(res.status).toBe(500);
    expect(recordAuditLog).not.toHaveBeenCalled();
  });
});
