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
  editCategory: jest.fn(),
  deleteCategory: jest.fn(),
  CategorySlugConflictError: class CategorySlugConflictError extends Error {},
  CategoryCycleError: class CategoryCycleError extends Error {},
  CategoryHasChildrenError: class CategoryHasChildrenError extends Error {
    constructor() {
      super("This category has subcategories — reassign or delete them first");
    }
  },
  CategoryHasProductsError: class CategoryHasProductsError extends Error {
    constructor() {
      super("This category has products — reassign them first");
    }
  },
  CategoryInvalidReassignTargetError: class CategoryInvalidReassignTargetError extends Error {
    constructor(message: string) {
      super(message);
    }
  },
}));

import { requireAdmin } from "@/lib/supabase/admin-auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { recordAuditLog } from "@/lib/services/audit-service";
import {
  editCategory,
  deleteCategory,
  CategorySlugConflictError,
  CategoryCycleError,
  CategoryHasChildrenError,
  CategoryHasProductsError,
  CategoryInvalidReassignTargetError,
} from "@/lib/services/category-service";
import { NextRequest } from "next/server";
import { PATCH, DELETE } from "./route";

function makeRequest(method: string, body?: unknown) {
  return new NextRequest("http://localhost/api/admin/categories/test-id", {
    method,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}

const params = { params: Promise.resolve({ id: "test-id" }) };

const validBody = { name: "Pokemon" };

beforeEach(() => {
  (checkRateLimit as jest.Mock).mockReturnValue({ allowed: true });
  (requireAdmin as jest.Mock).mockResolvedValue({ ok: true, userId: "admin-1" });
});
afterEach(() => jest.clearAllMocks());

describe("PATCH /api/admin/categories/[id]", () => {
  it("returns 429 when rate-limited, before touching auth or the service", async () => {
    (checkRateLimit as jest.Mock).mockReturnValue({ allowed: false, resetAt: Date.now() });
    const res = await PATCH(makeRequest("PATCH", validBody), params);
    expect(res.status).toBe(429);
    expect(requireAdmin).not.toHaveBeenCalled();
    expect(editCategory).not.toHaveBeenCalled();
  });

  it("returns 401 from requireAdmin before touching the service", async () => {
    (requireAdmin as jest.Mock).mockResolvedValue({ ok: false, response: new Response(null, { status: 401 }) });
    const res = await PATCH(makeRequest("PATCH", validBody), params);
    expect(res.status).toBe(401);
    expect(editCategory).not.toHaveBeenCalled();
  });

  it("returns 403 from requireAdmin before touching the service", async () => {
    (requireAdmin as jest.Mock).mockResolvedValue({ ok: false, response: new Response(null, { status: 403 }) });
    const res = await PATCH(makeRequest("PATCH", validBody), params);
    expect(res.status).toBe(403);
    expect(editCategory).not.toHaveBeenCalled();
  });

  it("returns 400 on invalid body before touching the service", async () => {
    const res = await PATCH(makeRequest("PATCH", { slug: "INVALID SLUG" }), params);
    expect(res.status).toBe(400);
    expect(editCategory).not.toHaveBeenCalled();
  });

  it("proceeds and audit-logs category.update when the caller is an admin", async () => {
    (editCategory as jest.Mock).mockResolvedValue({ id: "test-id", name: "Pokemon" });
    const res = await PATCH(makeRequest("PATCH", validBody), params);
    expect(res.status).toBe(200);
    expect(editCategory).toHaveBeenCalledWith("test-id", expect.objectContaining(validBody));
    expect(recordAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "admin-1", action: "category.update", tableName: "categories", recordId: "test-id" })
    );
  });

  it("returns 409 on CategoryCycleError", async () => {
    (editCategory as jest.Mock).mockRejectedValue(new CategoryCycleError());
    const res = await PATCH(makeRequest("PATCH", validBody), params);
    expect(res.status).toBe(409);
    expect(recordAuditLog).not.toHaveBeenCalled();
  });

  it("returns 409 on CategorySlugConflictError", async () => {
    (editCategory as jest.Mock).mockRejectedValue(new CategorySlugConflictError("pokemon"));
    const res = await PATCH(makeRequest("PATCH", validBody), params);
    expect(res.status).toBe(409);
    expect(recordAuditLog).not.toHaveBeenCalled();
  });
});

describe("DELETE /api/admin/categories/[id]", () => {
  it("returns 429 when rate-limited, before touching auth or the service", async () => {
    (checkRateLimit as jest.Mock).mockReturnValue({ allowed: false, resetAt: Date.now() });
    const res = await DELETE(makeRequest("DELETE", {}), params);
    expect(res.status).toBe(429);
    expect(requireAdmin).not.toHaveBeenCalled();
    expect(deleteCategory).not.toHaveBeenCalled();
  });

  it("returns 401 from requireAdmin before touching the service", async () => {
    (requireAdmin as jest.Mock).mockResolvedValue({ ok: false, response: new Response(null, { status: 401 }) });
    const res = await DELETE(makeRequest("DELETE", {}), params);
    expect(res.status).toBe(401);
    expect(deleteCategory).not.toHaveBeenCalled();
  });

  it("returns 403 from requireAdmin before touching the service", async () => {
    (requireAdmin as jest.Mock).mockResolvedValue({ ok: false, response: new Response(null, { status: 403 }) });
    const res = await DELETE(makeRequest("DELETE", {}), params);
    expect(res.status).toBe(403);
    expect(deleteCategory).not.toHaveBeenCalled();
  });

  it("returns 400 on invalid body before touching the service", async () => {
    const res = await DELETE(makeRequest("DELETE", { reassignChildrenTo: "not-a-uuid" }), params);
    expect(res.status).toBe(400);
    expect(deleteCategory).not.toHaveBeenCalled();
  });

  it("returns 404 when the service reports the category was not found", async () => {
    (deleteCategory as jest.Mock).mockRejectedValue(new Error("Category not found"));
    const res = await DELETE(makeRequest("DELETE", {}), params);
    expect(res.status).toBe(404);
  });

  it("returns 409 naming the needed reassignment on CategoryHasChildrenError", async () => {
    (deleteCategory as jest.Mock).mockRejectedValue(new CategoryHasChildrenError());
    const res = await DELETE(makeRequest("DELETE", {}), params);
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toMatch(/subcategories/i);
    expect(recordAuditLog).not.toHaveBeenCalled();
  });

  it("returns 409 naming the needed reassignment on CategoryHasProductsError", async () => {
    (deleteCategory as jest.Mock).mockRejectedValue(new CategoryHasProductsError());
    const res = await DELETE(makeRequest("DELETE", {}), params);
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toMatch(/products/i);
    expect(recordAuditLog).not.toHaveBeenCalled();
  });

  it("returns 409 on CategoryInvalidReassignTargetError", async () => {
    (deleteCategory as jest.Mock).mockRejectedValue(
      new CategoryInvalidReassignTargetError(
        "reassignChildrenTo must be an existing category that is not this category or one of its descendants"
      )
    );
    const res = await DELETE(makeRequest("DELETE", { reassignChildrenTo: "11111111-1111-1111-1111-111111111111" }), params);
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toMatch(/reassignChildrenTo/);
    expect(recordAuditLog).not.toHaveBeenCalled();
  });

  it("returns 200 and audit-logs category.delete on success", async () => {
    (deleteCategory as jest.Mock).mockResolvedValue(undefined);
    const res = await DELETE(makeRequest("DELETE", {}), params);
    expect(res.status).toBe(200);
    expect(recordAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "admin-1", action: "category.delete", tableName: "categories", recordId: "test-id" })
    );
  });
});
