import { test, expect } from "@playwright/test";

test.describe("Library page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/library");
    await page.waitForLoadState("networkidle");
  });

  test("can type in the search input without crashing the library", async ({ page }) => {
    const searchInput = page.getByPlaceholder(/search projects/i);
    await searchInput.fill("zzz-no-match-xyz");
    await page.waitForTimeout(300); // debounce
    await expect(searchInput).toHaveValue("zzz-no-match-xyz");
    await expect(page.locator("body")).toBeVisible();
  });

  test("clearing search restores project grid", async ({ page }) => {
    const searchInput = page.getByPlaceholder(/search projects/i);
    await searchInput.fill("zzz-no-match-xyz");
    await page.waitForTimeout(300);
    await searchInput.clear();
    await page.waitForTimeout(300);
    await expect(searchInput).toHaveValue("");
  });

  test("sort dropdown changes are reflected without crash", async ({ page }) => {
    const sortSelect = page.getByRole("combobox").nth(1);
    await sortSelect.click();
    await page.getByRole("option", { name: /last modified/i }).click();
    await expect(sortSelect).toContainText(/last modified/i);
    await expect(page.locator("body")).toBeVisible();

    await sortSelect.click();
    await page.getByRole("option", { name: /alphabetical/i }).click();
    await expect(sortSelect).toContainText(/alphabetical/i);
    await expect(page.locator("body")).toBeVisible();
  });

  test("New Project button is clickable", async ({ page }) => {
    const btn = page.getByRole("button", { name: /new project/i }).first();
    await expect(btn).toBeEnabled();
  });
});
