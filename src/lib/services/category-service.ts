import {
  insertCategory,
  updateCategoryBranding,
  type CategoryWritePayload,
} from "@/lib/repositories/category-repository";
import type { Category } from "@/types";

export async function createCategory(payload: CategoryWritePayload): Promise<Category> {
  return insertCategory(payload);
}

export async function editCategory(
  id: string,
  payload: Partial<CategoryWritePayload>
): Promise<Category | null> {
  return updateCategoryBranding(id, payload);
}
