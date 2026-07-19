const mockListActiveCategories = jest.fn();

jest.mock("@/lib/repositories/category-repository", () => ({
  listActiveCategories: () => mockListActiveCategories(),
}));

import { getFlatCategories, getCategoryTree, getBreadcrumb } from "@/lib/services/catalog-service";
import type { Category } from "@/types";

const pokemon: Category = {
  id: "pokemon",
  name: "Pokémon",
  slug: "pokemon",
  description: null,
  image_url: null,
  parent_id: null,
  display_order: 0,
  is_active: true,
  meta_title: null,
  meta_description: null,
  icon_url: null,
  appearance: {},
  is_featured: false,
  show_on_homepage: true,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

const indigoLeague: Category = {
  ...pokemon,
  id: "indigo-league",
  name: "Indigo League",
  slug: "pokemon-indigo-league",
  parent_id: "pokemon",
};

const dbz: Category = {
  ...pokemon,
  id: "dbz",
  name: "Dragon Ball Z",
  slug: "dragon-ball-z",
  parent_id: null,
};

describe("getFlatCategories", () => {
  afterEach(() => jest.clearAllMocks());

  it("returns the repository's category list unchanged", async () => {
    mockListActiveCategories.mockResolvedValue([pokemon, dbz]);
    const result = await getFlatCategories();
    expect(result).toEqual([pokemon, dbz]);
  });
});

describe("getCategoryTree", () => {
  afterEach(() => jest.clearAllMocks());

  it("nests children under their parent and leaves top-level categories as roots", async () => {
    mockListActiveCategories.mockResolvedValue([pokemon, indigoLeague, dbz]);

    const tree = await getCategoryTree();

    expect(tree).toHaveLength(2);
    const pokemonNode = tree.find((node) => node.id === "pokemon");
    expect(pokemonNode?.children).toHaveLength(1);
    expect(pokemonNode?.children?.[0].id).toBe("indigo-league");
    const dbzNode = tree.find((node) => node.id === "dbz");
    expect(dbzNode?.children).toHaveLength(0);
  });
});

describe("getBreadcrumb", () => {
  afterEach(() => jest.clearAllMocks());

  it("returns the ancestor chain from root to the given category, inclusive", async () => {
    mockListActiveCategories.mockResolvedValue([pokemon, indigoLeague, dbz]);

    const breadcrumb = await getBreadcrumb("indigo-league");

    expect(breadcrumb.map((cat) => cat.id)).toEqual(["pokemon", "indigo-league"]);
  });

  it("returns a single-element breadcrumb for a top-level category", async () => {
    mockListActiveCategories.mockResolvedValue([pokemon, indigoLeague, dbz]);

    const breadcrumb = await getBreadcrumb("dbz");

    expect(breadcrumb.map((cat) => cat.id)).toEqual(["dbz"]);
  });

  it("returns an empty array for an unknown category id", async () => {
    mockListActiveCategories.mockResolvedValue([pokemon, indigoLeague, dbz]);

    const breadcrumb = await getBreadcrumb("does-not-exist");

    expect(breadcrumb).toEqual([]);
  });
});
