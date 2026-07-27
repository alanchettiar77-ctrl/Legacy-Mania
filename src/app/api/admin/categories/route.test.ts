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
  createCategory: jest.fn(),
  CategorySlugConflictError: class CategorySlugConflictError extends Error {},
}));

import { requireAdmin } from "@/lib/supabase/admin-auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { recordAuditLog } from "@/lib/services/audit-service";
import { createCategory, CategorySlugConflictError } from "@/lib/services/category-service";
import { NextRequest } from "next/server";
import { POST } from "./route";

function req(body: unknown) {
  return new NextRequest("http://localhost/api/admin/categories", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

const validBody = { name: "T-Shirts", slug: "t-shirts", display_order: 0, is_active: true };

beforeEach(() => {
  (checkRateLimit as jest.Mock).mockReturnValue({ allowed: true });
  (requireAdmin as jest.Mock).mockResolvedValue({ ok: true, userId: "admin-1" });
});
afterEach(() => jest.clearAllMocks());

describe("POST /api/admin/categories", () => {
  it("returns 429 when rate-limited, before touching auth or the service", async () => {
    (checkRateLimit as jest.Mock).mockReturnValue({ allowed: false, resetAt: Date.now() });
    const res = await POST(req(validBody));
    expect(res.status).toBe(429);
    expect(requireAdmin).not.toHaveBeenCalled();
    expect(createCategory).not.toHaveBeenCalled();
  });

  it("returns 401/403 from requireAdmin before touching the service", async () => {
    (requireAdmin as jest.Mock).mockResolvedValue({ ok: false, response: new Response(null, { status: 403 }) });
    const res = await POST(req(validBody));
    expect(res.status).toBe(403);
    expect(createCategory).not.toHaveBeenCalled();
  });

  it("returns 400 on invalid body before touching the service", async () => {
    const res = await POST(req({ name: "" }));
    expect(res.status).toBe(400);
    expect(createCategory).not.toHaveBeenCalled();
  });

  it("creates and audit-logs on success", async () => {
    (createCategory as jest.Mock).mockResolvedValue({ id: "new-id", ...validBody });
    const res = await POST(req(validBody));
    expect(res.status).toBe(201);
    expect(recordAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "admin-1", action: "category.create", tableName: "categories" })
    );
  });

  it("returns 409 on a slug conflict", async () => {
    (createCategory as jest.Mock).mockRejectedValue(new CategorySlugConflictError("t-shirts"));
    const res = await POST(req(validBody));
    expect(res.status).toBe(409);
    expect(recordAuditLog).not.toHaveBeenCalled();
  });
});
