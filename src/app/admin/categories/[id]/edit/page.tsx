import { notFound } from "next/navigation";
import { getCategoryTreeForAdmin, getDescendantCategoryIds } from "@/lib/services/catalog-service";
import CategoryForm from "@/components/admin/category-form";
import type { CategoryWithChildren } from "@/types";

function flatten(tree: CategoryWithChildren[]): CategoryWithChildren[] {
  return tree.flatMap((cat) => [cat, ...flatten(cat.children ?? [])]);
}

export default async function EditCategoryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const tree = await getCategoryTreeForAdmin();
  const flat = flatten(tree);
  const current = flat.find((c) => c.id === id);
  if (!current) notFound();

  const descendantIds = await getDescendantCategoryIds(id, { includeInactive: true });

  return (
    <div className="max-w-lg space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Edit Category</h1>
        <p className="text-muted-foreground text-sm">{current.name}</p>
      </div>
      <div className="bg-card border border-border rounded-2xl p-5">
        <CategoryForm
          parentCategories={flat.map((c) => ({ id: c.id, name: c.name }))}
          excludeCategoryIds={descendantIds}
          initialData={{
            id: current.id,
            name: current.name,
            slug: current.slug,
            description: current.description ?? "",
            parent_id: current.parent_id ?? "",
            display_order: current.display_order,
            is_active: current.is_active,
            meta_title: current.meta_title ?? "",
            meta_description: current.meta_description ?? "",
          }}
        />
      </div>
    </div>
  );
}
