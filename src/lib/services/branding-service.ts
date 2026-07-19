import { revalidateTag } from "next/cache";
import {
  getBrandingCached,
  getBrandingFresh,
  updateBranding as repoUpdateBranding,
} from "@/lib/repositories/branding-repository";
import {
  listHomepageCategories,
  listAllCategories,
  updateCategoryBranding as repoUpdateCategory,
  reorderCategories as repoReorderCategories,
} from "@/lib/repositories/category-repository";
import type { BrandingUpdateInput, CategoryBrandingInput } from "@/lib/validation/branding";
import type { Category } from "@/types";

export interface Branding {
  logo_url: string;
  logo_hidden: boolean;
  hero_logo_url: string;
  badge_logo_url: string;
  favicon_url: string;
  apple_touch_icon_url: string;
  og_image_url: string;
  twitter_card_url: string;
  pwa_icon_url: string;
}

export const DEFAULT_BRANDING: Branding = {
  logo_url: "",
  logo_hidden: false,
  hero_logo_url: "",
  badge_logo_url: "",
  favicon_url: "",
  apple_touch_icon_url: "",
  og_image_url: "",
  twitter_card_url: "",
  pwa_icon_url: "",
};

/**
 * Storefront branding. Never throws — layouts must render (with the built-in
 * text logo) even if Supabase is unreachable or migration 008 isn't applied.
 */
export async function getBranding(): Promise<Branding> {
  try {
    const stored = await getBrandingCached();
    return { ...DEFAULT_BRANDING, ...(stored ?? {}) };
  } catch (error) {
    console.error("Failed to load branding", error);
    return DEFAULT_BRANDING;
  }
}

/** Admin read — always fresh, throws on failure so the panel can show an error. */
export async function getBrandingForAdmin(): Promise<Branding> {
  const stored = await getBrandingFresh();
  return { ...DEFAULT_BRANDING, ...(stored ?? {}) };
}

export async function updateBranding(
  patch: BrandingUpdateInput,
  adminId: string
): Promise<Branding> {
  const merged = { ...(await getBrandingForAdmin()), ...patch };
  await repoUpdateBranding(merged, adminId);
  revalidateTag("branding", "max");
  return merged;
}

export async function getHomepageCategories(): Promise<Category[]> {
  try {
    return await listHomepageCategories();
  } catch (error) {
    console.error("Failed to load homepage categories", error);
    return [];
  }
}

export async function getAllCategoriesForAdmin(): Promise<Category[]> {
  return listAllCategories();
}

export async function updateCategoryBranding(
  id: string,
  patch: CategoryBrandingInput
): Promise<Category | null> {
  const updated = await repoUpdateCategory(id, patch);
  if (updated) revalidateTag("categories-branding", "max");
  return updated;
}

export async function reorderCategories(ids: string[]): Promise<void> {
  await repoReorderCategories(ids);
  revalidateTag("categories-branding", "max");
}
