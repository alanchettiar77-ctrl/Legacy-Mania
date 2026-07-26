import { render, screen } from "@testing-library/react";
import CatalogClient from "./catalog-client";
import type { Product } from "@/types";

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
        searchParams={{}}
      />
    );
    expect(screen.getByText("Bulbasaur")).toBeInTheDocument();
    expect(screen.queryByText("Charmander")).not.toBeInTheDocument();

    // Simulates the server re-rendering CatalogPage with page=2 data after
    // a client-side navigation. The component instance is NOT remounted,
    // so this must be a prop update, not a fresh mount.
    rerender(
      <CatalogClient
        initialProducts={page2Products}
        totalCount={56}
        currentPage={2}
        pageSize={24}
        categories={[]}
        searchParams={{ page: "2" }}
      />
    );

    expect(screen.getByText("Charmander")).toBeInTheDocument();
    expect(screen.queryByText("Bulbasaur")).not.toBeInTheDocument();
  });
});
