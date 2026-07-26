import { createClient } from "@/lib/supabase/server";
import ProductForm from "@/components/admin/product-form";
import { suggestDisplayOrder } from "@/lib/services/product-service";

export default async function NewProductPage() {
  const supabase = await createClient();
  const [{ data: categories }, suggestedDisplayOrder] = await Promise.all([
    supabase
      .from("categories")
      .select("id, name, parent_id")
      .eq("is_active", true)
      .order("name"),
    suggestDisplayOrder(null),
  ]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-foreground">Add New Product</h1>
      <ProductForm categories={categories ?? []} suggestedDisplayOrder={suggestedDisplayOrder} />
    </div>
  );
}
