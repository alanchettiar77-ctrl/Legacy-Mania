import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { Product } from "@/types";
import ProductCard from "@/components/product/product-card";

interface FeaturedCollectionsProps {
  products: Product[];
}

export default function FeaturedCollections({ products }: FeaturedCollectionsProps) {
  if (products.length === 0) return null;

  return (
    <section className="section-padding bg-accent/20">
      <div className="container-max">
        <div className="flex items-center justify-between mb-10">
          <div>
            <p className="text-primary text-sm font-semibold uppercase tracking-wide mb-1">
              Featured
            </p>
            <h2 className="text-3xl md:text-4xl font-bold text-foreground">
              Featured Collections
            </h2>
          </div>
          <Link
            href="/catalog?featured=true"
            className="hidden sm:flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            View All
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
          {products.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      </div>
    </section>
  );
}
