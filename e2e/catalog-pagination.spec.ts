import { test, expect } from "@playwright/test";

// Regression test for the pagination bug: CatalogClient froze `products` in
// local state on first mount, so navigating to page 2/3 changed the URL and
// the "N of TOTAL products" count but kept rendering page 1's cards.

test("catalog page 2 shows different products than page 1", async ({ page }) => {
  await page.goto("/catalog?page=1");
  const page1Names = await page.locator("main a[href^='/products/']").allTextContents();
  test.skip(page1Names.length === 0, "no products seeded in this environment");

  await page.goto("/catalog?page=2");
  await page.waitForLoadState("networkidle");
  const page2Names = await page.locator("main a[href^='/products/']").allTextContents();

  expect(page2Names.length).toBeGreaterThan(0);
  expect(page2Names).not.toEqual(page1Names);
});

test("catalog page 3 (last page) does not repeat page 2", async ({ page }) => {
  await page.goto("/catalog");
  const totalText = await page.getByText(/products across all collections|Showing \d+ of \d+ products/).first().textContent();
  const total = parseInt(totalText?.match(/(\d+)\s+products/)?.[1] ?? "0", 10);
  test.skip(total <= 48, "not enough products to exercise a 3rd page");

  await page.goto("/catalog?page=2");
  await page.waitForLoadState("networkidle");
  const page2Names = await page.locator("main a[href^='/products/']").allTextContents();

  await page.goto("/catalog?page=3");
  await page.waitForLoadState("networkidle");
  const page3Names = await page.locator("main a[href^='/products/']").allTextContents();

  expect(page3Names.length).toBeGreaterThan(0);
  expect(page3Names).not.toEqual(page2Names);
});
