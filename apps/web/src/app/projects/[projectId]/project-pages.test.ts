import { beforeEach, describe, expect, it, vi } from "vitest";

const requirePageAuth = vi.fn();
const getProjectById = vi.fn();
const getProjectPreset = vi.fn();
const getProjectSwitcherProjects = vi.fn();
const getPublishReadiness = vi.fn();
const buildProjectManifest = vi.fn();
const notFound = vi.fn(() => {
  throw new Error("NEXT_NOT_FOUND");
});

vi.mock("next/navigation", () => ({
  notFound,
}));

vi.mock("@/lib/auth", () => ({
  requirePageAuth,
}));

vi.mock("@/lib/data/projects", () => ({
  getProjectById,
  getProjectPreset,
  getProjectSwitcherProjects,
  getPublishReadiness,
}));

vi.mock("@/lib/manifest", () => ({
  buildProjectManifest,
}));

vi.mock("@/components/runtime/standalone-runtime", () => ({
  StandaloneRuntime: () => null,
}));

vi.mock("./project-editor-client", () => ({
  ProjectEditorClient: () => null,
}));

vi.mock("@/components/publish/publish-panel", () => ({
  PublishPanel: () => null,
}));

describe("project pages", () => {
  beforeEach(() => {
    vi.resetModules();
    requirePageAuth.mockReset();
    getProjectById.mockReset();
    getProjectPreset.mockReset();
    getProjectSwitcherProjects.mockReset();
    getPublishReadiness.mockReset();
    buildProjectManifest.mockReset();
    notFound.mockClear();

    requirePageAuth.mockResolvedValue({
      userId: "user_test_123",
      email: "owner@test.local",
      name: "Test Owner",
    });
    getProjectSwitcherProjects.mockResolvedValue([]);
  });

  it("project editor page returns notFound for a missing owned project", async () => {
    getProjectById.mockResolvedValueOnce(null);
    getProjectPreset.mockResolvedValueOnce(undefined);

    const ProjectPage = (await import("./page")).default;

    await expect(
      ProjectPage({ params: Promise.resolve({ projectId: "missing-project" }) }),
    ).rejects.toThrow("NEXT_NOT_FOUND");

    expect(buildProjectManifest).not.toHaveBeenCalled();
  });

  it("preview page returns notFound before manifest generation when the project is missing", async () => {
    getProjectById.mockResolvedValueOnce(null);

    const ProjectPreviewPage = (await import("./preview/page")).default;

    await expect(
      ProjectPreviewPage({
        params: Promise.resolve({ projectId: "missing-project" }),
        searchParams: Promise.resolve({}),
      }),
    ).rejects.toThrow("NEXT_NOT_FOUND");

    expect(buildProjectManifest).not.toHaveBeenCalled();
  });

  it("publish page returns notFound for a missing owned project", async () => {
    getProjectById.mockResolvedValueOnce(null);

    const PublishPage = (await import("./publish/page")).default;

    await expect(
      PublishPage({ params: Promise.resolve({ projectId: "missing-project" }) }),
    ).rejects.toThrow("NEXT_NOT_FOUND");

    expect(buildProjectManifest).not.toHaveBeenCalled();
    expect(getPublishReadiness).not.toHaveBeenCalled();
  });
});
