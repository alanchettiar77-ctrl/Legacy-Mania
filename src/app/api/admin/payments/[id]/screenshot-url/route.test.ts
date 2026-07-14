/**
 * @jest-environment node
 */
// src/app/api/admin/payments/[id]/screenshot-url/route.test.ts

const mockRequireAdmin = jest.fn();
jest.mock("@/lib/supabase/admin-auth", () => ({ requireAdmin: () => mockRequireAdmin() }));

const mockGetPaymentScreenshotUrl = jest.fn();
jest.mock("@/lib/services/payment-service", () => ({
  getPaymentScreenshotUrl: (...args: unknown[]) => mockGetPaymentScreenshotUrl(...args),
}));

import { NextRequest, NextResponse } from "next/server";
import { GET } from "@/app/api/admin/payments/[id]/screenshot-url/route";

describe("GET /api/admin/payments/:id/screenshot-url", () => {
  afterEach(() => jest.clearAllMocks());

  it("returns the requireAdmin response when not authorized", async () => {
    mockRequireAdmin.mockResolvedValue({
      ok: false,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    });

    const response = await GET(new NextRequest("http://localhost/x"), {
      params: Promise.resolve({ id: "pay-1" }),
    });

    expect(response.status).toBe(401);
  });

  it("returns 404 when there is no screenshot", async () => {
    mockRequireAdmin.mockResolvedValue({ ok: true, userId: "admin-1" });
    mockGetPaymentScreenshotUrl.mockResolvedValue(null);

    const response = await GET(new NextRequest("http://localhost/x"), {
      params: Promise.resolve({ id: "pay-1" }),
    });

    expect(response.status).toBe(404);
  });

  it("returns the signed URL when one exists", async () => {
    mockRequireAdmin.mockResolvedValue({ ok: true, userId: "admin-1" });
    mockGetPaymentScreenshotUrl.mockResolvedValue("https://example.com/signed");

    const response = await GET(new NextRequest("http://localhost/x"), {
      params: Promise.resolve({ id: "pay-1" }),
    });
    const body = await response.json();

    expect(body.url).toBe("https://example.com/signed");
  });
});
