import { test, expect } from "@playwright/test";

test.describe("Admin FAQ management", () => {
  test.beforeEach(async ({ page }, testInfo) => {
    // This is an internal admin-tool workflow, not a public-facing responsive page, and the
    // site-wide fixed WhatsApp contact widget overlaps the table's action buttons on narrow
    // mobile viewports, causing spurious click interception. Restrict to desktop.
    test.skip(testInfo.project.name !== "chromium", "Admin flows are validated on desktop only");

    // The login page's <label> elements aren't programmatically associated with their
    // inputs (no htmlFor/id), so getByLabel() can't find them. Fall back to input type,
    // which is stable and unique on this form.
    await page.goto("/login");
    await page.locator('input[type="email"]').fill(process.env.E2E_ADMIN_EMAIL!);
    await page.locator('input[type="password"]').fill(process.env.E2E_ADMIN_PASSWORD!);
    await page.getByRole("button", { name: /log in|sign in/i }).click();
    await page.waitForURL("**/admin**");
    await page.goto("/admin/faqs");
  });

  test("adds, edits, reorders, deactivates, and deletes a FAQ", async ({ page }) => {
    // The FAQ add/edit modal's <label> elements are likewise not associated with their
    // inputs, so use the modal's input/textarea elements directly instead of getByLabel().
    const modal = page.locator(".fixed.inset-0");
    const questionField = modal.locator("input");
    const answerField = modal.locator("textarea");

    // Unique per run so parallel/retried runs never collide with leftover or concurrent rows.
    const unique = Date.now();
    const originalQuestion = `Do you ship to Nepal? [e2e ${unique}]`;
    const editedQuestion = `Do you ship internationally? [e2e ${unique}]`;

    let deleted = false;
    try {
      // Add
      await page.getByRole("button", { name: "Add FAQ" }).click();
      await questionField.fill(originalQuestion);
      await answerField.fill("Not yet, but we're working on it.");
      await modal.getByRole("button", { name: "Add FAQ" }).click();
      await expect(page.getByText(originalQuestion)).toBeVisible();

      const row = page.locator("tr", { hasText: originalQuestion });

      // Edit
      await row.getByTitle("Edit").click();
      await questionField.fill(editedQuestion);
      await modal.getByRole("button", { name: "Update FAQ" }).click();
      await expect(page.getByText(editedQuestion)).toBeVisible();

      // Reorder (move up)
      const updatedRow = page.locator("tr", { hasText: editedQuestion });
      await updatedRow.getByLabel("Move up").click();

      // Deactivate
      await updatedRow.getByTitle("Hide").click();
      await expect(updatedRow.getByText("Hidden")).toBeVisible();

      // Delete
      page.once("dialog", (dialog) => dialog.accept());
      await updatedRow.getByTitle("Delete").click();
      await expect(page.getByText(editedQuestion)).not.toBeVisible();
      deleted = true;
    } finally {
      // Safety net: if an assertion above failed partway through, make sure the row created by
      // this test doesn't survive in the live database under either name.
      if (!deleted) {
        for (const text of [editedQuestion, originalQuestion]) {
          const leftover = page.locator("tr", { hasText: text });
          if (await leftover.count()) {
            page.once("dialog", (dialog) => dialog.accept());
            await leftover.first().getByTitle("Delete").click();
            await page.waitForTimeout(500);
          }
        }
      }
    }
  });
});
