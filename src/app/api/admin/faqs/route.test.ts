/**
 * @jest-environment node
 */
const mockRequireAdmin = jest.fn();
jest.mock("@/lib/supabase/admin-auth", () => ({
  requireAdmin: () => mockRequireAdmin(),
}));

const originalFetch = global.fetch;

import { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { POST } from "@/app/api/admin/faqs/route";

function makeRequest(body: unknown) {
  return new NextRequest("http://localhost/api/admin/faqs", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

describe("POST /api/admin/faqs", () => {
  afterEach(() => {
    jest.clearAllMocks();
    global.fetch = originalFetch;
  });

  it("returns the requireAdmin response when not authorized", async () => {
    const forbidden = NextResponse.json({ error: "Forbidden" }, { status: 403 });
    mockRequireAdmin.mockResolvedValue({ ok: false, response: forbidden });

    const response = await POST(makeRequest({ question: "Q?", answer: "A" }));

    expect(response.status).toBe(403);
  });

  it("returns 400 when the body fails validation", async () => {
    mockRequireAdmin.mockResolvedValue({ ok: true, userId: "admin-1" });

    const response = await POST(makeRequest({ question: "", answer: "A" }));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBeDefined();
  });

  it("creates a faq with the next display_order when valid", async () => {
    mockRequireAdmin.mockResolvedValue({ ok: true, userId: "admin-1" });
    global.fetch = jest
      .fn()
      // 1st call: fetch max display_order
      .mockResolvedValueOnce({ ok: true, json: async () => [{ display_order: 4 }] })
      // 2nd call: insert
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [{ id: "new-id", question: "Q?", answer: "A", display_order: 5, is_active: true }],
      }) as unknown as typeof fetch;

    const response = await POST(makeRequest({ question: "Q?", answer: "A" }));
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.display_order).toBe(5);
  });

  it("creates a faq with display_order 0 when table is empty", async () => {
    mockRequireAdmin.mockResolvedValue({ ok: true, userId: "admin-1" });
    global.fetch = jest
      .fn()
      // 1st call: fetch max display_order (empty table)
      .mockResolvedValueOnce({ ok: true, json: async () => [] })
      // 2nd call: insert
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [{ id: "new-id", question: "Q?", answer: "A", display_order: 0, is_active: true }],
      }) as unknown as typeof fetch;

    const response = await POST(makeRequest({ question: "Q?", answer: "A" }));
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.display_order).toBe(0);
  });
});
