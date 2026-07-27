import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { applyProductSort } from "@/lib/services/product-service";
import { getDescendantCategoryIds } from "@/lib/services/catalog-service";
import CatalogClient from "../catalog-client";
import type { CategoryWithChildren } from "@/types";

interface Props {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ [key: string]: string | undefined }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const supabase = await createClient();
  const { data: category } = await supabase
    .from("categories")
    .select("name, description")
    .eq("slug", slug)
    .single();

  if (!category) return { title: "Category Not Found" };
  return {
    title: `${category.name} — Legacy Mania`,
    description:
      category.description ||
      `Browse all ${category.name} collectible cards on Legacy Mania.`,
  };
}

export default async function CategoryPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const { sort } = await searchParams;
  const supabase = await createClient();

  const { data: category } = await supabase
    .from("categories")
    .select("*")
    .eq("slug", slug)
    .single();

  if (!category) notFound();

  // Aggregates this category + every descendant at any depth (not just direct children).
  const allIds = await getDescendantCategoryIds(category.id);

  const [{ data: allCategories }, { data: products, count }] = await Promise.all([
    supabase
      .from("categories")
      .select("*, children:categories!parent_id(*)")
      .is("parent_id", null)
      .eq("is_active", true)
      .order("display_order"),
    applyProductSort(
      supabase
        .from("products")
        .select("*, category:categories(*)", { count: "exact" })
        .eq("is_active", true)
        .in("category_id", allIds),
      sort ?? null
    ).limit(100),
  ]);

  return (
    <Suspense fallback={<div className="min-h-screen" />}>
      <CatalogClient
        initialProducts={products ?? []}
        totalCount={count ?? 0}
        categories={(allCategories ?? []) as CategoryWithChildren[]}
        pageTitle={category.name}
        pageDescription={
          category.description ||
          `${count ?? 0} collectibles in ${category.name}`
        }
      />
    </Suspense>
  );
}
