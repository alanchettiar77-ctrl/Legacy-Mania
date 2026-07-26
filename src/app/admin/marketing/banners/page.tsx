import { listAllBanners } from "@/lib/services/banner-service";
import { createClient } from "@/lib/supabase/server";
import BannersTable from "./banners-table";

export default async function BannersPage() {
  const [banners, supabase] = await Promise.all([listAllBanners(), createClient()]);
  const { data: categories } = await supabase.from("categories").select("id, name").order("name");

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-1">Homepage Banners</h1>
      <p className="text-muted-foreground text-sm mb-6">
        Manage the promotional carousel shown below the homepage hero.
      </p>
      <BannersTable initialBanners={banners} categories={categories ?? []} />
    </div>
  );
}
