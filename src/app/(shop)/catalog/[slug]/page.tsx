import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import CatalogClient from "../catalog-client";
import type { CategoryWithChildren } from "@/types";

interface Props {
  params: Promise<{ slug: string }>;
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

export default async function CategoryPage({ params }: Props) {
  const { slug } = await params;
  const supabase = await createClient();

  const { data: category } = await supabase
    .from("categories")
    .select("*, children:categories!parent_id(*)")
    .eq("slug", slug)
    .single();

  if (!category) notFound();

  // Collect IDs: this category + all its children
  const childIds: string[] = (category.children ?? []).map(
    (c: { id: string }) => c.id
  );
  const allIds = [category.id, ...childIds];

  const [{ data: allCategories }, { data: products, count }] = await Promise.all([
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
      .in("category_id", allIds)
      .order("created_at", { ascending: false })
      .limit(100),
  ]);

  return (
    <Suspense fallback={<div className="min-h-screen" />}>
      <CatalogClient
        initialProducts={products ?? []}
        totalCount={count ?? 0}
        categories={(allCategories ?? []) as CategoryWithChildren[]}
        searchParams={{ category: category.id }}
        pageTitle={category.name}
        pageDescription={
          category.description ||
          `${count ?? 0} collectibles in ${category.name}`
        }
      />
    </Suspense>
  );
}
