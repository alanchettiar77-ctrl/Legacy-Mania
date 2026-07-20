/**
 * @jest-environment node
 */
const mockExchangeCodeForSession = jest.fn();
jest.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { exchangeCodeForSession: mockExchangeCodeForSession } }),
}));

import { NextRequest } from "next/server";
import { GET } from "@/app/auth/confirm/route";

afterEach(() => jest.clearAllMocks());

describe("GET /auth/confirm", () => {
  it("exchanges the code and redirects to /reset-password by default", async () => {
    mockExchangeCodeForSession.mockResolvedValue({ error: null });
    const req = new NextRequest("http://localhost/auth/confirm?code=abc123");
    const response = await GET(req);
    expect(mockExchangeCodeForSession).toHaveBeenCalledWith("abc123");
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://localhost/reset-password");
  });

  it("redirects to the safe next param when provided", async () => {
    mockExchangeCodeForSession.mockResolvedValue({ error: null });
    const req = new NextRequest("http://localhost/auth/confirm?code=abc123&next=/reset-password");
    const response = await GET(req);
    expect(response.headers.get("location")).toBe("http://localhost/reset-password");
  });

  it("falls back to /reset-password for an unsafe next param", async () => {
    mockExchangeCodeForSession.mockResolvedValue({ error: null });
    const req = new NextRequest("http://localhost/auth/confirm?code=abc123&next=https://evil.com");
    const response = await GET(req);
    expect(response.headers.get("location")).toBe("http://localhost/reset-password");
  });

  it("still redirects even when no code is present", async () => {
    const req = new NextRequest("http://localhost/auth/confirm");
    const response = await GET(req);
    expect(mockExchangeCodeForSession).not.toHaveBeenCalled();
    expect(response.headers.get("location")).toBe("http://localhost/reset-password");
  });
});
