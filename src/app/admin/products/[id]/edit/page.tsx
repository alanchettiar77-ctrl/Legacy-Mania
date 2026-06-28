import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import ProductForm from "@/components/admin/product-form";
import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Edit Product" };

interface Props {
  params: Promise<{ id: string }>;
}

export default async function EditProductPage({ params }: Props) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: product }, { data: categories }] = await Promise.all([
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any)
      .from("products")
      .select("*")
      .eq("id", id)
      .single(),
    supabase
      .from("categories")
      .select("id, name, parent_id")
      .eq("is_active", true)
      .order("display_order"),
  ]);

  if (!product) notFound();

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Link
          href="/admin/products"
          className="p-2 rounded-xl hover:bg-accent transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Edit Product</h1>
          <p className="text-sm text-muted-foreground">{product.name}</p>
        </div>
      </div>

      <ProductForm
        categories={categories ?? []}
        initialData={{
          id: product.id,
          name: product.name,
          slug: product.slug,
          description: product.description ?? "",
          price: product.price,
          compare_price: product.compare_price ?? undefined,
          category_id: product.category_id ?? "",
          series: product.series ?? "",
          saga: product.saga ?? "",
          collection: product.collection ?? "",
          stock_quantity: product.stock_quantity,
          sku: product.sku ?? "",
          is_active: product.is_active,
          is_featured: product.is_featured,
          is_new: product.is_new,
          meta_title: product.meta_title ?? "",
          meta_description: product.meta_description ?? "",
          images: product.images ?? [],
        }}
      />
    </div>
  );
}
