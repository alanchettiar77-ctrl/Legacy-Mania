/**
 * @jest-environment node
 */
// src/app/api/admin/orders/[id]/status/route.test.ts

const mockRequireAdmin = jest.fn();
jest.mock("@/lib/supabase/admin-auth", () => ({
  requireAdmin: () => mockRequireAdmin(),
}));

const mockUpdateStatus = jest.fn();
jest.mock("@/lib/services/order-service", () => {
  const actual = jest.requireActual("@/lib/services/order-service");
  return { ...actual, updateStatus: (...args: unknown[]) => mockUpdateStatus(...args) };
});

import { NextRequest, NextResponse } from "next/server";
import { PATCH } from "@/app/api/admin/orders/[id]/status/route";
import { InvalidStatusTransitionError } from "@/lib/services/order-service";

function makeRequest(body: unknown) {
  return new NextRequest("http://localhost/api/admin/orders/order-1/status", {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

describe("PATCH /api/admin/orders/:id/status", () => {
  afterEach(() => jest.clearAllMocks());

  it("returns the requireAdmin response when not authorized", async () => {
    const forbidden = NextResponse.json({ error: "Forbidden" }, { status: 403 });
    mockRequireAdmin.mockResolvedValue({ ok: false, response: forbidden });

    const response = await PATCH(makeRequest({ status: "confirmed" }), {
      params: Promise.resolve({ id: "order-1" }),
    });

    expect(response.status).toBe(403);
  });

  it("returns 400 for an invalid status value", async () => {
    mockRequireAdmin.mockResolvedValue({ ok: true, userId: "admin-1" });

    const response = await PATCH(makeRequest({ status: "not-a-status" }), {
      params: Promise.resolve({ id: "order-1" }),
    });

    expect(response.status).toBe(400);
  });

  it("returns 409 when the transition is invalid", async () => {
    mockRequireAdmin.mockResolvedValue({ ok: true, userId: "admin-1" });
    mockUpdateStatus.mockRejectedValue(new InvalidStatusTransitionError("Cannot transition from pending to shipped"));

    const response = await PATCH(makeRequest({ status: "shipped" }), {
      params: Promise.resolve({ id: "order-1" }),
    });
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.error).toMatch(/cannot transition/i);
  });

  it("updates the status and returns success", async () => {
    mockRequireAdmin.mockResolvedValue({ ok: true, userId: "admin-1" });
    mockUpdateStatus.mockResolvedValue(undefined);

    const response = await PATCH(makeRequest({ status: "processing" }), {
      params: Promise.resolve({ id: "order-1" }),
    });
    const body = await response.json();

    expect(mockUpdateStatus).toHaveBeenCalledWith("order-1", "processing");
    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
  });
});
