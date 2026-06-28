import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import ProductCard from "@/components/product/product-card";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Search",
  description: "Search for Pokémon, Dragon Ball Z, Naruto cards and more",
};

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const supabase = await createClient();

  const { data: products } = q
    ? await supabase
        .from("products")
        .select("*")
        .eq("is_active", true)
        .or(`name.ilike.%${q}%,description.ilike.%${q}%,tags.cs.{${q}}`)
        .limit(24)
    : { data: [] };

  return (
    <div className="min-h-screen bg-background">
      <div className="container-max px-4 md:px-8 py-12">
        <h1 className="text-3xl font-bold text-foreground mb-2">
          {q ? `Search: "${q}"` : "Search"}
        </h1>
        {q && (
          <p className="text-muted-foreground mb-8">
            {products?.length ?? 0} results found
          </p>
        )}

        {!q ? (
          <div className="text-center py-16 text-muted-foreground">
            <p>Enter a search term above to find products.</p>
            <Link href="/catalog" className="btn-primary mt-4 inline-block text-sm">
              Browse All Products
            </Link>
          </div>
        ) : products && products.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
            {products.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        ) : (
          <div className="text-center py-16 text-muted-foreground">
            <p>No products found for &ldquo;{q}&rdquo;</p>
            <Link href="/catalog" className="btn-primary mt-4 inline-block text-sm">
              Browse All Products
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
