import Link from "next/link";
import { Plus } from "lucide-react";
import CategoryForm from "@/components/admin/category-form";
import CategoryTreePanel from "@/components/admin/category-tree-panel";
import { getCategoryTreeForAdmin } from "@/lib/services/catalog-service";

export default async function AdminCategoriesPage() {
  const tree = await getCategoryTreeForAdmin();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Categories</h1>
          <p className="text-muted-foreground text-sm">
            Manage catalog hierarchy — any depth, any collection type
          </p>
        </div>
        <Link href="/admin/categories/new" className="btn-primary flex items-center gap-2 px-4 py-2 text-sm">
          <Plus className="w-4 h-4" /> New Category
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-card border border-border rounded-2xl p-5">
          <h2 className="font-bold mb-4">Quick Add (top-level or pick a parent)</h2>
          <CategoryForm parentCategories={tree.flatMap((c) => [c, ...(c.children ?? [])])} excludeCategoryIds={[]} />
        </div>

        <div className="bg-card border border-border rounded-2xl p-5">
          <h2 className="font-bold mb-4">All Categories</h2>
          <CategoryTreePanel initialTree={tree} />
        </div>
      </div>
    </div>
  );
}
