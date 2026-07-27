jest.mock("@/lib/repositories/category-repository", () => ({
  insertCategory: jest.fn(),
  updateCategoryBranding: jest.fn(),
  getCategoryBySlug: jest.fn(),
  getCategoryById: jest.fn(),
  listAllCategories: jest.fn(),
  softDeleteCategory: jest.fn(),
}));
jest.mock("@/lib/repositories/product-repository", () => ({
  countProductsByCategory: jest.fn(),
  reassignProductsCategory: jest.fn(),
}));
jest.mock("@/lib/services/catalog-service", () => ({
  getDescendantCategoryIds: jest.fn(),
}));

import {
  createCategory,
  editCategory,
  CategorySlugConflictError,
  CategoryCycleError,
  deleteCategory,
  reassignProducts,
  CategoryHasChildrenError,
  CategoryHasProductsError,
  CategoryInvalidReassignTargetError,
} from "./category-service";
import {
  insertCategory,
  updateCategoryBranding,
  getCategoryBySlug,
  getCategoryById,
  listAllCategories,
  softDeleteCategory,
} from "@/lib/repositories/category-repository";
import {
  countProductsByCategory,
  reassignProductsCategory,
} from "@/lib/repositories/product-repository";
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
    expect(getDescendantCategoryIds).toHaveBeenCalledWith("pokemon", { includeInactive: true });
  });

  it("allows setting parent_id to an unrelated category", async () => {
    (getCategoryById as jest.Mock).mockResolvedValue({ id: "kanto", slug: "kanto" });
    (getDescendantCategoryIds as jest.Mock).mockResolvedValue(["kanto"]);
    (updateCategoryBranding as jest.Mock).mockResolvedValue({ id: "kanto", parent_id: "unrelated" });
    await expect(editCategory("kanto", { parent_id: "unrelated" })).resolves.toEqual({ id: "kanto", parent_id: "unrelated" });
    expect(getDescendantCategoryIds).toHaveBeenCalledWith("kanto", { includeInactive: true });
  });

  it("returns null when the category doesn't exist", async () => {
    (getCategoryById as jest.Mock).mockResolvedValue(null);
    await expect(editCategory("missing", { name: "X" })).resolves.toBeNull();
  });
});

