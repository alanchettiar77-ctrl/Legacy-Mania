import type { Metadata } from "next";
import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import CatalogClient from "./catalog-client";
import type { CategoryWithChildren } from "@/types";

export const metadata: Metadata = {
  title: "Catalog — Browse All Collections",
  description:
    "Browse our complete catalog of Pokémon, Dragon Ball Z, Naruto, One Piece, and anime collectible cards.",
};

const PAGE_SIZE = 24;

export default async function CatalogPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | undefined }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();
  const page = Math.max(1, parseInt(params.page ?? "1", 10));
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const [{ data: categories }, { data: products, count }] = await Promise.all([
    supabase
      .from("categories")
      .select("*, children:categories!parent_id(*)")
      .is("parent_id", null)
      .eq("is_active", true)
      .order("display_order"),
    supabase
      .from("products")
      .select("*, category:categories(*)", { count: "exact" })
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .range(from, to),
  ]);

  return (
    <Suspense fallback={<div className="min-h-screen" />}>
      <CatalogClient
        initialProducts={products ?? []}
        totalCount={count ?? 0}
        currentPage={page}
        pageSize={PAGE_SIZE}
        categories={(categories ?? []) as CategoryWithChildren[]}
        searchParams={params}
      />
    </Suspense>
  );
}
