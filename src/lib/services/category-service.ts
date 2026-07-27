import {
  insertCategory,
  updateCategoryBranding,
  getCategoryById,
  getCategoryBySlug,
  type CategoryWritePayload,
} from "@/lib/repositories/category-repository";
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
    const descendantIds = await getDescendantCategoryIds(id);
    if (descendantIds.includes(payload.parent_id)) throw new CategoryCycleError();
  }

  return updateCategoryBranding(id, payload);
}
