/**
 * @jest-environment node
 */
jest.mock("next/cache", () => ({ revalidateTag: jest.fn() }));
jest.mock("@/lib/repositories/branding-repository", () => ({
  getBrandingCached: jest.fn(),
  getBrandingFresh: jest.fn(),
  updateBranding: jest.fn(),
}));
jest.mock("@/lib/repositories/category-repository", () => ({
  listHomepageCategories: jest.fn(),
  listAllCategories: jest.fn(),
  updateCategoryBranding: jest.fn(),
  reorderCategories: jest.fn(),
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const brandingRepo = jest.requireMock("@/lib/repositories/branding-repository");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const categoryRepo = jest.requireMock("@/lib/repositories/category-repository");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { revalidateTag } = jest.requireMock("next/cache");

import {
  getBranding,
  updateBranding,
  updateCategoryBranding,
  reorderCategories,
  DEFAULT_BRANDING,
} from "@/lib/services/branding-service";

afterEach(() => jest.clearAllMocks());

describe("getBranding", () => {
  it("merges stored slots over defaults", async () => {
    brandingRepo.getBrandingCached.mockResolvedValue({ logo_url: "/x.png" });
    const branding = await getBranding();
    expect(branding.logo_url).toBe("/x.png");
    expect(branding.logo_hidden).toBe(false);
  });

  it("never throws — falls back to defaults on repo failure", async () => {
    brandingRepo.getBrandingCached.mockRejectedValue(new Error("db down"));
    expect(await getBranding()).toEqual(DEFAULT_BRANDING);
  });
});

describe("updateBranding", () => {
  it("merges patch, persists, revalidates the branding tag", async () => {
    brandingRepo.getBrandingFresh.mockResolvedValue({ logo_url: "/old.png" });
    const merged = await updateBranding({ logo_hidden: true }, "admin-1");

    expect(merged.logo_url).toBe("/old.png");
    expect(merged.logo_hidden).toBe(true);
    expect(brandingRepo.updateBranding).toHaveBeenCalledWith(
      expect.objectContaining({ logo_hidden: true }),
      "admin-1"
    );
    expect(revalidateTag).toHaveBeenCalledWith("branding", "max");
  });
});

describe("category branding", () => {
  it("updateCategoryBranding revalidates only when the row exists", async () => {
    categoryRepo.updateCategoryBranding.mockResolvedValue({ id: "c1" });
    await updateCategoryBranding("c1", { is_featured: true });
    expect(revalidateTag).toHaveBeenCalledWith("categories-branding", "max");

    revalidateTag.mockClear();
    categoryRepo.updateCategoryBranding.mockResolvedValue(null);
    await updateCategoryBranding("missing", { is_featured: true });
    expect(revalidateTag).not.toHaveBeenCalled();
  });

  it("reorderCategories reorders then revalidates", async () => {
    await reorderCategories(["a", "b"]);
    expect(categoryRepo.reorderCategories).toHaveBeenCalledWith(["a", "b"]);
    expect(revalidateTag).toHaveBeenCalledWith("categories-branding", "max");
  });
});
