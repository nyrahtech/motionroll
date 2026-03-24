import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

type DraftOverlay = {
  id: string;
  content?: {
    text?: string;
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

test.describe("Editor save sync", () => {
  test("keeps preview DOM and selection stable when background save completes", async ({
    page,
    request,
  }) => {
    const projectsResponse = await request.get("/api/projects");
    if (!projectsResponse.ok()) {
      test.skip(true, "Projects API is unavailable in this environment.");
    }

    const pageErrors: string[] = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));

    await page.goto("/library");
    await page.waitForLoadState("networkidle");
    await skipIfWorkspaceDegraded(page);

    await page.getByRole("button", { name: /new project/i }).first().click();
    await expect(page).toHaveURL(/\/projects\/[^/]+$/, { timeout: 20_000 });

    const projectId = page.url().split("/projects/")[1];
    expect(projectId).toBeTruthy();

    const initialText = `Save sync block ${Date.now()}`;
    const updatedText = `${initialText} updated`;

    await page.getByRole("button", { name: "Add Text" }).click();
    await expect(page.getByLabel("Overlay text")).toBeVisible();
    await page.getByLabel("Overlay text").fill(initialText);

    await expect
      .poll(
        async () => {
          const overlays = await getDraftOverlays(request, projectId);
          return overlays.find((item) => item.content?.text === initialText) ?? null;
        },
        { timeout: 15_000 },
      )
      .toBeTruthy();

    const overlays = await getDraftOverlays(request, projectId);
    const createdOverlay = overlays.find((item) => item.content?.text === initialText);
    expect(createdOverlay?.id).toBeTruthy();

    expect(createdOverlay?.id).toBeTruthy();

    const dragHandle = page.getByRole("button", { name: "Drag overlay" });
    await expect(dragHandle).toBeVisible();

    await page.evaluate(
      () => {
        const dragButton = document.querySelector('button[aria-label="Drag overlay"]') as
          | (HTMLElement & { __motionrollMarker?: string })
          | null;
        if (!dragButton) {
          throw new Error("Selection chrome was not ready for save-sync verification.");
        }
        dragButton.__motionrollMarker = "drag-handle";
      },
    );

    await page.getByLabel("Overlay text").fill(updatedText);

    await expect(
      page.getByRole("status", { name: /save status: save/i }),
    ).toBeVisible({ timeout: 15_000 });

    await expect(page.getByLabel("Overlay text")).toHaveValue(updatedText);
    await expect(dragHandle).toBeVisible();

    const dragHandleMarker = await page.evaluate(() => {
      const dragButton = document.querySelector('button[aria-label="Drag overlay"]') as
          | (HTMLElement & { __motionrollMarker?: string })
          | null;
      return dragButton?.__motionrollMarker ?? null;
    });

    expect(dragHandleMarker).toBe("drag-handle");
    expect(pageErrors).toEqual([]);
  });
});
