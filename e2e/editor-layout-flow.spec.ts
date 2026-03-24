import { expect, test, type APIRequestContext, type Locator, type Page } from "@playwright/test";

type DraftOverlay = {
  id: string;
  content?: {
    text?: string;
    layout?: {
      x?: number;
      y?: number;
      width?: number;
      height?: number;
    };
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

async function waitForOverlay(
  request: APIRequestContext,
  projectId: string,
  predicate: (overlay: DraftOverlay) => boolean,
) {
  await expect
    .poll(
      async () => {
        const overlays = await getDraftOverlays(request, projectId);
        return overlays.find(predicate) ?? null;
      },
      { timeout: 15_000 },
    )
    .not.toBeNull();

  const overlays = await getDraftOverlays(request, projectId);
  const overlay = overlays.find(predicate);
  expect(overlay).toBeTruthy();
  return overlay!;
}

async function dragLocator(page: Page, locatorQuery: Locator, delta: { x: number; y: number }) {
  const box = await locatorQuery.boundingBox();
  expect(box).toBeTruthy();
  await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
  await page.mouse.down();
  await page.mouse.move(box!.x + box!.width / 2 + delta.x, box!.y + box!.height / 2 + delta.y, {
    steps: 14,
  });
  await page.mouse.up();
}

test.describe("Editor layout flow", () => {
  test("signed-in users can move and resize a text block", async ({ page, request }) => {
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

    const overlayLabel = `Layout block ${Date.now()}`;
    await page.getByRole("button", { name: "Add Text" }).click();
    await expect(page.getByLabel("Overlay text")).toBeVisible();
    await page.getByLabel("Overlay text").fill(overlayLabel);

    const initialOverlay = await waitForOverlay(
      request,
      projectId,
      (overlay) => overlay.content?.text === overlayLabel,
    );

    const overlayId = initialOverlay.id ?? (await getDraftOverlays(request, projectId)).find(
      (overlay) => overlay.content?.text === overlayLabel,
    )?.id;
    expect(overlayId).toBeTruthy();

    const beforeMove = (await getDraftOverlays(request, projectId)).find((overlay) => overlay.id === overlayId);
    expect(typeof beforeMove?.content?.layout?.x).toBe("number");
    expect(typeof beforeMove?.content?.layout?.y).toBe("number");

    await dragLocator(page, page.getByRole("button", { name: "Drag overlay" }), { x: 140, y: 80 });

    await expect(page.getByRole("status", { name: /save status: save/i })).toBeVisible({ timeout: 15_000 });

    const afterMove = await waitForOverlay(
      request,
      projectId,
      (overlay) =>
        overlay.id === overlayId &&
        (overlay.content?.layout?.x ?? 0) > (beforeMove?.content?.layout?.x ?? 0) + 0.03 &&
        (overlay.content?.layout?.y ?? 0) > (beforeMove?.content?.layout?.y ?? 0) + 0.03,
    );
    expect((afterMove?.content?.layout?.x ?? 0)).toBeGreaterThan((beforeMove?.content?.layout?.x ?? 0) + 0.03);
    expect((afterMove?.content?.layout?.y ?? 0)).toBeGreaterThan((beforeMove?.content?.layout?.y ?? 0) + 0.03);

    const widthBeforeResize = afterMove?.content?.layout?.width ?? 0;
    const heightBeforeResize = afterMove?.content?.layout?.height ?? 0;

    await dragLocator(
      page,
      page.getByRole("button", { name: "Resize overlay south east" }),
      { x: 160, y: 90 },
    );

    await expect(page.getByRole("status", { name: /save status: save/i })).toBeVisible({ timeout: 15_000 });

    const resizedOverlay = await waitForOverlay(
      request,
      projectId,
      (overlay) =>
        overlay.id === overlayId &&
        (overlay.content?.layout?.width ?? 0) > widthBeforeResize + 100 &&
        (overlay.content?.layout?.height ?? 0) > heightBeforeResize + 50,
    );
    expect((resizedOverlay?.content?.layout?.width ?? 0)).toBeGreaterThan(widthBeforeResize + 100);
    expect((resizedOverlay?.content?.layout?.height ?? 0)).toBeGreaterThan(heightBeforeResize + 50);
  });
});
