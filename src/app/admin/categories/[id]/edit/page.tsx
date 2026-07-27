import { notFound } from "next/navigation";
import { getCategoryTreeForAdmin } from "@/lib/services/catalog-service";
import { getDescendantCategoryIds } from "@/lib/services/catalog-service";
import CategoryForm from "@/components/admin/category-form";

function flatten(tree: Awaited<ReturnType<typeof getCategoryTreeForAdmin>>): { id: string; name: string }[] {
  return tree.flatMap((cat) => [{ id: cat.id, name: cat.name }, ...flatten(cat.children ?? [])]);
}

export default async function EditCategoryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const tree = await getCategoryTreeForAdmin();
  const flat = flatten(tree);
  const current = flat.find((c) => c.id === id);
  if (!current) notFound();

  const descendantIds = await getDescendantCategoryIds(id);

  const fullTree = await getCategoryTreeForAdmin();
  const fullFlatWithFields = fullTree.flatMap(function collect(cat: (typeof fullTree)[number]): typeof fullTree {
    return [cat, ...(cat.children ?? []).flatMap(collect)];
  });
  const source = fullFlatWithFields.find((c) => c.id === id)!;

  return (
    <div className="max-w-lg space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Edit Category</h1>
        <p className="text-muted-foreground text-sm">{current.name}</p>
      </div>
      <div className="bg-card border border-border rounded-2xl p-5">
        <CategoryForm
          parentCategories={flat}
          excludeCategoryIds={descendantIds}
          initialData={{
            id: source.id,
            name: source.name,
            slug: source.slug,
            description: source.description ?? "",
            parent_id: source.parent_id ?? "",
            display_order: source.display_order,
            is_active: source.is_active,
            meta_title: source.meta_title ?? "",
            meta_description: source.meta_description ?? "",
          }}
        />
      </div>
    </div>
  );
}
