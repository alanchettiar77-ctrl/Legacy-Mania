"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import { Eye, Edit, EyeOff, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency } from "@/lib/utils";
import { toast } from "sonner";

interface Product {
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
}

export default function ProductsTable({ initialProducts }: { initialProducts: Product[] }) {
  const [products, setProducts] = useState(initialProducts);

  const toggleActive = async (id: string, current: boolean) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (createClient() as any)
      .from("products")
      .update({ is_active: !current })
      .eq("id", id);
    if (error) {
      toast.error("Failed to update status");
      return;
    }
    setProducts((prev) =>
      prev.map((p) => (p.id === id ? { ...p, is_active: !current } : p))
    );
    toast.success(!current ? "Product activated" : "Product hidden");
  };

  const deleteProduct = async (id: string, name: string) => {
    if (!confirm(`Hide "${name}" from the store? It will not be deleted from the database.`)) return;
    await toggleActive(id, true);
  };

  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left p-4 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Product
              </th>
              <th className="text-left p-4 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Category
              </th>
              <th className="text-left p-4 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Price
              </th>
              <th className="text-left p-4 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Stock
              </th>
              <th className="text-left p-4 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Status
              </th>
              <th className="text-right p-4 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {products.map((product) => (
              <tr
                key={product.id}
                className={`border-b border-border last:border-0 hover:bg-accent/20 transition-colors ${
                  !product.is_active ? "opacity-50" : ""
                }`}
              >
                <td className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="relative w-10 h-10 rounded-lg overflow-hidden bg-muted flex-shrink-0">
                      {product.images[0] ? (
                        <Image
                          src={product.images[0]}
                          alt={product.name}
                          fill
                          className="object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-lg">
                          🃏
                        </div>
                      )}
                    </div>
                    <div>
                      <p className="font-medium text-sm text-foreground">
                        {product.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {product.sku || "—"}
                      </p>
                    </div>
                  </div>
                </td>
                <td className="p-4 text-sm text-muted-foreground">
                  {product.category?.name || "—"}
                </td>
                <td className="p-4">
                  <p className="font-semibold text-sm">
                    {formatCurrency(product.price)}
                  </p>
                  {product.compare_price && (
                    <p className="text-xs text-muted-foreground line-through">
                      {formatCurrency(product.compare_price)}
                    </p>
                  )}
                </td>
                <td className="p-4">
                  <span
                    className={`text-sm font-medium ${
                      product.stock_quantity > 0
                        ? "text-green-500"
                        : "text-red-500"
                    }`}
                  >
                    {product.stock_quantity}
                  </span>
                </td>
                <td className="p-4">
                  <span
                    className={`text-xs font-semibold px-2 py-1 rounded-full ${
                      product.is_active
                        ? "bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300"
                        : "bg-gray-100 dark:bg-gray-800 text-gray-500"
                    }`}
                  >
                    {product.is_active ? "Active" : "Hidden"}
                  </span>
                </td>
                <td className="p-4">
                  <div className="flex items-center justify-end gap-1">
                    <Link
                      href={`/products/${product.slug}`}
                      target="_blank"
                      className="p-1.5 rounded-lg hover:bg-accent transition-colors text-muted-foreground hover:text-foreground"
                      title="View on site"
                    >
                      <Eye className="w-4 h-4" />
                    </Link>
                    <Link
                      href={`/admin/products/${product.id}/edit`}
                      className="p-1.5 rounded-lg hover:bg-accent transition-colors text-muted-foreground hover:text-foreground"
                      title="Edit"
                    >
                      <Edit className="w-4 h-4" />
                    </Link>
                    <button
                      onClick={() => toggleActive(product.id, product.is_active)}
                      className="p-1.5 rounded-lg hover:bg-accent transition-colors text-muted-foreground hover:text-foreground"
                      title={product.is_active ? "Hide product" : "Show product"}
                    >
                      <EyeOff className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => deleteProduct(product.id, product.name)}
                      className="p-1.5 rounded-lg hover:bg-red-500/10 transition-colors text-muted-foreground hover:text-red-500"
                      title="Remove from store"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {products.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <p>No products yet.</p>
            <Link
              href="/admin/products/new"
              className="text-primary hover:underline text-sm mt-1 block"
            >
              Add your first product
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
