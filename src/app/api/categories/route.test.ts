/**
 * @jest-environment node
 */
// src/app/api/categories/route.test.ts

const mockGetFlatCategories = jest.fn();
jest.mock("@/lib/services/catalog-service", () => ({
  getFlatCategories: () => mockGetFlatCategories(),
}));

import { GET } from "@/app/api/categories/route";

describe("GET /api/categories", () => {
  afterEach(() => jest.clearAllMocks());

  it("returns the flat category list", async () => {
    mockGetFlatCategories.mockResolvedValue([{ id: "1", name: "Pokémon" }]);

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toHaveLength(1);
  });

  it("returns a 500 with an error message when the service throws", async () => {
    mockGetFlatCategories.mockRejectedValue(new Error("db down"));

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toBe("db down");
  });
});
