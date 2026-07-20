const mockInsertProduct = jest.fn();
const mockUpdateProduct = jest.fn();
jest.mock("@/lib/repositories/product-repository", () => ({
  insertProduct: (...args: unknown[]) => mockInsertProduct(...args),
  updateProduct: (...args: unknown[]) => mockUpdateProduct(...args),
}));

import { createProduct, editProduct, setProductActive } from "./product-service";

afterEach(() => jest.clearAllMocks());

const payload = {
  name: "Charizard",
  slug: "charizard",
  description: null,
  price: 100,
  compare_price: null,
  images: [],
  tags: [],
  category_id: null,
  series: null,
  saga: null,
  collection: null,
  stock_quantity: 5,
  sku: null,
  is_active: true,
  is_featured: false,
  is_new: true,
  meta_title: null,
  meta_description: null,
};

it("createProduct delegates to insertProduct", async () => {
  mockInsertProduct.mockResolvedValue({ id: "p1" });
  const result = await createProduct(payload);
  expect(mockInsertProduct).toHaveBeenCalledWith(payload);
  expect(result).toEqual({ id: "p1" });
});

it("editProduct delegates to updateProduct with a partial payload", async () => {
  await editProduct("p1", { price: 150 });
  expect(mockUpdateProduct).toHaveBeenCalledWith("p1", { price: 150 });
});

it("setProductActive updates only is_active", async () => {
  await setProductActive("p1", false);
  expect(mockUpdateProduct).toHaveBeenCalledWith("p1", { is_active: false });
});
