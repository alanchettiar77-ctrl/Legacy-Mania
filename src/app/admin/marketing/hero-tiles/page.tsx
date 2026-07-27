import { listAllHeroTiles } from "@/lib/services/hero-tile-service";
import { getCategoryTreeForAdmin } from "@/lib/services/catalog-service";
import HeroTilesTable from "./hero-tiles-table";
import type { Category } from "@/types";

function flattenCategories(nodes: Category[]): { id: string; name: string; slug: string }[] {
  const out: { id: string; name: string; slug: string }[] = [];
  for (const node of nodes) {
    out.push({ id: node.id, name: node.name, slug: node.slug });
    const children = (node as Category & { children?: Category[] }).children;
    if (children?.length) out.push(...flattenCategories(children));
  }
  return out;
}

export default async function HeroTilesPage() {
  const [tiles, categoryTree] = await Promise.all([listAllHeroTiles(), getCategoryTreeForAdmin()]);
  const categories = flattenCategories(categoryTree as unknown as Category[]);

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Homepage Hero Tiles</h1>
        <p className="text-sm text-muted-foreground">
          The floating tiles shown in the homepage hero section. Reorder by dragging, link them
          anywhere, hide or delete as needed.
        </p>
      </div>
      <HeroTilesTable initialTiles={tiles} categories={categories} />
    </div>
  );
}
