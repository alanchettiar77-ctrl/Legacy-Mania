"use client";

import Image from "next/image";
import Link from "next/link";
import { Heart, ShoppingCart } from "lucide-react";
import type { Product } from "@/types";
import { formatCurrency, cn } from "@/lib/utils";
import { useCartStore } from "@/store/cart";
import { useWishlistStore } from "@/store/wishlist";
import { toast } from "sonner";

interface ProductCardProps {
  product: Product;
}

export default function ProductCard({ product }: ProductCardProps) {
  const { addItem, openCart } = useCartStore();
  const { isInWishlist, toggleItem } = useWishlistStore();
  const inWishlist = isInWishlist(product.id);

  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (product.stock_quantity === 0) {
      toast.error("Out of stock");
      return;
    }
    addItem({
      id: `${product.id}-${Date.now()}`,
      productId: product.id,
      name: product.name,
      price: product.price,
      image: product.images[0] || null,
      slug: product.slug,
    });
    toast.success(`${product.name} added to cart`);
    openCart();
  };

  const handleWishlist = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    toggleItem(product.id);
    toast.success(inWishlist ? "Removed from wishlist" : "Added to wishlist");
  };

  const discount = product.compare_price
    ? Math.round(((product.compare_price - product.price) / product.compare_price) * 100)
    : null;

  return (
    <Link href={`/products/${product.slug}`} className="product-card group">
      {/* Image */}
      <div className="relative aspect-square overflow-hidden bg-muted">
        {product.images[0] ? (
          <Image
            src={product.images[0]}
            alt={product.name}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-500"
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted-foreground text-4xl">
            🃏
          </div>
        )}

        {/* Badges */}
        {product.is_new && <span className="badge-new">NEW</span>}
        {discount && discount > 0 && (
          <span className="absolute top-2 right-2 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full z-10">
            -{discount}%
          </span>
        )}
        {product.stock_quantity === 0 && <span className="badge-sold">SOLD OUT</span>}

        {/* Wishlist button */}
        <button
          onClick={handleWishlist}
          className={cn(
            "absolute top-2 right-2 w-8 h-8 rounded-full flex items-center justify-center transition-all duration-200 opacity-0 group-hover:opacity-100",
            inWishlist
              ? "bg-red-500 text-white opacity-100"
              : "bg-background/80 backdrop-blur-sm text-foreground hover:bg-red-50 hover:text-red-500"
          )}
          aria-label={inWishlist ? "Remove from wishlist" : "Add to wishlist"}
        >
          <Heart
            className={cn("w-4 h-4", inWishlist && "fill-current")}
          />
        </button>

        {/* Quick add overlay */}
        <div className="absolute inset-x-0 bottom-0 p-3 translate-y-full group-hover:translate-y-0 transition-transform duration-300">
          <button
            onClick={handleAddToCart}
            disabled={product.stock_quantity === 0}
            className="w-full flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 text-white text-xs font-semibold py-2.5 rounded-xl disabled:bg-muted disabled:text-muted-foreground disabled:cursor-not-allowed transition-colors"
          >
            <ShoppingCart className="w-3.5 h-3.5" />
            {product.stock_quantity === 0 ? "Sold Out" : "Quick Add"}
          </button>
        </div>
      </div>

      {/* Info */}
      <div className="p-3">
        <p className="text-xs text-primary font-medium mb-0.5 truncate">
          {product.series || product.collection || ""}
        </p>
        <h3 className="font-semibold text-sm text-foreground leading-tight mb-2 line-clamp-2">
          {product.name}
        </h3>
        <div className="flex items-center gap-2">
          <span className="font-bold text-foreground">
            {formatCurrency(product.price)}
          </span>
          {product.compare_price && product.compare_price > product.price && (
            <span className="text-xs text-muted-foreground line-through">
              {formatCurrency(product.compare_price)}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
