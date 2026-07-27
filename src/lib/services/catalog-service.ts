import type { Category, CategoryWithChildren } from "@/types";
import { listActiveCategories, listAllCategories } from "@/lib/repositories/category-repository";

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
 * via BFS over the full category tree (active and inactive). Single source
 * of truth for "which category_ids count as belonging to this category" —
 * used anywhere products are filtered by category so parent categories
 * aggregate their whole subtree instead of matching only their own
 * (product-less) id.
 *
 * The tree structure is built from *all* categories (including inactive
 * ones) so an inactive intermediate category doesn't sever the path to its
 * active descendants. The returned list, however, always includes the root
 * categoryId itself, and by default only includes descendants whose
 * is_active is true — an inactive descendant's own id is excluded from the
 * result even though its active children/grandchildren are still reachable
 * and included. Pass `{ includeInactive: true }` to include every visited
 * descendant's id regardless of is_active -- used by cycle-detection callers
 * (e.g. category-service's editCategory) where an inactive intermediate
 * category must still count as "part of this subtree" even though it is
 * filtered out of product-aggregation queries.
 *
 * Includes a visited set guard to prevent infinite loops if the category
 * hierarchy contains cycles (e.g., admin update creates a cycle in parent_id chain).
 */
export async function getDescendantCategoryIds(
  categoryId: string,
  options: { includeInactive?: boolean } = {}
): Promise<string[]> {
  const categories = await listAllCategories();
  const isActiveById = new Map<string, boolean>();
  const childrenByParent = new Map<string, string[]>();
  for (const cat of categories) {
    isActiveById.set(cat.id, cat.is_active);
    if (cat.parent_id) {
      const siblings = childrenByParent.get(cat.parent_id) ?? [];
      siblings.push(cat.id);
      childrenByParent.set(cat.parent_id, siblings);
    }
  }

  const ids = [categoryId];
  const queue = [categoryId];
  const visited = new Set<string>([categoryId]);
  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const childId of childrenByParent.get(current) ?? []) {
      if (!visited.has(childId)) {
        visited.add(childId);
        if (options.includeInactive || isActiveById.get(childId)) {
          ids.push(childId);
        }
        queue.push(childId);
      }
    }
  }
  return ids;
}
