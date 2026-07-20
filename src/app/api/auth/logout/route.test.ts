/**
 * @jest-environment node
 */
const mockSignOut = jest.fn();
jest.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { signOut: mockSignOut } }),
}));

import { POST } from "@/app/api/auth/logout/route";

afterEach(() => jest.clearAllMocks());

describe("POST /api/auth/logout", () => {
  it("calls signOut on the server client and returns success", async () => {
    mockSignOut.mockResolvedValue({ error: null });
    const response = await POST();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ success: true });
    expect(mockSignOut).toHaveBeenCalled();
  });
});
