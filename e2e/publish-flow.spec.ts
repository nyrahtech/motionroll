import { expect, test, type Page } from "@playwright/test";

async function skipIfWorkspaceDegraded(page: Page) {
  const unavailable = page.getByText(/projects are temporarily unavailable/i);
  if (await unavailable.isVisible().catch(() => false)) {
    test.skip(true, "Workspace data is unavailable in this environment.");
  }
}

async function getDemoProjectFromLibrary(page: Page) {
  await page.goto("/library");
  await page.waitForLoadState("networkidle");

  await skipIfWorkspaceDegraded(page);

  const demoSection = page
    .locator("section")
    .filter({ hasText: "Open something visual immediately" });
  if ((await demoSection.count()) === 0) {
    test.skip(true, "No demo project section is available in this environment.");
  }

  const projectLink = demoSection.locator("[data-project-card]").first();
  const href = await projectLink.getAttribute("href");
  if (!href) {
    test.skip(true, "No publishable demo project is available in this environment.");
  }

  const projectId = href.split("/projects/")[1];
  if (!projectId) {
    test.skip(true, "Could not resolve a demo project id from the library.");
  }

  const projectTitle = (await projectLink.getAttribute("aria-label"))
    ?.replace(/^Open\s+/i, "")
    .trim();

  return {
    projectId,
    projectTitle: projectTitle && projectTitle.length > 0 ? projectTitle : "MotionRoll project",
  };
}

async function openPublishPage(page: Page, projectId: string) {
  await page.goto(`/projects/${projectId}/publish`);
  await page.waitForLoadState("networkidle");
}

test.describe("Publish flow", () => {
  test.describe.configure({ mode: "serial" });

  test("publish page can republish a ready project", async ({
    page,
    request,
  }) => {
    const project = await getDemoProjectFromLibrary(page);

    await openPublishPage(page, project.projectId);

    await expect(
      page.getByRole("heading", { name: project.projectTitle }),
    ).toBeVisible();

    const publishButton = page.getByRole("button", { name: /^publish(ed!)?$/i });
    await expect(publishButton).toBeEnabled();
    await publishButton.click();

    await expect(
      page.getByRole("button", { name: /published!/i }),
    ).toBeVisible({ timeout: 20_000 });

    await expect
      .poll(async () => {
        const urlText = await page
          .locator("text=/http:\\/\\/localhost:3000\\/embed\\//i")
          .first()
          .textContent()
          .catch(() => null);
        return urlText?.trim() ?? "";
      })
      .not.toBe("");

    await expect
      .poll(
        async () => {
          const previewUrlText = await page
            .locator("text=/http:\\/\\/localhost:3000\\/embed\\//i")
            .first()
            .textContent();
          const slug = previewUrlText?.trim().split("/embed/")[1];
          if (!slug) {
            return "";
          }

          const manifestRes = await request.get(`/api/publish/${slug}`);
          if (!manifestRes.ok()) {
            return `status:${manifestRes.status()}`;
          }

          const body = (await manifestRes.json()) as {
            manifest?: { project?: { id?: string } };
          };
          return body.manifest?.project?.id ?? "";
        },
        { timeout: 20_000 },
      )
      .toBe(project.projectId);
  });
});
