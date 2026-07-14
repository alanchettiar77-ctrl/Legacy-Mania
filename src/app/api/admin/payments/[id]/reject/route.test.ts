/**
 * @jest-environment node
 */
// src/app/api/admin/payments/[id]/reject/route.test.ts

const mockRequireAdmin = jest.fn();
jest.mock("@/lib/supabase/admin-auth", () => ({ requireAdmin: () => mockRequireAdmin() }));

const mockRejectPayment = jest.fn();
jest.mock("@/lib/services/payment-service", () => ({
  rejectPayment: (...args: unknown[]) => mockRejectPayment(...args),
}));

import { NextRequest, NextResponse } from "next/server";
import { PATCH } from "@/app/api/admin/payments/[id]/reject/route";

describe("PATCH /api/admin/payments/:id/reject", () => {
  afterEach(() => jest.clearAllMocks());

  it("returns the requireAdmin response when not authorized", async () => {
    mockRequireAdmin.mockResolvedValue({
      ok: false,
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    });

    const response = await PATCH(new NextRequest("http://localhost/x", { method: "PATCH" }), {
      params: Promise.resolve({ id: "pay-1" }),
    });

    expect(response.status).toBe(403);
  });

  it("rejects the payment and returns success", async () => {
    mockRequireAdmin.mockResolvedValue({ ok: true, userId: "admin-1" });
    mockRejectPayment.mockResolvedValue(undefined);

    const response = await PATCH(new NextRequest("http://localhost/x", { method: "PATCH" }), {
      params: Promise.resolve({ id: "pay-1" }),
    });
    const body = await response.json();

    expect(mockRejectPayment).toHaveBeenCalledWith("pay-1", "admin-1");
    expect(body.success).toBe(true);
  });
});
