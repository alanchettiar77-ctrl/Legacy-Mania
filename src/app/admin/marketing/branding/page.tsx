import { getBrandingForAdmin, getAllCategoriesForAdmin } from "@/lib/services/branding-service";
import type { Branding } from "@/lib/services/branding-service";
import type { Category } from "@/types";
import BrandingDashboard from "./branding-dashboard";

export const dynamic = "force-dynamic";

export default async function AdminBrandingPage() {
  // Degrades gracefully if migration 008 hasn't been applied yet.
  let branding: Branding | null = null;
  let categories: Category[] = [];
  try {
    [branding, categories] = await Promise.all([
      getBrandingForAdmin(),
      getAllCategoriesForAdmin(),
    ]);
  } catch (error) {
    console.error("Failed to load branding admin data", error);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Branding</h1>
        <p className="text-muted-foreground text-sm">
          Logo, brand assets, and category appearance — changes go live on the storefront within seconds
        </p>
      </div>
      {branding ? (
        <BrandingDashboard initialBranding={branding} initialCategories={categories} />
      ) : (
        <div className="bg-card border border-border rounded-2xl p-8 text-center text-muted-foreground">
          Branding data unavailable — has migration <code>008_branding.sql</code> been applied?
        </div>
      )}
    </div>
  );
}
