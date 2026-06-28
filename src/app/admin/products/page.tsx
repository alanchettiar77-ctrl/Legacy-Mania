import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { Plus } from "lucide-react";
import ProductsTable from "./products-table";

export default async function AdminProductsPage() {
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;
  const { data: productsRaw } = await db
    .from("products")
    .select("*, category:categories(name)")
    .order("created_at", { ascending: false });

  const products = (productsRaw ?? []) as Array<{
    id: string;
    name: string;
    slug: string;
    sku: string | null;
    images: string[];
    price: number;
    compare_price: number | null;
    stock_quantity: number;
    is_active: boolean;
    is_featured: boolean;
    is_new: boolean;
    category: { name: string } | null;
  }>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Products</h1>
          <p className="text-muted-foreground text-sm">
            {products.length} products total
          </p>
        </div>
        <Link
          href="/admin/products/new"
          className="flex items-center gap-2 btn-primary text-sm"
        >
          <Plus className="w-4 h-4" />
          Add Product
        </Link>
      </div>

      <ProductsTable initialProducts={products} />
    </div>
  );
}
