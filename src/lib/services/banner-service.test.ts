jest.mock("@/lib/repositories/banner-repository", () => ({
  listBanners: jest.fn(),
  listActiveBanners: jest.fn(),
  getBanner: jest.fn(),
  getMaxDisplayOrder: jest.fn(),
  insertBanner: jest.fn(),
  updateBanner: jest.fn(),
  softDeleteBanner: jest.fn(),
  reorderBanners: jest.fn(),
}));

import * as repo from "@/lib/repositories/banner-repository";
import {
  getHomepageBanners,
  createBanner,
  duplicateBanner,
  updateBannerById,
} from "@/lib/services/banner-service";

const mockRepo = repo as jest.Mocked<typeof repo>;

afterEach(() => jest.clearAllMocks());

describe("getHomepageBanners", () => {
  it("returns active banners", async () => {
    mockRepo.listActiveBanners.mockResolvedValue([{ id: "b1" }] as never);
    const result = await getHomepageBanners();
    expect(result).toEqual([{ id: "b1" }]);
  });

  it("never throws — returns an empty array if the repository fails", async () => {
    mockRepo.listActiveBanners.mockRejectedValue(new Error("db down"));
    const result = await getHomepageBanners();
    expect(result).toEqual([]);
  });
});

describe("createBanner", () => {
  it("assigns the next display_order and stamps created_by/updated_by", async () => {
    mockRepo.getMaxDisplayOrder.mockResolvedValue(2);
    mockRepo.insertBanner.mockResolvedValue({ id: "b1" } as never);

    await createBanner({ title: "Sale" } as never, "admin-1");

    expect(mockRepo.insertBanner).toHaveBeenCalledWith(
      expect.objectContaining({ display_order: 3, created_by: "admin-1", updated_by: "admin-1" })
    );
  });
});

describe("updateBannerById", () => {
  it("prefers an explicit cta_url over category_id when both are set in the patch", async () => {
    // This test is for the case where the patch itself contains both fields
    // getBanner is still called to fetch the current state
    mockRepo.getBanner.mockResolvedValue({
      id: "b1",
      cta_url: null,
      category_id: null,
    } as never);
    mockRepo.updateBanner.mockResolvedValue({ id: "b1" } as never);

    await updateBannerById("b1", { cta_url: "/sale", category_id: "cat-1" } as never, "admin-1");

    // cta_url should win and category_id should be null
    expect(mockRepo.updateBanner).toHaveBeenCalledWith(
      "b1",
      expect.objectContaining({ cta_url: "/sale", category_id: null })
    );
  });

  it("resolves CTA precedence against the merged row state: category_id patch with existing cta_url keeps cta_url and clears category_id", async () => {
    // Simulate a row with an existing cta_url and no category_id
    mockRepo.getBanner.mockResolvedValue({
      id: "b1",
      cta_url: "/existing-sale",
      category_id: null,
    } as never);
    mockRepo.updateBanner.mockResolvedValue({ id: "b1" } as never);

    // Patch that only sets category_id (does NOT include cta_url in the patch)
    await updateBannerById("b1", { category_id: "cat-1" } as never, "admin-1");

    // getBanner should have been called to fetch the current state for precedence resolution
    expect(mockRepo.getBanner).toHaveBeenCalledWith("b1");

    // The merged state has both cta_url and category_id, so precedence resolves:
    // cta_url wins, category_id is cleared
    expect(mockRepo.updateBanner).toHaveBeenCalledWith(
      "b1",
      expect.objectContaining({
        cta_url: "/existing-sale", // pre-existing cta_url is preserved
        category_id: null, // category_id from the patch is cleared due to precedence
      })
    );
  });

  it("skips getBanner when the patch touches neither cta_url nor category_id (optimization)", async () => {
    mockRepo.updateBanner.mockResolvedValue({ id: "b1" } as never);

    // Patch that only touches is_active, not cta_url or category_id
    await updateBannerById("b1", { is_active: false } as never, "admin-1");

    // getBanner should NOT be called since the patch doesn't touch either field
    expect(mockRepo.getBanner).not.toHaveBeenCalled();

    // updateBanner should still be called with the patch
    expect(mockRepo.updateBanner).toHaveBeenCalledWith(
      "b1",
      expect.objectContaining({ is_active: false })
    );
  });
});

describe("duplicateBanner", () => {
  it("copies the source with a (Copy) suffix, inactive, at the end of the order", async () => {
    mockRepo.getBanner.mockResolvedValue({
      id: "b1",
      title: "Sale",
      display_order: 0,
      is_active: true,
      created_at: "x",
      updated_at: "x",
      deleted_at: null,
      created_by: "admin-0",
      updated_by: "admin-0",
    } as never);
    mockRepo.getMaxDisplayOrder.mockResolvedValue(2);
    mockRepo.insertBanner.mockResolvedValue({ id: "b2" } as never);

    const result = await duplicateBanner("b1", "admin-1");

    expect(result).toEqual({ id: "b2" });
    expect(mockRepo.insertBanner).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Sale (Copy)",
        is_active: false,
        display_order: 3,
        created_by: "admin-1",
        updated_by: "admin-1",
      })
    );
  });

  it("returns null when the source doesn't exist", async () => {
    mockRepo.getBanner.mockResolvedValue(null);
    const result = await duplicateBanner("missing", "admin-1");
    expect(result).toBeNull();
    expect(mockRepo.insertBanner).not.toHaveBeenCalled();
  });
});
