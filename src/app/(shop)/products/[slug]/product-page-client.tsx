"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  ShoppingCart, Heart, MessageCircle, Share2,
  ChevronRight, Minus, Plus, Package, Shield, Truck
} from "lucide-react";
import type { Product } from "@/types";
import { formatCurrency, cn, getInquiryMessage, getProductShareMessage, getWhatsAppUrl } from "@/lib/utils";
import { useCartStore } from "@/store/cart";
import { useWishlistStore } from "@/store/wishlist";
import ProductCard from "@/components/product/product-card";
import { toast } from "sonner";

interface ProductPageClientProps {
  product: Product & { category?: { name: string; slug: string } | null };
  related: Product[];
}

export default function ProductPageClient({ product, related }: ProductPageClientProps) {
  const [selectedImage, setSelectedImage] = useState(0);
  const [qty, setQty] = useState(1);
  const { addItem, openCart } = useCartStore();
  const { isInWishlist, toggleItem } = useWishlistStore();
  const inWishlist = isInWishlist(product.id);

  const phone = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || "919876543210";
  const productUrl = typeof window !== "undefined"
    ? window.location.href
    : `https://legacymania.in/products/${product.slug}`;

  const handleAddToCart = () => {
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
      quantity: qty,
    });
    toast.success(`${product.name} added to cart`);
    openCart();
  };

  const handleShare = async () => {
    const shareData = {
      title: product.name,
      text: getProductShareMessage(product.name, productUrl),
      url: productUrl,
    };
    if (navigator.share) {
      await navigator.share(shareData);
    } else {
      await navigator.clipboard.writeText(productUrl);
      toast.success("Link copied to clipboard!");
    }
  };

  const whatsappInquiry = getWhatsAppUrl(phone, getInquiryMessage(product.name));

  const discount = product.compare_price
    ? Math.round(((product.compare_price - product.price) / product.compare_price) * 100)
    : null;

  return (
    <div className="min-h-screen bg-background">
      {/* Breadcrumb */}
      <div className="container-max px-4 md:px-8 py-4">
        <nav className="flex items-center gap-2 text-sm text-muted-foreground">
          <Link href="/" className="hover:text-foreground">Home</Link>
          <ChevronRight className="w-3 h-3" />
          <Link href="/catalog" className="hover:text-foreground">Catalog</Link>
          {product.category && (
            <>
              <ChevronRight className="w-3 h-3" />
              <Link href={`/catalog/${product.category.slug}`} className="hover:text-foreground">
                {product.category.name}
              </Link>
            </>
          )}
          <ChevronRight className="w-3 h-3" />
          <span className="text-foreground truncate max-w-48">{product.name}</span>
        </nav>
      </div>

      <div className="container-max px-4 md:px-8 pb-16">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 mb-16">
          {/* Images */}
          <div className="space-y-4">
            <div className="relative aspect-square rounded-2xl overflow-hidden bg-muted border border-border">
              {product.images[selectedImage] ? (
                <Image
                  src={product.images[selectedImage]}
                  alt={product.name}
                  fill
                  className="object-contain p-4"
                  priority
                  sizes="(max-width: 1024px) 100vw, 50vw"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-6xl">🃏</div>
              )}
            </div>

            {product.images.length > 1 && (
              <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
                {product.images.map((img, i) => (
                  <button
                    key={i}
                    onClick={() => setSelectedImage(i)}
                    className={cn(
                      "relative w-16 h-16 flex-shrink-0 rounded-xl overflow-hidden border-2 transition-all",
                      selectedImage === i
                        ? "border-primary"
                        : "border-border hover:border-primary/50"
                    )}
                  >
                    <Image src={img} alt={`${product.name} ${i + 1}`} fill className="object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Info */}
          <div className="space-y-6">
            {product.category && (
              <Link
                href={`/catalog/${product.category.slug}`}
                className="inline-block text-primary text-sm font-semibold hover:underline"
              >
                {product.category.name}
              </Link>
            )}

            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-2">
                {product.name}
              </h1>
              <div className="flex items-center gap-3">
                <span className="text-3xl font-bold text-foreground">
                  {formatCurrency(product.price)}
                </span>
                {product.compare_price && product.compare_price > product.price && (
                  <>
                    <span className="text-lg text-muted-foreground line-through">
                      {formatCurrency(product.compare_price)}
                    </span>
                    {discount && (
                      <span className="bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 text-sm font-bold px-2 py-0.5 rounded-full">
                        {discount}% OFF
                      </span>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Attributes */}
            <div className="grid grid-cols-2 gap-3">
              {product.series && (
                <div className="bg-accent/50 rounded-xl p-3">
                  <p className="text-xs text-muted-foreground">Series</p>
                  <p className="font-semibold text-sm">{product.series}</p>
                </div>
              )}
              {product.saga && (
                <div className="bg-accent/50 rounded-xl p-3">
                  <p className="text-xs text-muted-foreground">Saga</p>
                  <p className="font-semibold text-sm">{product.saga}</p>
                </div>
              )}
              {product.collection && (
                <div className="bg-accent/50 rounded-xl p-3">
                  <p className="text-xs text-muted-foreground">Collection</p>
                  <p className="font-semibold text-sm">{product.collection}</p>
                </div>
              )}
              <div className="bg-accent/50 rounded-xl p-3">
                <p className="text-xs text-muted-foreground">Stock</p>
                <p className={cn("font-semibold text-sm", product.stock_quantity === 0 ? "text-red-500" : "text-green-500")}>
                  {product.stock_quantity === 0 ? "Out of Stock" : `${product.stock_quantity} available`}
                </p>
              </div>
            </div>

            {/* Description */}
            {product.description && (
              <p className="text-muted-foreground text-sm leading-relaxed">
                {product.description}
              </p>
            )}

            {/* Qty + Add to cart */}
            {product.stock_quantity > 0 && (
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 bg-accent rounded-xl px-3 py-2">
                  <button
                    onClick={() => setQty(Math.max(1, qty - 1))}
                    className="p-1 hover:text-primary transition-colors"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <span className="w-8 text-center font-bold">{qty}</span>
                  <button
                    onClick={() => setQty(Math.min(product.stock_quantity, qty + 1))}
                    className="p-1 hover:text-primary transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>

                <button
                  onClick={handleAddToCart}
                  className="flex-1 flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 text-white font-bold py-3 rounded-xl transition-all active:scale-95"
                >
                  <ShoppingCart className="w-5 h-5" />
                  Add to Cart
                </button>
              </div>
            )}

            {/* Action buttons */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => { toggleItem(product.id); toast.success(inWishlist ? "Removed from wishlist" : "Added to wishlist"); }}
                className={cn(
                  "flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border transition-all",
                  inWishlist
                    ? "border-red-500 text-red-500 bg-red-50 dark:bg-red-950"
                    : "border-border hover:border-primary/50 text-muted-foreground hover:text-foreground"
                )}
              >
                <Heart className={cn("w-4 h-4", inWishlist && "fill-current")} />
                {inWishlist ? "Wishlisted" : "Wishlist"}
              </button>

              <a
                href={whatsappInquiry}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border border-[#25D366] text-[#25D366] hover:bg-[#25D366]/10 transition-colors"
              >
                <MessageCircle className="w-4 h-4" />
                Inquire
              </a>

              <button
                onClick={handleShare}
                className="p-3 rounded-xl border border-border hover:bg-accent transition-colors text-muted-foreground hover:text-foreground"
              >
                <Share2 className="w-4 h-4" />
              </button>
            </div>

            {/* Trust badges */}
            <div className="grid grid-cols-3 gap-3 pt-4 border-t border-border">
              {[
                { icon: Shield, label: "100% Authentic" },
                { icon: Package, label: "Safe Packaging" },
                { icon: Truck, label: "Pan India Delivery" },
              ].map(({ icon: Icon, label }) => (
                <div key={label} className="flex flex-col items-center gap-1 text-center">
                  <Icon className="w-5 h-5 text-primary" />
                  <span className="text-xs text-muted-foreground">{label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Related products */}
        {related.length > 0 && (
          <div>
            <h2 className="text-2xl font-bold text-foreground mb-6">Related Products</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
              {related.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
