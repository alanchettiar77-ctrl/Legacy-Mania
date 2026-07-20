/**
 * @jest-environment node
 */
const mockGetUser = jest.fn();
const mockUpdateUser = jest.fn();
jest.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getUser: mockGetUser, updateUser: mockUpdateUser } }),
}));

import { NextRequest } from "next/server";
import { POST } from "@/app/api/account/password/route";

afterEach(() => jest.clearAllMocks());

function req(body: unknown) {
  return new NextRequest("http://localhost/api/account/password", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

describe("POST /api/account/password", () => {
  it("401 when not logged in", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    const response = await POST(req({ password: "longenough" }));
    expect(response.status).toBe(401);
    expect(mockUpdateUser).not.toHaveBeenCalled();
  });

  it("400 on a password shorter than 8 characters", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u1" } } });
    const response = await POST(req({ password: "short" }));
    expect(response.status).toBe(400);
    expect(mockUpdateUser).not.toHaveBeenCalled();
  });

  it("200 and updates the password via the server client", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u1" } } });
    mockUpdateUser.mockResolvedValue({ error: null });
    const response = await POST(req({ password: "longenough" }));
    expect(response.status).toBe(200);
    expect(mockUpdateUser).toHaveBeenCalledWith({ password: "longenough" });
  });

  it("500 when Supabase returns an error", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u1" } } });
    mockUpdateUser.mockResolvedValue({ error: { message: "weak password" } });
    const response = await POST(req({ password: "longenough" }));
    expect(response.status).toBe(500);
  });
});
