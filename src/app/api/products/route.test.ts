/**
 * @jest-environment node
 */
const mockOrder = jest.fn();
const mockRange = jest.fn();
const mockEq = jest.fn();
const mockIn = jest.fn();
const mockIlike = jest.fn();
const mockSelect = jest.fn();
const mockFrom = jest.fn();

function makeChainable() {
  const chain: Record<string, jest.Mock> = {
    select: mockSelect,
    eq: mockEq,
    in: mockIn,
    ilike: mockIlike,
    order: mockOrder,
    range: mockRange,
  };
  Object.values(chain).forEach((fn) => fn.mockReturnValue(chain));
  mockRange.mockResolvedValue({ data: [], count: 0, error: null });
  return chain;
}

jest.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ from: (...args: unknown[]) => { mockFrom(...args); return makeChainable(); } }),
}));

jest.mock("@/lib/services/catalog-service", () => ({
  getDescendantCategoryIds: jest.fn(),
}));

import { NextRequest } from "next/server";
import { GET } from "@/app/api/products/route";
import { getDescendantCategoryIds } from "@/lib/services/catalog-service";

afterEach(() => jest.clearAllMocks());

function req(query: string) {
  return new NextRequest(`http://localhost/api/products${query}`);
}

describe("GET /api/products sort handling", () => {
  it("defaults to display_order asc, created_at asc when no sort param is given", async () => {
    await GET(req(""));
    expect(mockOrder).toHaveBeenCalledWith("display_order", { ascending: true });
    expect(mockOrder).toHaveBeenCalledWith("created_at", { ascending: true });
  });

  it("sorts by display_order explicitly", async () => {
    await GET(req("?sort=display_order"));
    expect(mockOrder).toHaveBeenCalledWith("display_order", { ascending: true });
  });

  it("sorts featured first via the featured sort mode", async () => {
    await GET(req("?sort=featured"));
    expect(mockOrder).toHaveBeenCalledWith("is_featured", { ascending: false });
    expect(mockOrder).toHaveBeenCalledWith("display_order", { ascending: true });
  });

  it("sorts oldest first", async () => {
    await GET(req("?sort=oldest"));
    expect(mockOrder).toHaveBeenCalledWith("created_at", { ascending: true });
  });

  it("sorts name descending (Z-A)", async () => {
    await GET(req("?sort=name_desc"));
    expect(mockOrder).toHaveBeenCalledWith("name", { ascending: false });
  });
});

describe("GET /api/products category expansion", () => {
  it("expands a parent category into itself + descendants via .in(), not a bare .eq()", async () => {
    (getDescendantCategoryIds as jest.Mock).mockResolvedValue(["pokemon", "indigo", "orange"]);
    await GET(req("?category=pokemon"));
    expect(getDescendantCategoryIds).toHaveBeenCalledWith("pokemon");
    expect(mockIn).toHaveBeenCalledWith("category_id", ["pokemon", "indigo", "orange"]);
    expect(mockEq).not.toHaveBeenCalledWith("category_id", "pokemon");
  });
});

describe("GET /api/products category expansion — generic hierarchy", () => {
  it("expands a non-card category the same way it expands a card category", async () => {
    (getDescendantCategoryIds as jest.Mock).mockResolvedValue(["t-shirts", "men", "hoodies", "women"]);
    await GET(req("?category=t-shirts"));
    expect(getDescendantCategoryIds).toHaveBeenCalledWith("t-shirts");
    expect(mockIn).toHaveBeenCalledWith("category_id", ["t-shirts", "men", "hoodies", "women"]);
  });
});
