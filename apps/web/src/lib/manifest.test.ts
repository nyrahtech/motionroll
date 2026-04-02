import { beforeEach, describe, expect, it, vi } from "vitest";

const findProject = vi.fn();
const findOverlays = vi.fn();
const findMoments = vi.fn();
const findTransitions = vi.fn();

vi.mock("drizzle-orm", () => ({
  and: (...args: unknown[]) => args,
  asc: (value: unknown) => value,
  eq: (...args: unknown[]) => args,
}));

vi.mock("@/db/client", () => ({
  db: {
    query: {
      projects: {
        findFirst: findProject,
      },
      projectOverlays: {
        findMany: findOverlays,
      },
      projectMoments: {
        findMany: findMoments,
      },
      projectTransitions: {
        findMany: findTransitions,
      },
    },
  },
}));

vi.mock("@/db/schema", () => ({
  projectMoments: {
    projectSectionId: "projectMoments.projectSectionId",
    sortOrder: "projectMoments.sortOrder",
  },
  projectOverlays: {
    projectSectionId: "projectOverlays.projectSectionId",
    sortOrder: "projectOverlays.sortOrder",
  },
  projectSections: {
    sortOrder: "projectSections.sortOrder",
  },
  projectTransitions: {
    projectSectionId: "projectTransitions.projectSectionId",
    sortOrder: "projectTransitions.sortOrder",
  },
  projects: {
    id: "projects.id",
    ownerId: "projects.ownerId",
  },
  publishTargets: {
    id: "publishTargets.id",
  },
}));

vi.mock("@/lib/env", () => ({
  env: {
    PUBLISH_EMBED_BASE_URL: "https://publish.motionroll.test",
  },
}));

vi.mock("@/lib/project-assets", () => ({
  getDerivedAssetsSnapshot: () => [],
}));

vi.mock("./manifest-helpers", () => ({
  buildPublishTargetSummary: (input: unknown) => input,
  buildSectionManifest: ({ section }: { section: { id: string; title: string; presetId: string } }) => ({
    id: section.id,
    title: section.title,
    presetId: section.presetId,
    overlays: [],
    transitions: [],
    moments: [],
  }),
  validateProjectManifest: (manifest: unknown) => manifest,
}));

describe("buildProjectManifest", () => {
  beforeEach(() => {
    findProject.mockReset();
    findOverlays.mockReset();
    findMoments.mockReset();
    findTransitions.mockReset();
  });

  it("rejects legacy scene-based drafts instead of silently rebuilding them", async () => {
    findProject.mockResolvedValueOnce({
      id: "project-11111111-1111-1111-1111-111111111111",
      ownerId: "user_test_123",
      title: "Draft Project",
      slug: "draft-project",
      selectedPreset: "scroll-sequence",
      publishVersion: 1,
      latestPublishVersion: 1,
      lastPublishedAt: null,
      updatedAt: new Date("2026-03-28T00:00:00.000Z"),
      draftJson: {
        version: 2,
        title: "Draft Project",
        presetId: "scroll-sequence",
        scenes: [
          {
            id: "scene-fb66ce1c",
            title: "Scene 01",
            sortOrder: 0,
            sceneEnterTransition: { preset: "none", duration: 0.4 },
            sceneExitTransition: { preset: "none", duration: 0.4 },
            sectionHeightVh: 240,
            scrubStrength: 1,
            frameRangeStart: 0,
            frameRangeEnd: 180,
            layerCount: 1,
            overlays: [],
          },
        ],
      },
      sections: [],
      assets: [],
      publishTargets: [
        {
          id: "hosted-target-1",
          targetType: "hosted_embed",
          slug: "draft-project",
          isReady: false,
          publishedAt: null,
        },
      ],
    });

    const { buildProjectManifest } = await import("./manifest");
    await expect(
      buildProjectManifest(
        "project-11111111-1111-1111-1111-111111111111",
        { userId: "user_test_123", persistDraftManifest: false },
      ),
    ).rejects.toMatchObject({
      code: "unsupported_version",
      name: "UnsupportedLegacyProjectDraftError",
    });

    expect(findOverlays).not.toHaveBeenCalled();
    expect(findMoments).not.toHaveBeenCalled();
    expect(findTransitions).not.toHaveBeenCalled();
  });
});
