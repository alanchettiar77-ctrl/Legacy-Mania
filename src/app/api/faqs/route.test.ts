/**
 * @jest-environment node
 */

const mockOrder = jest.fn();
const mockEq = jest.fn(() => ({ order: mockOrder }));
const mockSelect = jest.fn(() => ({ eq: mockEq }));
const mockFrom = jest.fn(() => ({ select: mockSelect }));

jest.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ from: mockFrom }),
}));

import { GET } from "@/app/api/faqs/route";

describe("GET /api/faqs", () => {
  afterEach(() => jest.clearAllMocks());

  it("returns active faqs ordered by display_order", async () => {
    mockOrder.mockResolvedValue({
      data: [{ id: "1", question: "Q1", answer: "A1", display_order: 0, is_active: true }],
      error: null,
    });

    const response = await GET();
    const body = await response.json();

    expect(mockFrom).toHaveBeenCalledWith("faqs");
    expect(mockEq).toHaveBeenCalledWith("is_active", true);
    expect(mockOrder).toHaveBeenCalledWith("display_order", { ascending: true });
    expect(response.status).toBe(200);
    expect(body).toHaveLength(1);
  });

  it("returns a 500 with an error message when the query fails", async () => {
    mockOrder.mockResolvedValue({ data: null, error: { message: "db down" } });

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toBe("db down");
  });
});