describe("deleteCategory", () => {
  it("soft-deletes a category with no children and no products", async () => {
    (getCategoryById as jest.Mock).mockResolvedValue({ id: "leaf", slug: "leaf" });
    (listAllCategories as jest.Mock).mockResolvedValue([{ id: "leaf", parent_id: null }]);
    (countProductsByCategory as jest.Mock).mockResolvedValue(0);
    (softDeleteCategory as jest.Mock).mockResolvedValue(undefined);

    await deleteCategory("leaf");

    expect(softDeleteCategory).toHaveBeenCalledWith("leaf");
  });

  it("throws CategoryHasChildrenError when children exist and no reassignChildrenTo is given", async () => {
    (getCategoryById as jest.Mock).mockResolvedValue({ id: "parent", slug: "parent" });
    (listAllCategories as jest.Mock).mockResolvedValue([
      { id: "parent", parent_id: null },
      { id: "child", parent_id: "parent" },
    ]);
    (countProductsByCategory as jest.Mock).mockResolvedValue(0);

    await expect(deleteCategory("parent")).rejects.toThrow(CategoryHasChildrenError);
    expect(softDeleteCategory).not.toHaveBeenCalled();
  });

  it("throws CategoryHasProductsError when products exist and no reassignProductsTo is given", async () => {
    (getCategoryById as jest.Mock).mockResolvedValue({ id: "leaf", slug: "leaf" });
    (listAllCategories as jest.Mock).mockResolvedValue([{ id: "leaf", parent_id: null }]);
    (countProductsByCategory as jest.Mock).mockResolvedValue(3);

    await expect(deleteCategory("leaf")).rejects.toThrow(CategoryHasProductsError);
    expect(softDeleteCategory).not.toHaveBeenCalled();
  });

  it("throws CategoryHasProductsError when the category has only inactive products and no reassignProductsTo is given", async () => {
    (getCategoryById as jest.Mock).mockResolvedValue({ id: "leaf", slug: "leaf" });
    (listAllCategories as jest.Mock).mockResolvedValue([{ id: "leaf", parent_id: null }]);
    // countProductsByCategory counts all products regardless of active status, unlike
    // countActiveProductsByCategory — so this catches a category with zero active but
    // some inactive products still referencing it.
    (countProductsByCategory as jest.Mock).mockResolvedValue(1);

    await expect(deleteCategory("leaf")).rejects.toThrow(CategoryHasProductsError);
    expect(softDeleteCategory).not.toHaveBeenCalled();
  });

  it("throws CategoryHasProductsError without reassigning children first, when children exist but reassignProductsTo is missing", async () => {
    (getCategoryById as jest.Mock).mockResolvedValue({ id: "parent", slug: "parent" });
    (listAllCategories as jest.Mock).mockResolvedValue([
      { id: "parent", parent_id: null },
      { id: "child", parent_id: "parent" },
    ]);
    (countProductsByCategory as jest.Mock).mockResolvedValue(3);

    await expect(
      deleteCategory("parent", { reassignChildrenTo: "other" })
    ).rejects.toThrow(CategoryHasProductsError);
    expect(updateCategoryBranding).not.toHaveBeenCalled();
    expect(softDeleteCategory).not.toHaveBeenCalled();
  });

  it("reassigns children then deletes when reassignChildrenTo is given", async () => {
    (getCategoryById as jest.Mock).mockImplementation((id: string) =>
      Promise.resolve({ id, slug: id })
    );
    (listAllCategories as jest.Mock).mockResolvedValue([
      { id: "parent", parent_id: null },
      { id: "child", parent_id: "parent" },
    ]);
    (countProductsByCategory as jest.Mock).mockResolvedValue(0);
    (getDescendantCategoryIds as jest.Mock).mockResolvedValue(["parent", "child"]);
    (updateCategoryBranding as jest.Mock).mockResolvedValue({ id: "child", parent_id: "other" });

    await deleteCategory("parent", { reassignChildrenTo: "other" });

    expect(updateCategoryBranding).toHaveBeenCalledWith("child", { parent_id: "other" });
    expect(softDeleteCategory).toHaveBeenCalledWith("parent");
  });

  it("reassigns products then deletes when reassignProductsTo is given", async () => {
    (getCategoryById as jest.Mock).mockImplementation((id: string) =>
      Promise.resolve({ id, slug: id })
    );
    (listAllCategories as jest.Mock).mockResolvedValue([{ id: "leaf", parent_id: null }]);
    (countProductsByCategory as jest.Mock).mockResolvedValue(3);
    (reassignProductsCategory as jest.Mock).mockResolvedValue(3);

    await deleteCategory("leaf", { reassignProductsTo: "other-leaf" });

    expect(reassignProductsCategory).toHaveBeenCalledWith("leaf", "other-leaf");
    expect(softDeleteCategory).toHaveBeenCalledWith("leaf");
  });

  it("throws when the category doesn't exist", async () => {
    (getCategoryById as jest.Mock).mockResolvedValue(null);
    await expect(deleteCategory("missing")).rejects.toThrow("Category not found");
  });

  it("rejects reassignChildrenTo === id without mutating anything", async () => {
    (getCategoryById as jest.Mock).mockResolvedValue({ id: "parent", slug: "parent" });
    (listAllCategories as jest.Mock).mockResolvedValue([
      { id: "parent", parent_id: null },
      { id: "child", parent_id: "parent" },
    ]);
    (countProductsByCategory as jest.Mock).mockResolvedValue(0);

    await expect(
      deleteCategory("parent", { reassignChildrenTo: "parent" })
    ).rejects.toThrow(CategoryInvalidReassignTargetError);
    expect(updateCategoryBranding).not.toHaveBeenCalled();
    expect(reassignProductsCategory).not.toHaveBeenCalled();
    expect(softDeleteCategory).not.toHaveBeenCalled();
  });

  it("rejects reassignChildrenTo that is a descendant of id, without mutating anything", async () => {
    (getCategoryById as jest.Mock).mockResolvedValue({ id: "pokemon", slug: "pokemon" });
    (listAllCategories as jest.Mock).mockResolvedValue([
      { id: "pokemon", parent_id: null },
      { id: "kanto", parent_id: "pokemon" },
    ]);
    (countProductsByCategory as jest.Mock).mockResolvedValue(0);
    (getDescendantCategoryIds as jest.Mock).mockResolvedValue(["pokemon", "kanto", "starters"]);

    await expect(
      deleteCategory("pokemon", { reassignChildrenTo: "starters" })
    ).rejects.toThrow(CategoryInvalidReassignTargetError);
    expect(updateCategoryBranding).not.toHaveBeenCalled();
    expect(reassignProductsCategory).not.toHaveBeenCalled();
    expect(softDeleteCategory).not.toHaveBeenCalled();
  });

  it("rejects reassignChildrenTo pointing at a nonexistent category, without mutating anything", async () => {
    (getCategoryById as jest.Mock).mockImplementation((id: string) =>
      Promise.resolve(id === "parent" ? { id: "parent", slug: "parent" } : null)
    );
    (listAllCategories as jest.Mock).mockResolvedValue([
      { id: "parent", parent_id: null },
      { id: "child", parent_id: "parent" },
    ]);
    (countProductsByCategory as jest.Mock).mockResolvedValue(0);
    (getDescendantCategoryIds as jest.Mock).mockResolvedValue(["parent", "child"]);

    await expect(
      deleteCategory("parent", { reassignChildrenTo: "missing-target" })
    ).rejects.toThrow(CategoryInvalidReassignTargetError);
    expect(updateCategoryBranding).not.toHaveBeenCalled();
    expect(reassignProductsCategory).not.toHaveBeenCalled();
    expect(softDeleteCategory).not.toHaveBeenCalled();
  });

  it("rejects reassignProductsTo pointing at a nonexistent category, without mutating anything", async () => {
    (getCategoryById as jest.Mock).mockImplementation((id: string) =>
      Promise.resolve(id === "leaf" ? { id: "leaf", slug: "leaf" } : null)
    );
    (listAllCategories as jest.Mock).mockResolvedValue([{ id: "leaf", parent_id: null }]);
    (countProductsByCategory as jest.Mock).mockResolvedValue(3);

    await expect(
      deleteCategory("leaf", { reassignProductsTo: "missing-target" })
    ).rejects.toThrow(CategoryInvalidReassignTargetError);
    expect(updateCategoryBranding).not.toHaveBeenCalled();
    expect(reassignProductsCategory).not.toHaveBeenCalled();
    expect(softDeleteCategory).not.toHaveBeenCalled();
  });
});

describe("reassignProducts", () => {
  it("delegates to the repository and returns the count moved", async () => {
    (reassignProductsCategory as jest.Mock).mockResolvedValue(5);
    await expect(reassignProducts("old", "new")).resolves.toBe(5);
    expect(reassignProductsCategory).toHaveBeenCalledWith("old", "new");
  });
});
