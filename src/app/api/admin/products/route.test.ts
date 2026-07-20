/**
 * @jest-environment node
 */
const mockRequireAdmin = jest.fn();
jest.mock("@/lib/supabase/admin-auth", () => ({
  requireAdmin: () => mockRequireAdmin(),
}));

const mockCreateProduct = jest.fn();
jest.mock("@/lib/services/product-service", () => ({
  createProduct: (...args: unknown[]) => mockCreateProduct(...args),
}));

import { NextRequest, NextResponse } from "next/server";
import { POST } from "@/app/api/admin/products/route";

afterEach(() => jest.clearAllMocks());

const validProduct = {
  name: "Charizard",
  slug: "charizard",
  price: 100,
  stock_quantity: 5,
  is_active: true,
  is_featured: false,
  is_new: true,
};

function req(body: unknown) {
  return new NextRequest("http://localhost/api/admin/products", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

describe("POST /api/admin/products", () => {
  it("passes through requireAdmin's rejection", async () => {
    mockRequireAdmin.mockResolvedValue({ ok: false, response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) });
    const response = await POST(req(validProduct));
    expect(response.status).toBe(403);
    expect(mockCreateProduct).not.toHaveBeenCalled();
  });

  it("400 on invalid input", async () => {
    mockRequireAdmin.mockResolvedValue({ ok: true, userId: "admin-1" });
    const response = await POST(req({ ...validProduct, price: -1 }));
    expect(response.status).toBe(400);
    expect(mockCreateProduct).not.toHaveBeenCalled();
  });

  it("201 and creates the product", async () => {
    mockRequireAdmin.mockResolvedValue({ ok: true, userId: "admin-1" });
    mockCreateProduct.mockResolvedValue({ id: "p1" });
    const response = await POST(req(validProduct));
    expect(response.status).toBe(201);
    expect(mockCreateProduct).toHaveBeenCalled();
  });
});
