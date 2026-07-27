jest.mock("@/lib/repositories/category-repository", () => ({
  insertCategory: jest.fn(),
  updateCategoryBranding: jest.fn(),
  getCategoryBySlug: jest.fn(),
  getCategoryById: jest.fn(),
}));
jest.mock("@/lib/services/catalog-service", () => ({
  getDescendantCategoryIds: jest.fn(),
}));

import {
  createCategory,
  editCategory,
  CategorySlugConflictError,
  CategoryCycleError,
} from "./category-service";
import {
  insertCategory,
  updateCategoryBranding,
  getCategoryBySlug,
  getCategoryById,
} from "@/lib/repositories/category-repository";
import { getDescendantCategoryIds } from "@/lib/services/catalog-service";

afterEach(() => jest.clearAllMocks());

describe("createCategory", () => {
  it("creates when the slug is free", async () => {
    (getCategoryBySlug as jest.Mock).mockResolvedValue(null);
    (insertCategory as jest.Mock).mockResolvedValue({ id: "new", slug: "t-shirts" });
    await expect(
      createCategory({ name: "T-Shirts", slug: "t-shirts", description: null, parent_id: null, display_order: 0, is_active: true })
    ).resolves.toEqual({ id: "new", slug: "t-shirts" });
  });

  it("throws CategorySlugConflictError when the slug is taken", async () => {
    (getCategoryBySlug as jest.Mock).mockResolvedValue({ id: "existing", slug: "t-shirts" });
    await expect(
      createCategory({ name: "T-Shirts", slug: "t-shirts", description: null, parent_id: null, display_order: 0, is_active: true })
    ).rejects.toThrow(CategorySlugConflictError);
    expect(insertCategory).not.toHaveBeenCalled();
  });
});

describe("editCategory", () => {
  it("updates when no slug/parent conflict exists", async () => {
    (getCategoryById as jest.Mock).mockResolvedValue({ id: "cat-1", slug: "old-slug" });
    (getCategoryBySlug as jest.Mock).mockResolvedValue(null);
    (updateCategoryBranding as jest.Mock).mockResolvedValue({ id: "cat-1", name: "Renamed" });
    await expect(editCategory("cat-1", { name: "Renamed" })).resolves.toEqual({ id: "cat-1", name: "Renamed" });
  });

  it("allows keeping your own current slug unchanged", async () => {
    (getCategoryById as jest.Mock).mockResolvedValue({ id: "cat-1", slug: "kanto" });
    (getCategoryBySlug as jest.Mock).mockResolvedValue({ id: "cat-1", slug: "kanto" });
    (updateCategoryBranding as jest.Mock).mockResolvedValue({ id: "cat-1", slug: "kanto" });
    await expect(editCategory("cat-1", { slug: "kanto" })).resolves.toEqual({ id: "cat-1", slug: "kanto" });
  });

  it("throws CategorySlugConflictError when renaming to another category's slug", async () => {
    (getCategoryById as jest.Mock).mockResolvedValue({ id: "cat-1", slug: "old-slug" });
    (getCategoryBySlug as jest.Mock).mockResolvedValue({ id: "cat-2", slug: "kanto" });
    await expect(editCategory("cat-1", { slug: "kanto" })).rejects.toThrow(CategorySlugConflictError);
    expect(updateCategoryBranding).not.toHaveBeenCalled();
  });

  it("throws CategoryCycleError when setting parent_id to itself", async () => {
    (getCategoryById as jest.Mock).mockResolvedValue({ id: "cat-1", slug: "kanto" });
    await expect(editCategory("cat-1", { parent_id: "cat-1" })).rejects.toThrow(CategoryCycleError);
    expect(updateCategoryBranding).not.toHaveBeenCalled();
  });

  it("throws CategoryCycleError when setting parent_id to one of its own descendants", async () => {
    (getCategoryById as jest.Mock).mockResolvedValue({ id: "pokemon", slug: "pokemon" });
    (getDescendantCategoryIds as jest.Mock).mockResolvedValue(["pokemon", "kanto", "starters"]);
    await expect(editCategory("pokemon", { parent_id: "starters" })).rejects.toThrow(CategoryCycleError);
    expect(updateCategoryBranding).not.toHaveBeenCalled();
  });

  it("allows setting parent_id to an unrelated category", async () => {
    (getCategoryById as jest.Mock).mockResolvedValue({ id: "kanto", slug: "kanto" });
    (getDescendantCategoryIds as jest.Mock).mockResolvedValue(["kanto"]);
    (updateCategoryBranding as jest.Mock).mockResolvedValue({ id: "kanto", parent_id: "unrelated" });
    await expect(editCategory("kanto", { parent_id: "unrelated" })).resolves.toEqual({ id: "kanto", parent_id: "unrelated" });
  });

  it("returns null when the category doesn't exist", async () => {
    (getCategoryById as jest.Mock).mockResolvedValue(null);
    await expect(editCategory("missing", { name: "X" })).resolves.toBeNull();
  });
});
