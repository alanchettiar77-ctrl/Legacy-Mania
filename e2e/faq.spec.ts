import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test.describe("FAQ page", () => {
  test("renders seeded questions", async ({ page }) => {
    await page.goto("/faq");
    await expect(page.getByText("What products does Legacy Mania sell?")).toBeVisible();
    await expect(page.getByText("How can I stay updated?")).toBeVisible();
  });

  test("expands and collapses an answer on click", async ({ page }) => {
    await page.goto("/faq");
    const question = page.getByRole("button", { name: /Do you offer Cash on Delivery/i });
    const answer = page.getByText(/we only accept prepaid payments/i);

    await expect(answer).not.toBeVisible();
    await question.click();
    await expect(answer).toBeVisible();
    await question.click();
    await expect(answer).not.toBeVisible();
  });

  test("has no detectable accessibility violations", async ({ page }) => {
    await page.goto("/faq");
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });

  test("renders correctly on a mobile viewport", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/faq");
    const heading = page.getByRole("heading", { name: "Frequently Asked Questions" });
    await expect(heading).toBeVisible();
    const box = await heading.boundingBox();
    expect(box?.width).toBeLessThanOrEqual(375);
  });
});
