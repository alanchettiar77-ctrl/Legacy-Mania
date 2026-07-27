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
import { getHomepageHeroTiles } from "@/lib/services/hero-tile-service";

describe("hero-tile-service — storefront feed resilience", () => {
  beforeEach(() => jest.clearAllMocks());

  it("the storefront feed returns an empty array (not a throw) when the table doesn't exist yet", async () => {
    // Simulates migration 013 not yet being applied live — PostgREST 400s on a
    // missing table/column, exactly like the migration-012 outage this session fixed.
    (repo.listActiveHeroTiles as jest.Mock).mockRejectedValue(
      new Error("Failed to list active hero tiles: 400")
    );

    await expect(getHomepageHeroTiles()).resolves.toEqual([]);
  });

  it("the storefront feed returns an empty array when Supabase is unreachable", async () => {
    (repo.listActiveHeroTiles as jest.Mock).mockRejectedValue(new TypeError("fetch failed"));
    await expect(getHomepageHeroTiles()).resolves.toEqual([]);
  });
});
