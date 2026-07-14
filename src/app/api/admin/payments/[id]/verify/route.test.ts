/**
 * @jest-environment node
 */
// src/app/api/admin/payments/[id]/verify/route.test.ts

const mockRequireAdmin = jest.fn();
jest.mock("@/lib/supabase/admin-auth", () => ({ requireAdmin: () => mockRequireAdmin() }));

const mockVerifyPayment = jest.fn();
jest.mock("@/lib/services/payment-service", () => ({
  verifyPayment: (...args: unknown[]) => mockVerifyPayment(...args),
}));

import { NextRequest, NextResponse } from "next/server";
import { PATCH } from "@/app/api/admin/payments/[id]/verify/route";

describe("PATCH /api/admin/payments/:id/verify", () => {
  afterEach(() => jest.clearAllMocks());

  it("returns the requireAdmin response when not authorized", async () => {
    mockRequireAdmin.mockResolvedValue({
      ok: false,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    });

    const response = await PATCH(new NextRequest("http://localhost/x", { method: "PATCH" }), {
      params: Promise.resolve({ id: "pay-1" }),
    });

    expect(response.status).toBe(401);
  });

  it("verifies the payment and returns success", async () => {
    mockRequireAdmin.mockResolvedValue({ ok: true, userId: "admin-1" });
    mockVerifyPayment.mockResolvedValue(undefined);

    const response = await PATCH(new NextRequest("http://localhost/x", { method: "PATCH" }), {
      params: Promise.resolve({ id: "pay-1" }),
    });
    const body = await response.json();

    expect(mockVerifyPayment).toHaveBeenCalledWith("pay-1", "admin-1");
    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
  });

  it("returns 500 when verification fails", async () => {
    mockRequireAdmin.mockResolvedValue({ ok: true, userId: "admin-1" });
    mockVerifyPayment.mockRejectedValue(new Error("Payment not found"));

    const response = await PATCH(new NextRequest("http://localhost/x", { method: "PATCH" }), {
      params: Promise.resolve({ id: "pay-1" }),
    });

    expect(response.status).toBe(500);
  });
});
