import {
  insertProduct,
  updateProduct,
  getMaxDisplayOrder,
  findDisplayOrderConflict,
  reorderProducts as repoReorderProducts,
  type ProductWritePayload,
} from "@/lib/repositories/product-repository";

export interface CreateProductResult {
  id: string;
  warning?: string;
}

export interface EditProductResult {
  warning?: string;
}

export async function createProduct(payload: ProductWritePayload): Promise<CreateProductResult> {
  const conflict = await findDisplayOrderConflict(payload.category_id, payload.display_order, undefined);
  const created = await insertProduct(payload);
  return conflict
    ? { ...created, warning: `Display order ${payload.display_order} is already used by another product in this category.` }
    : created;
}

export async function editProduct(
  id: string,
  payload: Partial<ProductWritePayload>
): Promise<EditProductResult> {
  let warning: string | undefined;
  if (payload.display_order !== undefined) {
    const conflict = await findDisplayOrderConflict(payload.category_id ?? null, payload.display_order, id);
    if (conflict) {
      warning = `Display order ${payload.display_order} is already used by another product in this category.`;
    }
  }
  await updateProduct(id, payload);
  return { warning };
}

export async function setProductActive(id: string, isActive: boolean): Promise<void> {
  await updateProduct(id, { is_active: isActive });
}

/** Suggests the next free display_order for a category (max + 1, or 1 if empty). */
export async function suggestDisplayOrder(categoryId: string | null): Promise<number> {
  return (await getMaxDisplayOrder(categoryId)) + 1;
}

export async function reorderProducts(ids: string[]): Promise<void> {
  return repoReorderProducts(ids);
}

/**
 * Applies the canonical product sort to a Supabase query builder, chaining .order() calls
 * (PostgREST/supabase-js treats successive .order() calls as multi-column ORDER BY).
 * Default (null or unrecognized sort) is display_order ASC, created_at ASC — the single
 * source of truth for "no customer selection" behavior across every storefront surface.
 */
export function applyProductSort<T extends { order: (col: string, opts: { ascending: boolean }) => T }>(
  query: T,
  sort: string | null
): T {
  switch (sort) {
    case "newest":
      return query.order("created_at", { ascending: false });
    case "oldest":
      return query.order("created_at", { ascending: true });
    case "price_asc":
      return query.order("price", { ascending: true });
    case "price_desc":
      return query.order("price", { ascending: false });
    case "name_asc":
      return query.order("name", { ascending: true });
    case "name_desc":
      return query.order("name", { ascending: false });
    case "featured":
      return query.order("is_featured", { ascending: false }).order("display_order", { ascending: true });
    case "display_order":
    default:
      return query.order("display_order", { ascending: true }).order("created_at", { ascending: true });
  }
}
