"use client";

import { useWishlistStore } from "@/store/wishlist";
import { createClient } from "@/lib/supabase/client";
import { useEffect, useState } from "react";
import type { Product } from "@/types";
import ProductCard from "@/components/product/product-card";
import Link from "next/link";
import { Heart } from "lucide-react";

export default function WishlistPage() {
  const { items: wishlistIds } = useWishlistStore();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchWishlist = async () => {
      if (wishlistIds.length === 0) {
        setProducts([]);
        setLoading(false);
        return;
      }
      const supabase = createClient();
      const { data } = await supabase
        .from("products")
        .select("*")
        .in("id", wishlistIds)
        .eq("is_active", true);
      setProducts(data ?? []);
      setLoading(false);
    };
    fetchWishlist();
  }, [wishlistIds]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-foreground">My Wishlist</h1>

      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="aspect-square rounded-2xl bg-accent animate-pulse" />
          ))}
        </div>
      ) : products.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Heart className="w-16 h-16 mx-auto mb-4 opacity-20" />
          <p className="text-lg font-medium mb-2">Your wishlist is empty</p>
          <Link href="/catalog" className="btn-primary text-sm">
            Browse Catalog
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {products.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}
    </div>
  );
}
