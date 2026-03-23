import { expect, test, type Page } from "@playwright/test";

async function skipIfWorkspaceDegraded(page: Page) {
  const unavailable = page.getByText(/projects are temporarily unavailable/i);
  if (await unavailable.isVisible().catch(() => false)) {
    test.skip(true, "Workspace data is unavailable in this environment.");
  }
}

test.describe("Editor persistence", () => {
  test("signed-in users can create, edit, save, and reload a project", async ({
    page,
    request,
  }) => {
    const renamedTitle = `E2E Saved Project ${Date.now()}`;
    const projectsResponse = await request.get("/api/projects");
    if (!projectsResponse.ok()) {
      test.skip(true, "Projects API is unavailable in this environment.");
    }

    await page.goto("/library");
    await page.waitForLoadState("networkidle");
    await skipIfWorkspaceDegraded(page);

    await page.getByRole("button", { name: /new project/i }).first().click();
    await expect(page).toHaveURL(/\/projects\/[^/]+$/, { timeout: 20_000 });
    await expect(page.getByText("MotionRoll").first()).toBeVisible();

    const projectId = page.url().split("/projects/")[1];
    expect(projectId).toBeTruthy();

    await page.getByRole("button", { name: /open project switcher/i }).click();
    const titleInput = page.getByLabel("Project title");
    await expect(titleInput).toBeVisible();
    await titleInput.fill(renamedTitle);
    await page.getByRole("button", { name: /rename/i }).click();

    await expect
      .poll(
        async () => {
          const response = await request.get(`/api/projects/${projectId}/draft`);
          if (!response.ok()) {
            return `status:${response.status()}`;
          }
          const body = (await response.json()) as { draft?: { title?: string } };
          return body.draft?.title ?? "";
        },
        { timeout: 15_000 },
      )
      .toBe(renamedTitle);

    await expect(
      page.getByRole("status", { name: /save status: saved/i }),
    ).toBeVisible({ timeout: 15_000 });

    await page.reload();
    await page.waitForLoadState("networkidle");
    await expect(page).toHaveURL(new RegExp(`/projects/${projectId}$`));

    await page.getByRole("button", { name: /open project switcher/i }).click();
    await expect(page.getByLabel("Project title")).toHaveValue(renamedTitle);
  });
});
