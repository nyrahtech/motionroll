import { expect, test, type Page } from "@playwright/test";

async function openMotionRollDemo(page: Page) {
  await page.goto("/library");
  await page.waitForLoadState("networkidle");

  const demoLink = page.getByRole("link", { name: /open motionroll demo/i });
  if (!(await demoLink.isVisible().catch(() => false))) {
    test.skip(true, "MotionRoll demo project is not available in this environment.");
  }

  await demoLink.click();
  await expect(page).toHaveURL(/\/projects\/[^/]+$/);
  await expect(page.locator(".motionroll-overlay-root")).toHaveCount(1);
}

test.describe("Editor runtime save sync", () => {
  test("keeps the real runtime mounted while a paused edit saves", async ({ page }) => {
    const pageErrors: string[] = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));

    await openMotionRollDemo(page);

    await page.evaluate(() => {
      const overlayRoot = document.querySelector(".motionroll-overlay-root") as
        | (HTMLElement & { __motionrollMarker?: string })
        | null;
      if (!overlayRoot) {
        throw new Error("Runtime overlay root was not ready.");
      }
      overlayRoot.__motionrollMarker = "runtime-root";
    });

    const currentValue = await page.getByLabel("Overlay text").inputValue();
    const updatedValue = `${currentValue}\n\npaused save sync`;

    await page.getByLabel("Overlay text").fill(updatedValue);
    await expect(page.getByRole("status", { name: /save status: save/i })).toBeVisible({
      timeout: 15_000,
    });

    await expect(page.getByLabel("Overlay text")).toHaveValue(updatedValue);

    const rootMarker = await page.evaluate(() => {
      const overlayRoot = document.querySelector(".motionroll-overlay-root") as
        | (HTMLElement & { __motionrollMarker?: string })
        | null;
      return overlayRoot?.__motionrollMarker ?? null;
    });

    expect(rootMarker).toBe("runtime-root");
    expect(pageErrors).toEqual([]);
  });

  test("does not interrupt live playback when a media-backed edit saves", async ({ page }) => {
    const pageErrors: string[] = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));

    await openMotionRollDemo(page);

    await page.evaluate(() => {
      const overlayRoot = document.querySelector(".motionroll-overlay-root") as
        | (HTMLElement & { __motionrollMarker?: string })
        | null;
      if (!overlayRoot) {
        throw new Error("Runtime overlay root was not ready.");
      }
      overlayRoot.__motionrollMarker = "runtime-root-playing";
    });

    if (await page.getByRole("button", { name: "Start playback" }).isVisible().catch(() => false)) {
      await page.getByRole("button", { name: "Start playback" }).click();
    }
    await expect(page.getByRole("button", { name: "Pause playback" })).toBeVisible();

    await page.getByRole("button", { name: "Open project switcher" }).click();
    const titleInput = page.getByLabel("Project title");
    await expect(titleInput).toBeVisible();
    const currentValue = await titleInput.inputValue();
    const updatedValue = `${currentValue} runtime`;
    await titleInput.fill(updatedValue);

    await expect(page.getByRole("status", { name: /save status: save/i })).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByRole("button", { name: "Pause playback" })).toBeVisible();
    await expect(titleInput).toHaveValue(updatedValue);

    const rootMarker = await page.evaluate(() => {
      const overlayRoot = document.querySelector(".motionroll-overlay-root") as
        | (HTMLElement & { __motionrollMarker?: string })
        | null;
      return overlayRoot?.__motionrollMarker ?? null;
    });

    expect(rootMarker).toBe("runtime-root-playing");
    expect(pageErrors).toEqual([]);
  });
});
