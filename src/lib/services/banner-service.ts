import {
  listBanners,
  listActiveBanners,
  getBanner,
  getMaxDisplayOrder,
  insertBanner,
  updateBanner as repoUpdate,
  softDeleteBanner,
  reorderBanners,
  type BannerRow,
} from "@/lib/repositories/banner-repository";
import type { BannerCreateInput, BannerUpdateInput } from "@/lib/validation/banner";

export type { BannerRow };

/** Storefront feed. Never throws — the homepage must render without banners if Supabase
 * is unreachable or the migration hasn't been applied yet (matches getHomepageNotifications). */
export async function getHomepageBanners(): Promise<BannerRow[]> {
  try {
    return await listActiveBanners(new Date().toISOString());
  } catch (error) {
    console.error("Failed to load homepage banners", error);
    return [];
  }
}

export async function listAllBanners(): Promise<BannerRow[]> {
  return listBanners();
}

/** If both cta_url and category_id are present, cta_url wins and category_id is cleared. */
function resolveCtaPrecedence<T extends { cta_url?: string | null; category_id?: string | null }>(
  fields: T
): T {
  if (fields.cta_url && fields.category_id) {
    return { ...fields, category_id: null };
  }
  return fields;
}

export async function createBanner(
  input: BannerCreateInput,
  adminId: string
): Promise<BannerRow> {
  const display_order = input.display_order ?? (await getMaxDisplayOrder()) + 1;
  return insertBanner({
    ...resolveCtaPrecedence(input),
    display_order,
    created_by: adminId,
    updated_by: adminId,
  });
}

export async function updateBannerById(
  id: string,
  patch: BannerUpdateInput,
  adminId: string
): Promise<BannerRow | null> {
  // resolveCtaPrecedence only sees fields in this call's patch. A partial update that
  // touches only cta_url or only category_id can't see the row's existing value for the
  // other field, so the precedence check must run against the merged (current + patch)
  // state, not the patch alone — otherwise a single-field edit can leave both set in the DB.
  if ("cta_url" in patch || "category_id" in patch) {
    const current = await getBanner(id);
    if (!current) return null;
    const merged = resolveCtaPrecedence({
      cta_url: "cta_url" in patch ? patch.cta_url : current.cta_url,
      category_id: "category_id" in patch ? patch.category_id : current.category_id,
    });
    return repoUpdate(id, { ...patch, ...merged, updated_by: adminId });
  }
  return repoUpdate(id, { ...patch, updated_by: adminId });
}

export async function deleteBanner(id: string, adminId: string): Promise<boolean> {
  return softDeleteBanner(id, adminId);
}

/** Copies an existing banner as an inactive draft appended at the end. */
export async function duplicateBanner(
  id: string,
  adminId: string
): Promise<BannerRow | null> {
  const source = await getBanner(id);
  if (!source) return null;
  const {
    id: _id,
    created_at: _c,
    updated_at: _u,
    deleted_at: _d,
    created_by: _cb,
    updated_by: _ub,
    display_order: _o,
    ...fields
  } = source;
  return insertBanner({
    ...fields,
    title: `${source.title} (Copy)`,
    is_active: false,
    display_order: (await getMaxDisplayOrder()) + 1,
    created_by: adminId,
    updated_by: adminId,
  });
}

export async function reorder(ids: string[], adminId: string): Promise<void> {
  return reorderBanners(ids, adminId);
}
