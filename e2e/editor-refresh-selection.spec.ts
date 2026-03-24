import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

type DraftOverlay = {
  id: string;
  timing: { start: number; end: number };
};

type DraftDocument = {
  title: string;
  version: number;
  overlays: DraftOverlay[];
  presetId: string;
  layerCount: number;
  sectionTitle: string;
  frameRangeStart: number;
  frameRangeEnd: number;
  scrubStrength: number;
  sectionHeightVh: number;
};

type DraftResponse = {
  draft: DraftDocument;
  revision: number;
};

type ProjectListItem = {
  id: string;
  assets?: Array<{ id: string }>;
};

async function getProjects(request: APIRequestContext) {
  const response = await request.get("/api/projects");
  expect(response.ok()).toBeTruthy();
  return (await response.json()) as ProjectListItem[];
}

async function getDraft(request: APIRequestContext, projectId: string) {
  const response = await request.get(`/api/projects/${projectId}/draft`);
  expect(response.ok()).toBeTruthy();
  return (await response.json()) as DraftResponse;
}

test.describe("Editor refresh selection", () => {
  test("does not show empty selection chrome for overlays hidden at load", async ({
    page,
    request,
  }) => {
    const projects = await getProjects(request);
    const project = projects.find((item) => (item.assets?.length ?? 0) > 0);
    if (!project) {
      test.skip(true, "No media-backed project is available in this environment.");
    }

    const draftResponse = await getDraft(request, project.id);
    const nextDraft = structuredClone(draftResponse.draft);

    expect(nextDraft.overlays.length).toBeGreaterThanOrEqual(2);
    nextDraft.overlays[0]!.timing = { start: 0.02, end: 0.12 };
    nextDraft.overlays[1]!.timing = { start: 0.18, end: 0.62 };

    const patchResponse = await request.patch(`/api/projects/${project.id}/draft`, {
      data: {
        draft: nextDraft,
        baseRevision: draftResponse.revision,
      },
    });
    expect(patchResponse.ok()).toBeTruthy();

    await page.goto(`/projects/${project.id}`);
    await page.waitForLoadState("networkidle");

    await expect(page.getByRole("status", { name: /save status: save/i })).toBeVisible();
    await expect(page.getByRole("button", { name: "Drag overlay" })).toHaveCount(0);
  });
});
