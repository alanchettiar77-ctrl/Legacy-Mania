jest.mock("@/lib/repositories/hero-tile-repository", () => ({
  listHeroTiles: jest.fn(),
  listActiveHeroTiles: jest.fn(),
  getHeroTile: jest.fn(),
  getMaxDisplayOrder: jest.fn(),
  insertHeroTile: jest.fn(),
  updateHeroTile: jest.fn(),
  softDeleteHeroTile: jest.fn(),
  reorderHeroTiles: jest.fn(),
}));

import * as repo from "@/lib/repositories/hero-tile-repository";
import { getHomepageHeroTiles, createHeroTile } from "@/lib/services/hero-tile-service";
import { DEFAULT_HERO_TILES } from "@/lib/utils/hero-tile-defaults";

describe("hero-tile-service", () => {
  beforeEach(() => jest.clearAllMocks());

  it("getHomepageHeroTiles returns the active tiles on success", async () => {
    (repo.listActiveHeroTiles as jest.Mock).mockResolvedValue([{ id: "t1" }]);
    expect(await getHomepageHeroTiles()).toEqual([{ id: "t1" }]);
  });

  it("getHomepageHeroTiles returns DEFAULT_HERO_TILES when no rows exist at all (nothing ever configured)", async () => {
    (repo.listActiveHeroTiles as jest.Mock).mockResolvedValue([]);
    (repo.listHeroTiles as jest.Mock).mockResolvedValue([]);
    expect(await getHomepageHeroTiles()).toEqual(DEFAULT_HERO_TILES);
  });

  it("getHomepageHeroTiles returns [] when rows exist but the admin deactivated all of them", async () => {
    (repo.listActiveHeroTiles as jest.Mock).mockResolvedValue([]);
    (repo.listHeroTiles as jest.Mock).mockResolvedValue([{ id: "t1", is_active: false }]);
    expect(await getHomepageHeroTiles()).toEqual([]);
  });

  it("getHomepageHeroTiles swallows errors and returns DEFAULT_HERO_TILES", async () => {
    (repo.listActiveHeroTiles as jest.Mock).mockRejectedValue(new Error("relation does not exist"));
    await expect(getHomepageHeroTiles()).resolves.toEqual(DEFAULT_HERO_TILES);
  });

  it("createHeroTile assigns the next display_order when none is given", async () => {
    (repo.getMaxDisplayOrder as jest.Mock).mockResolvedValue(3);
    (repo.insertHeroTile as jest.Mock).mockResolvedValue({ id: "t1", display_order: 4 });

    await createHeroTile(
      { label: "Ash", icon_emoji: "🎒", color_theme: "sunrise", link_type: "category", link_value: "pokemon" } as never,
      "admin-1"
    );

    expect(repo.insertHeroTile).toHaveBeenCalledWith(
      expect.objectContaining({ display_order: 4, created_by: "admin-1", updated_by: "admin-1" })
    );
  });
});
