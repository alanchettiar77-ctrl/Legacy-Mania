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
