"use client";

import { useState, useCallback } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Filter, Grid3X3, List, Search, X, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import type { Product, CategoryWithChildren } from "@/types";
import ProductCard from "@/components/product/product-card";
import { cn } from "@/lib/utils";

interface CatalogClientProps {
  initialProducts: Product[];
  totalCount: number;
  currentPage?: number;
  pageSize?: number;
  categories: CategoryWithChildren[];
  searchParams: { [key: string]: string | undefined };
  pageTitle?: string;
  pageDescription?: string;
}

const sortOptions = [
  { value: "newest", label: "Newest First" },
  { value: "price_asc", label: "Price: Low to High" },
  { value: "price_desc", label: "Price: High to Low" },
  { value: "name_asc", label: "Name A-Z" },
];

export default function CatalogClient({
  initialProducts,
  totalCount,
  currentPage = 1,
  pageSize = 24,
  categories,
  pageTitle = "Browse Catalog",
  pageDescription,
}: CatalogClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParamsObj = useSearchParams();
  const [products] = useState<Product[]>(initialProducts);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("newest");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const filtered = products.filter((p) => {
    if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false;
    if (selectedCategory && p.category_id !== selectedCategory) return false;
    return true;
  });

  const sorted = [...filtered].sort((a, b) => {
    switch (sort) {
      case "price_asc": return a.price - b.price;
      case "price_desc": return b.price - a.price;
      case "name_asc": return a.name.localeCompare(b.name);
      default: return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    }
  });

  return (
    <div className="min-h-screen bg-background">
      {/* Page header */}
      <div className="bg-accent/20 border-b border-border">
        <div className="container-max px-4 md:px-8 py-8">
          <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-1">
            {pageTitle}
          </h1>
          <p className="text-muted-foreground">
            {pageDescription ?? `${totalCount} products across all collections`}
          </p>
        </div>
      </div>

      <div className="container-max px-4 md:px-8 py-8">
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Sidebar */}
          <aside
            className={cn(
              "w-full lg:w-64 flex-shrink-0",
              "lg:block",
              sidebarOpen ? "block" : "hidden lg:block"
            )}
          >
            <div className="space-y-6">
              {/* Categories */}
              <div>
                <h3 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground mb-3">
                  Series
                </h3>
                <ul className="space-y-1">
                  <li>
                    <button
                      onClick={() => setSelectedCategory(null)}
                      className={cn(
                        "w-full text-left px-3 py-2 rounded-lg text-sm transition-colors",
                        selectedCategory === null
                          ? "bg-primary text-primary-foreground font-semibold"
                          : "text-muted-foreground hover:text-foreground hover:bg-accent"
                      )}
                    >
                      All Series
                    </button>
                  </li>
                  {categories.map((cat) => (
                    <li key={cat.id}>
                      <button
                        onClick={() => setSelectedCategory(cat.id)}
                        className={cn(
                          "w-full text-left px-3 py-2 rounded-lg text-sm transition-colors",
                          selectedCategory === cat.id
                            ? "bg-primary text-primary-foreground font-semibold"
                            : "text-muted-foreground hover:text-foreground hover:bg-accent"
                        )}
                      >
                        {cat.name}
                      </button>
                      {cat.children && cat.children.length > 0 && (
                        <ul className="ml-4 mt-1 space-y-1">
                          {cat.children.map((child) => (
                            <li key={child.id}>
                              <button
                                onClick={() => setSelectedCategory(child.id)}
                                className={cn(
                                  "w-full text-left px-3 py-1.5 rounded-lg text-xs transition-colors",
                                  selectedCategory === child.id
                                    ? "text-primary font-semibold"
                                    : "text-muted-foreground hover:text-foreground"
                                )}
                              >
                                {child.name}
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </aside>

          {/* Main */}
          <div className="flex-1 min-w-0">
            {/* Toolbar */}
            <div className="flex flex-wrap items-center gap-3 mb-6">
              {/* Search */}
              <div className="relative flex-1 min-w-48">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search products..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-accent border border-border text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
                {search && (
                  <button
                    onClick={() => setSearch("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2"
                  >
                    <X className="w-4 h-4 text-muted-foreground" />
                  </button>
                )}
              </div>

              {/* Sort */}
              <div className="relative">
                <select
                  value={sort}
                  onChange={(e) => setSort(e.target.value)}
                  className="appearance-none pl-3 pr-8 py-2.5 rounded-xl bg-accent border border-border text-sm focus:outline-none focus:border-primary cursor-pointer"
                >
                  {sortOptions.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none text-muted-foreground" />
              </div>

              {/* View mode */}
              <div className="flex items-center gap-1 bg-accent rounded-xl p-1">
                <button
                  onClick={() => setViewMode("grid")}
                  className={cn(
                    "p-1.5 rounded-lg transition-colors",
                    viewMode === "grid"
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground"
                  )}
                >
                  <Grid3X3 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setViewMode("list")}
                  className={cn(
                    "p-1.5 rounded-lg transition-colors",
                    viewMode === "list"
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground"
                  )}
                >
                  <List className="w-4 h-4" />
                </button>
              </div>

              {/* Mobile filter toggle */}
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="lg:hidden flex items-center gap-2 px-3 py-2.5 rounded-xl bg-accent border border-border text-sm"
              >
                <Filter className="w-4 h-4" />
                Filters
              </button>
            </div>

            {/* Result count */}
            <p className="text-sm text-muted-foreground mb-4">
              {search || selectedCategory
                ? `${sorted.length} result${sorted.length !== 1 ? "s" : ""} found`
                : `Showing ${initialProducts.length} of ${totalCount} products`}
            </p>

            {/* Products grid */}
            {sorted.length === 0 ? (
              <div className="text-center py-20 text-muted-foreground">
                <p className="text-lg font-medium">No products found</p>
                <p className="text-sm mt-1">Try a different search or category</p>
              </div>
            ) : (
              <div
                className={cn(
                  viewMode === "grid"
                    ? "grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6"
                    : "flex flex-col gap-4"
                )}
              >
                {sorted.map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>
            )}

            {/* Pagination — only shown when not filtering locally */}
            {!search && !selectedCategory && totalCount > pageSize && (
              <div className="flex items-center justify-center gap-2 mt-10">
                <button
                  disabled={currentPage <= 1}
                  onClick={() => {
                    const params = new URLSearchParams(searchParamsObj.toString());
                    params.set("page", String(currentPage - 1));
                    router.push(`${pathname}?${params.toString()}`);
                  }}
                  className="flex items-center gap-1 px-4 py-2 rounded-xl border border-border bg-card text-sm font-medium disabled:opacity-40 hover:bg-accent transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                  Previous
                </button>

                <div className="flex items-center gap-1">
                  {Array.from(
                    { length: Math.ceil(totalCount / pageSize) },
                    (_, i) => i + 1
                  )
                    .filter(
                      (p) =>
                        p === 1 ||
                        p === Math.ceil(totalCount / pageSize) ||
                        Math.abs(p - currentPage) <= 1
                    )
                    .reduce<(number | "…")[]>((acc, p, idx, arr) => {
                      if (idx > 0 && (arr[idx - 1] as number) < p - 1)
                        acc.push("…");
                      acc.push(p);
                      return acc;
                    }, [])
                    .map((p, i) =>
                      p === "…" ? (
                        <span
                          key={`ellipsis-${i}`}
                          className="px-2 text-muted-foreground text-sm"
                        >
                          …
                        </span>
                      ) : (
                        <button
                          key={p}
                          onClick={() => {
                            const params = new URLSearchParams(
                              searchParamsObj.toString()
                            );
                            params.set("page", String(p));
                            router.push(`${pathname}?${params.toString()}`);
                          }}
                          className={cn(
                            "w-9 h-9 rounded-xl text-sm font-medium transition-colors",
                            p === currentPage
                              ? "bg-primary text-primary-foreground"
                              : "border border-border hover:bg-accent"
                          )}
                        >
                          {p}
                        </button>
                      )
                    )}
                </div>

                <button
                  disabled={currentPage >= Math.ceil(totalCount / pageSize)}
                  onClick={() => {
                    const params = new URLSearchParams(searchParamsObj.toString());
                    params.set("page", String(currentPage + 1));
                    router.push(`${pathname}?${params.toString()}`);
                  }}
                  className="flex items-center gap-1 px-4 py-2 rounded-xl border border-border bg-card text-sm font-medium disabled:opacity-40 hover:bg-accent transition-colors"
                >
                  Next
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
