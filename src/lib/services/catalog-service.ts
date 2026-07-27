import type { Category, CategoryWithChildren } from "@/types";
import { listActiveCategories } from "@/lib/repositories/category-repository";

export async function getFlatCategories(): Promise<Category[]> {
  return listActiveCategories();
}

export async function getCategoryTree(): Promise<CategoryWithChildren[]> {
  const categories = await listActiveCategories();
  const byId = new Map<string, CategoryWithChildren>();
  categories.forEach((cat) => byId.set(cat.id, { ...cat, children: [] }));

  const roots: CategoryWithChildren[] = [];
  byId.forEach((node) => {
    if (node.parent_id && byId.has(node.parent_id)) {
      byId.get(node.parent_id)!.children!.push(node);
    } else {
      roots.push(node);
    }
  });

  return roots;
}

export async function getBreadcrumb(categoryId: string): Promise<Category[]> {
  const categories = await listActiveCategories();
  const byId = new Map(categories.map((cat) => [cat.id, cat]));
  const trail: Category[] = [];

  let current = byId.get(categoryId);
  while (current) {
    trail.unshift(current);
    current = current.parent_id ? byId.get(current.parent_id) : undefined;
  }

  return trail;
}

/**
 * Expands a category id into itself plus every descendant id at any depth,
 * via BFS over the full active-category list. Single source of truth for
 * "which category_ids count as belonging to this category" — used anywhere
 * products are filtered by category so parent categories aggregate their
 * whole subtree instead of matching only their own (product-less) id.
 */
export async function getDescendantCategoryIds(categoryId: string): Promise<string[]> {
  const categories = await listActiveCategories();
  const childrenByParent = new Map<string, string[]>();
  for (const cat of categories) {
    if (cat.parent_id) {
      const siblings = childrenByParent.get(cat.parent_id) ?? [];
      siblings.push(cat.id);
      childrenByParent.set(cat.parent_id, siblings);
    }
  }

  const ids = [categoryId];
  const queue = [categoryId];
  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const childId of childrenByParent.get(current) ?? []) {
      ids.push(childId);
      queue.push(childId);
    }
  }
  return ids;
}
