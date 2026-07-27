import { render, screen } from "@testing-library/react";
import CatalogClient from "./catalog-client";
import type { Product, CategoryWithChildren } from "@/types";

const mockPush = jest.fn();
jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
  usePathname: () => "/catalog",
  useSearchParams: () => new URLSearchParams(),
}));

jest.mock("@/components/product/product-card", () => ({
  __esModule: true,
  default: ({ product }: { product: Product }) => <div>{product.name}</div>,
}));

function makeProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: "p1",
    name: "Bulbasaur",
    slug: "bulbasaur",
    description: null,
    price: 10,
    compare_price: null,
    images: [],
    category_id: null,
    series: null,
    saga: null,
    collection: null,
    rarity: null,
    condition: null,
    stock_quantity: 5,
    reserved_quantity: 0,
    display_order: 0,
    sku: null,
    is_active: true,
    is_featured: false,
    is_new: false,
    tags: null,
    meta_title: null,
    meta_description: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  } as Product;
}

function makeCategory(overrides: Partial<CategoryWithChildren> = {}): CategoryWithChildren {
  return {
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
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    children: [],
    ...overrides,
  } as CategoryWithChildren;
}

const page1Products = [makeProduct({ id: "p1", name: "Bulbasaur" })];
const page2Products = [makeProduct({ id: "p25", name: "Charmander" })];

describe("CatalogClient pagination", () => {
  afterEach(() => jest.clearAllMocks());

  it("renders products from the latest initialProducts prop, not a frozen copy from first mount", () => {
    const { rerender } = render(
      <CatalogClient
        initialProducts={page1Products}
        totalCount={56}
        currentPage={1}
        pageSize={24}
        categories={[]}
      />
    );
    expect(screen.getByText("Bulbasaur")).toBeInTheDocument();
    expect(screen.queryByText("Charmander")).not.toBeInTheDocument();

    rerender(
      <CatalogClient
        initialProducts={page2Products}
        totalCount={56}
        currentPage={2}
        pageSize={24}
        categories={[]}
      />
    );

    expect(screen.getByText("Charmander")).toBeInTheDocument();
    expect(screen.queryByText("Bulbasaur")).not.toBeInTheDocument();
  });
});

describe("CatalogClient category sidebar", () => {
  afterEach(() => jest.clearAllMocks());

  it("links a parent category to its /catalog/[slug] page instead of filtering client-side", () => {
    render(
      <CatalogClient
        initialProducts={page1Products}
        totalCount={1}
        categories={[makeCategory({ id: "pokemon", slug: "pokemon", name: "Pokémon" })]}
      />
    );
    const link = screen.getByRole("link", { name: "Pokémon" });
    expect(link).toHaveAttribute("href", "/catalog/pokemon");
  });

  it("links a child category to its own /catalog/[slug] page", () => {
    render(
      <CatalogClient
        initialProducts={page1Products}
        totalCount={1}
        categories={[
          makeCategory({
            id: "pokemon",
            slug: "pokemon",
            name: "Pokémon",
            children: [
              makeCategory({ id: "indigo", slug: "pokemon-indigo-league", name: "Indigo League", parent_id: "pokemon" }),
            ],
          }),
        ]}
      />
    );
    const link = screen.getByRole("link", { name: "Indigo League" });
    expect(link).toHaveAttribute("href", "/catalog/pokemon-indigo-league");
  });
});
