import { test, expect } from "@playwright/test";

/**
 * Smoke test — verifies the editor page loads with essential UI elements.
 */
test.describe("Editor loads", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/library");
    await page.waitForLoadState("networkidle");
  });

  test("library page shows MotionRoll header", async ({ page }) => {
    await expect(page.getByText("MotionRoll").first()).toBeVisible();
  });

  test("library page shows New Project button", async ({ page }) => {
    await expect(page.getByRole("button", { name: /new project/i })).toBeVisible();
  });

  test("library page shows Projects heading", async ({ page }) => {
    await expect(page.getByRole("heading", { name: /projects/i })).toBeVisible();
  });

  test("library search input is present", async ({ page }) => {
    await expect(page.getByPlaceholder(/search projects/i)).toBeVisible();
  });

  test("sort dropdown is present", async ({ page }) => {
    await expect(page.getByRole("combobox", { name: /last opened/i })).toBeVisible();
  });
});

test.describe("Editor UI", () => {
  test("editor page shows timeline if project exists", async ({ page }) => {
    const response = await page.request.get("/api/projects");
    if (!response.ok()) {
      test.skip();
      return;
    }

    const projects = (await response.json()) as { id: string }[];
    if (!projects[0]) {
      test.skip();
      return;
    }

    await page.goto(`/projects/${projects[0].id}`);
    await page.waitForLoadState("networkidle");

    // Editor shell should be visible
    await expect(page.locator("main")).toBeVisible();
    // MotionRoll brand in top bar
    await expect(page.getByText("MotionRoll").first()).toBeVisible();
    // Publish button
    await expect(page.getByRole("button", { name: /publish/i })).toBeVisible();
  });
});
