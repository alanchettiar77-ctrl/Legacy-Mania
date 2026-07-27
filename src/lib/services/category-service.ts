import {
  insertCategory,
  updateCategoryBranding,
  getCategoryById,
  getCategoryBySlug,
  listAllCategories,
  softDeleteCategory,
  type CategoryWritePayload,
} from "@/lib/repositories/category-repository";
import {
  countActiveProductsByCategory,
  reassignProductsCategory,
} from "@/lib/repositories/product-repository";
import { getDescendantCategoryIds } from "@/lib/services/catalog-service";
import type { Category } from "@/types";

export class CategorySlugConflictError extends Error {
  constructor(slug: string) {
    super(`Slug "${slug}" is already used by another category`);
    this.name = "CategorySlugConflictError";
  }
}

export class CategoryCycleError extends Error {
  constructor() {
    super("A category cannot be moved to itself or one of its own descendants");
    this.name = "CategoryCycleError";
  }
}

export async function createCategory(payload: CategoryWritePayload): Promise<Category> {
  const existing = await getCategoryBySlug(payload.slug);
  if (existing) throw new CategorySlugConflictError(payload.slug);
  return insertCategory(payload);
}

export async function editCategory(
  id: string,
  payload: Partial<CategoryWritePayload>
): Promise<Category | null> {
  const current = await getCategoryById(id);
  if (!current) return null;

  if (payload.slug !== undefined && payload.slug !== current.slug) {
    const existing = await getCategoryBySlug(payload.slug);
    if (existing && existing.id !== id) throw new CategorySlugConflictError(payload.slug);
  }

  if (payload.parent_id !== undefined && payload.parent_id !== null) {
    if (payload.parent_id === id) throw new CategoryCycleError();
    const descendantIds = await getDescendantCategoryIds(id, { includeInactive: true });
    if (descendantIds.includes(payload.parent_id)) throw new CategoryCycleError();
  }

  return updateCategoryBranding(id, payload);
}

export class CategoryHasChildrenError extends Error {
  constructor() {
    super("This category has subcategories — reassign or delete them first");
    this.name = "CategoryHasChildrenError";
  }
}

export class CategoryHasProductsError extends Error {
  constructor() {
    super("This category has products — reassign them first");
    this.name = "CategoryHasProductsError";
  }
}

export interface DeleteCategoryOptions {
  reassignChildrenTo?: string;
  reassignProductsTo?: string;
}

export async function deleteCategory(id: string, options: DeleteCategoryOptions = {}): Promise<void> {
  const current = await getCategoryById(id);
  if (!current) throw new Error("Category not found");

  const allCategories = await listAllCategories();
  const directChildren = allCategories.filter((cat) => cat.parent_id === id);

  if (directChildren.length > 0) {
    if (!options.reassignChildrenTo) throw new CategoryHasChildrenError();
    for (const child of directChildren) {
      await updateCategoryBranding(child.id, { parent_id: options.reassignChildrenTo });
    }
  }

  const productCount = await countActiveProductsByCategory(id);
  if (productCount > 0) {
    if (!options.reassignProductsTo) throw new CategoryHasProductsError();
    await reassignProductsCategory(id, options.reassignProductsTo);
  }

  await softDeleteCategory(id);
}

export async function reassignProducts(fromCategoryId: string, toCategoryId: string): Promise<number> {
  return reassignProductsCategory(fromCategoryId, toCategoryId);
}
