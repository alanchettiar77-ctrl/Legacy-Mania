import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { Plus, Edit } from "lucide-react";
import CategoryForm from "@/components/admin/category-form";

export default async function AdminCategoriesPage() {
  const supabase = await createClient();
  const { data: categories } = await supabase
    .from("categories")
    .select("*, parent:categories!parent_id(name)")
    .order("display_order");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Categories</h1>
          <p className="text-muted-foreground text-sm">
            Manage catalog hierarchy
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Add category form */}
        <div className="bg-card border border-border rounded-2xl p-5">
          <h2 className="font-bold mb-4">Add New Category</h2>
          <CategoryForm
            parentCategories={categories?.filter((c) => !c.parent_id) ?? []}
          />
        </div>

        {/* Category list */}
        <div className="bg-card border border-border rounded-2xl p-5">
          <h2 className="font-bold mb-4">All Categories ({categories?.length ?? 0})</h2>
          <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
            {categories?.map((cat) => (
              <div
                key={cat.id}
                className="flex items-center justify-between p-3 rounded-xl bg-accent/50 hover:bg-accent transition-colors"
              >
                <div>
                  <p className="font-medium text-sm">
                    {cat.parent_id ? "  └ " : ""}{cat.name}
                  </p>
                  <p className="text-xs text-muted-foreground font-mono">{cat.slug}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    cat.is_active
                      ? "bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300"
                      : "bg-gray-100 dark:bg-gray-800 text-gray-500"
                  }`}>
                    {cat.is_active ? "Active" : "Inactive"}
                  </span>
                  <Link
                    href={`/admin/categories/${cat.id}/edit`}
                    className="p-1.5 rounded-lg hover:bg-background transition-colors text-muted-foreground hover:text-foreground"
                  >
                    <Edit className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
