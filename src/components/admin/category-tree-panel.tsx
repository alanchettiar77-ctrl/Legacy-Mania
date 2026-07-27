"use client";

import { useRouter } from "next/navigation";
import CategoryTree from "./category-tree";
import type { CategoryWithChildren } from "@/types";

export default function CategoryTreePanel({ initialTree }: { initialTree: CategoryWithChildren[] }) {
  const router = useRouter();
  return <CategoryTree categories={initialTree} onChanged={() => router.refresh()} />;
}
