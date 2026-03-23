import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

type DraftOverlay = {
  id: string;
  content?: {
    type?: string;
    text?: string;
    parentGroupId?: string;
  };
};

type ProjectDraftResponse = {
  draft?: {
    overlays?: DraftOverlay[];
  };
};

async function skipIfWorkspaceDegraded(page: Page) {
  const unavailable = page.getByText(/projects are temporarily unavailable/i);
  if (await unavailable.isVisible().catch(() => false)) {
    test.skip(true, "Workspace data is unavailable in this environment.");
  }
}

async function getDraftOverlays(
  request: APIRequestContext,
  projectId: string,
): Promise<DraftOverlay[]> {
  const response = await request.get(`/api/projects/${projectId}/draft`);
  expect(response.ok()).toBeTruthy();
  const body = (await response.json()) as ProjectDraftResponse;
  return body.draft?.overlays ?? [];
}

async function fillSelectedOverlayText(page: Page, value: string) {
  const textArea = page.getByLabel("Overlay text");
  await expect(textArea).toBeVisible();
  await textArea.fill(value);
}

function getClip(page: Page, label: string) {
  return page.locator(".motionroll-clip").filter({ hasText: label }).first();
}

test.describe("Editor grouping flow", () => {
  test("signed-in users can group and ungroup text blocks", async ({
    page,
    request,
  }) => {
    test.slow();

    const projectsResponse = await request.get("/api/projects");
    if (!projectsResponse.ok()) {
      test.skip(true, "Projects API is unavailable in this environment.");
    }

    await page.goto("/library");
    await page.waitForLoadState("networkidle");
    await skipIfWorkspaceDegraded(page);

    await page.getByRole("button", { name: /new project/i }).first().click();
    await expect(page).toHaveURL(/\/projects\/[^/]+$/, { timeout: 20_000 });

    const projectId = page.url().split("/projects/")[1];
    expect(projectId).toBeTruthy();

    const initialOverlayCount = (await getDraftOverlays(request, projectId)).length;

    const firstLabel = `Group block one ${Date.now()}`;
    const secondLabel = `Group block two ${Date.now()}`;

    await page.getByRole("button", { name: "Add Text" }).click();
    await fillSelectedOverlayText(page, firstLabel);

    await page.getByRole("button", { name: "Add Text" }).click();
    await fillSelectedOverlayText(page, secondLabel);

    await expect
      .poll(
        async () => {
          const overlays = await getDraftOverlays(request, projectId);
          return JSON.stringify({
            count: overlays.length,
            first: overlays.some((overlay) => overlay.content?.text === firstLabel),
            second: overlays.some((overlay) => overlay.content?.text === secondLabel),
          });
        },
        { timeout: 15_000 },
      )
      .toBe(
        JSON.stringify({
          count: initialOverlayCount + 2,
          first: true,
          second: true,
        }),
      );

    const firstClip = getClip(page, firstLabel);
    const secondClip = getClip(page, secondLabel);
    await expect(firstClip).toBeVisible();
    await expect(secondClip).toBeVisible();

    await secondClip.getByRole("button", { name: /open clip actions/i }).click();
    await page.getByRole("menuitem", { name: "Move to New layer" }).click();
    await expect(page.getByText("Layer 02").first()).toBeVisible();

    const groupControl = page.getByRole("button", {
      name: "Group selected items",
    }).first();

    await firstClip.click({ force: true });
    await secondClip.click({
      force: true,
      modifiers: ["ControlOrMeta"],
    });

    await expect(groupControl).toBeEnabled();
    await groupControl.click();

    await expect
      .poll(
        async () => {
          const overlays = await getDraftOverlays(request, projectId);
          const groupOverlay = overlays.find((overlay) => overlay.content?.type === "group");
          const groupedChildren = overlays.filter(
            (overlay) => overlay.content?.parentGroupId === groupOverlay?.id,
          );

          return JSON.stringify({
            count: overlays.length,
            hasGroup: Boolean(groupOverlay),
            groupedChildren: groupedChildren.length,
          });
        },
        { timeout: 15_000 },
      )
      .toBe(
        JSON.stringify({
          count: initialOverlayCount + 3,
          hasGroup: true,
          groupedChildren: 2,
        }),
      );

    const groupClip = getClip(page, "Group (2)");
    await expect(groupClip).toBeVisible();
    await groupClip.click({ force: true });
    await groupClip.getByRole("button", { name: /open clip actions/i }).click();
    await page.getByRole("menuitem", { name: "Ungroup" }).click();

    await expect
      .poll(
        async () => {
          const overlays = await getDraftOverlays(request, projectId);
          return JSON.stringify({
            count: overlays.length,
            hasGroup: overlays.some((overlay) => overlay.content?.type === "group"),
            groupedChildren: overlays.filter((overlay) => overlay.content?.parentGroupId).length,
          });
        },
        { timeout: 15_000 },
      )
      .toBe(
        JSON.stringify({
          count: initialOverlayCount + 2,
          hasGroup: false,
          groupedChildren: 0,
        }),
      );
  });
});
