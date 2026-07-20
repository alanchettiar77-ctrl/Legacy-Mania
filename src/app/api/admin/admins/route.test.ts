/**
 * @jest-environment node
 */
const mockGetUser = jest.fn();
jest.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getUser: mockGetUser } }),
}));

const mockGetCallerRole = jest.fn();
jest.mock("@/lib/supabase/admin-auth", () => ({
  getCallerRole: (...args: unknown[]) => mockGetCallerRole(...args),
}));

import { GET } from "@/app/api/admin/admins/route";

afterEach(() => jest.clearAllMocks());

describe("GET /api/admin/admins", () => {
  it("401 when no session", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    const response = await GET();
    expect(response.status).toBe(401);
    expect(mockGetCallerRole).not.toHaveBeenCalled();
  });

  it("403 when caller role resolves to null (fails closed on lookup failure)", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u1" } } });
    mockGetCallerRole.mockResolvedValue(null);
    const response = await GET();
    expect(response.status).toBe(403);
  });

  it("403 when caller is not an admin", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u1" } } });
    mockGetCallerRole.mockResolvedValue("customer");
    const response = await GET();
    expect(response.status).toBe(403);
  });
});
