/**
 * @jest-environment node
 */
// src/app/api/categories/tree/route.test.ts

const mockGetCategoryTree = jest.fn();
jest.mock("@/lib/services/catalog-service", () => ({
  getCategoryTree: () => mockGetCategoryTree(),
}));

import { GET } from "@/app/api/categories/tree/route";

describe("GET /api/categories/tree", () => {
  afterEach(() => jest.clearAllMocks());

  it("returns the nested category tree", async () => {
    mockGetCategoryTree.mockResolvedValue([{ id: "1", name: "Pokémon", children: [] }]);

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body[0].children).toEqual([]);
  });

  it("returns a 500 with an error message when the service throws", async () => {
    mockGetCategoryTree.mockRejectedValue(new Error("db down"));

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toBe("db down");
  });
});
