/**
 * @jest-environment node
 */
// src/app/api/admin/faqs/[id]/route.test.ts

const mockRequireAdmin = jest.fn();
jest.mock("@/lib/supabase/admin-auth", () => ({
  requireAdmin: () => mockRequireAdmin(),
}));

const originalFetch = global.fetch;

import { NextRequest, NextResponse } from "next/server";
import { PATCH, DELETE } from "@/app/api/admin/faqs/[id]/route";

function makeRequest(method: string, body?: unknown) {
  return new NextRequest("http://localhost/api/admin/faqs/faq-1", {
    method,
    body: body ? JSON.stringify(body) : undefined,
  });
}

describe("PATCH /api/admin/faqs/:id", () => {
  afterEach(() => {
    jest.clearAllMocks();
    global.fetch = originalFetch;
  });

  it("returns the requireAdmin response when not authorized", async () => {
    const unauthorized = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    mockRequireAdmin.mockResolvedValue({ ok: false, response: unauthorized });

    const response = await PATCH(makeRequest("PATCH", { is_active: false }), {
      params: Promise.resolve({ id: "faq-1" }),
    });

    expect(response.status).toBe(401);
  });

  it("returns 400 on invalid body", async () => {
    mockRequireAdmin.mockResolvedValue({ ok: true, userId: "admin-1" });

    const response = await PATCH(makeRequest("PATCH", { display_order: -1 }), {
      params: Promise.resolve({ id: "faq-1" }),
    });

    expect(response.status).toBe(400);
  });

  it("updates the faq and returns 200", async () => {
    mockRequireAdmin.mockResolvedValue({ ok: true, userId: "admin-1" });
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => [{ id: "faq-1", question: "Q", answer: "A", display_order: 0, is_active: false }],
    }) as unknown as typeof fetch;

    const response = await PATCH(makeRequest("PATCH", { is_active: false }), {
      params: Promise.resolve({ id: "faq-1" }),
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.is_active).toBe(false);
  });

  it("returns 404 when the faq does not exist", async () => {
    mockRequireAdmin.mockResolvedValue({ ok: true, userId: "admin-1" });
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => [] }) as unknown as typeof fetch;

    const response = await PATCH(makeRequest("PATCH", { is_active: false }), {
      params: Promise.resolve({ id: "missing" }),
    });

    expect(response.status).toBe(404);
  });
});

describe("DELETE /api/admin/faqs/:id", () => {
  afterEach(() => {
    jest.clearAllMocks();
    global.fetch = originalFetch;
  });

  it("returns the requireAdmin response when not authorized", async () => {
    const forbidden = NextResponse.json({ error: "Forbidden" }, { status: 403 });
    mockRequireAdmin.mockResolvedValue({ ok: false, response: forbidden });

    const response = await DELETE(makeRequest("DELETE"), { params: Promise.resolve({ id: "faq-1" }) });

    expect(response.status).toBe(403);
  });

  it("deletes the faq and returns success", async () => {
    mockRequireAdmin.mockResolvedValue({ ok: true, userId: "admin-1" });
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => [{ id: "faq-1" }],
    }) as unknown as typeof fetch;

    const response = await DELETE(makeRequest("DELETE"), { params: Promise.resolve({ id: "faq-1" }) });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
  });
});
