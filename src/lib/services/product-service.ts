import {
  insertProduct,
  updateProduct,
  type ProductWritePayload,
} from "@/lib/repositories/product-repository";

export async function createProduct(payload: ProductWritePayload): Promise<{ id: string }> {
  return insertProduct(payload);
}

export async function editProduct(id: string, payload: Partial<ProductWritePayload>): Promise<void> {
  await updateProduct(id, payload);
}

export async function setProductActive(id: string, isActive: boolean): Promise<void> {
  await updateProduct(id, { is_active: isActive });
}
