import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

type ProjectDraftResponse = {
  draft?: {
    overlays?: Array<{
      id: string;
      content?: {
        text?: string;
      };
    }>;
  };
};

async function skipIfWorkspaceDegraded(page: Page) {
  const unavailable = page.getByText(/projects are temporarily unavailable/i);
  if (await unavailable.isVisible().catch(() => false)) {
    test.skip(true, "Workspace data is unavailable in this environment.");
  }
}

async function getDraftResponse(
  request: APIRequestContext,
  projectId: string,
): Promise<ProjectDraftResponse> {
  const response = await request.get(`/api/projects/${projectId}/draft`);
  expect(response.ok()).toBeTruthy();
  return (await response.json()) as ProjectDraftResponse;
}

test.describe("Editor content flow", () => {
  test("signed-in users can add, edit, and delete a text block", async ({
    page,
    request,
  }) => {
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

    const initialDraft = await getDraftResponse(request, projectId);
    const initialOverlayCount = initialDraft.draft?.overlays?.length ?? 0;
    const nextText = `Launch headline ${Date.now()}\nSupport copy for product launch`;

    await page.getByRole("button", { name: "Add Text" }).click();

    await expect(page.getByLabel("Overlay text")).toBeVisible();
    await page.getByLabel("Overlay text").fill(nextText);

    await expect
      .poll(
        async () => {
          const draftResponse = await getDraftResponse(request, projectId);
          const overlays = draftResponse.draft?.overlays ?? [];
          const matchingOverlay = overlays.find(
            (overlay) => overlay.content?.text === nextText,
          );
          return JSON.stringify({
            overlayCount: overlays.length,
            hasMatchingText: Boolean(matchingOverlay),
          });
        },
        { timeout: 15_000 },
      )
      .toBe(
        JSON.stringify({
          overlayCount: initialOverlayCount + 1,
          hasMatchingText: true,
        }),
      );

    await expect(
      page.getByRole("status", { name: /save status: saved/i }),
    ).toBeVisible({ timeout: 15_000 });

    const newClip = page.locator(".motionroll-clip", {
      hasText: nextText.split("\n")[0]!,
    });
    await expect(newClip).toBeVisible();
    await newClip.getByRole("button", { name: /open clip actions/i }).click();
    await page.getByRole("menuitem", { name: "Delete" }).click();

    await expect
      .poll(
        async () => {
          const draftResponse = await getDraftResponse(request, projectId);
          const overlays = draftResponse.draft?.overlays ?? [];
          const matchingOverlay = overlays.find(
            (overlay) => overlay.content?.text === nextText,
          );
          return JSON.stringify({
            overlayCount: overlays.length,
            hasMatchingText: Boolean(matchingOverlay),
          });
        },
        { timeout: 15_000 },
      )
      .toBe(
        JSON.stringify({
          overlayCount: initialOverlayCount,
          hasMatchingText: false,
        }),
      );
  });
});
