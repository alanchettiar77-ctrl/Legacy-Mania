import { getCategoryTreeForAdmin } from "@/lib/services/catalog-service";

function flatten(tree: Awaited<ReturnType<typeof getCategoryTreeForAdmin>>): { id: string; name: string }[] {
  return tree.flatMap((cat) => [{ id: cat.id, name: cat.name }, ...flatten(cat.children ?? [])]);
}

import CategoryForm from "@/components/admin/category-form";

export default async function NewCategoryPage() {
  const tree = await getCategoryTreeForAdmin();
  const flat = flatten(tree);

  return (
    <div className="max-w-lg space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">New Category</h1>
        <p className="text-muted-foreground text-sm">Works for any collection type — cards, apparel, accessories.</p>
      </div>
      <div className="bg-card border border-border rounded-2xl p-5">
        <CategoryForm parentCategories={flat} excludeCategoryIds={[]} />
      </div>
    </div>
  );
}
