import { createClient } from "@/lib/supabase/server";
import ProductForm from "@/components/admin/product-form";

export default async function NewProductPage() {
  const supabase = await createClient();
  const { data: categories } = await supabase
    .from("categories")
    .select("id, name, parent_id")
    .eq("is_active", true)
    .order("name");

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-foreground">Add New Product</h1>
      <ProductForm categories={categories ?? []} />
    </div>
  );
}
