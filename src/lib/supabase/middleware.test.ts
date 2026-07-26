/**
 * @jest-environment node
 */
const mockGetUser = jest.fn();
jest.mock("@supabase/ssr", () => ({
  createServerClient: () => ({ auth: { getUser: mockGetUser } }),
}));

const mockGetCallerRole = jest.fn();
jest.mock("./admin-auth", () => ({
  getCallerRole: (...args: unknown[]) => mockGetCallerRole(...args),
}));

import { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

afterEach(() => jest.clearAllMocks());

describe("updateSession middleware (admin/account route guard)", () => {
  it("redirects an unauthenticated user requesting /admin to /login", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    const response = await updateSession(new NextRequest("http://localhost/admin"));
    expect([307, 308]).toContain(response.status);
    expect(response.headers.get("location")).toBe("http://localhost/login");
  });

  it("redirects an authenticated non-admin (customer) requesting /admin to /account, not through", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "customer-1" } } });
    mockGetCallerRole.mockResolvedValue("customer");
    const response = await updateSession(
      new NextRequest("http://localhost/admin/products")
    );
    expect([307, 308]).toContain(response.status);
    expect(response.headers.get("location")).toBe("http://localhost/account");
  });

  it("does not redirect an authenticated admin requesting /admin", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "admin-1" } } });
    mockGetCallerRole.mockResolvedValue("admin");
    const response = await updateSession(new NextRequest("http://localhost/admin"));
    expect([307, 308]).not.toContain(response.status);
    expect(response.headers.get("location")).toBeNull();
  });

  it("redirects an unauthenticated user requesting /account to /login?redirect=%2Faccount", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    const response = await updateSession(new NextRequest("http://localhost/account"));
    expect([307, 308]).toContain(response.status);
    expect(response.headers.get("location")).toBe(
      "http://localhost/login?redirect=%2Faccount"
    );
  });

  it("does not redirect an authenticated user (any role) requesting /account", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "customer-1" } } });
    const response = await updateSession(
      new NextRequest("http://localhost/account/orders")
    );
    expect([307, 308]).not.toContain(response.status);
    expect(response.headers.get("location")).toBeNull();
  });
});
