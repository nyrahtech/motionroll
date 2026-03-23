import { beforeEach, describe, expect, it, vi } from "vitest";

const requireAuth = vi.fn();
const archiveProject = vi.fn();
const restoreProject = vi.fn();
const duplicateProject = vi.fn();
const getProjectById = vi.fn();
const getPublishReadiness = vi.fn();
const createPublishedSnapshot = vi.fn();
const buildProjectManifest = vi.fn();
const publishRateLimiterCheck = vi.fn();

vi.mock("@/lib/auth", () => ({
  requireAuth,
}));

vi.mock("@/lib/data/projects", () => ({
  archiveProject,
  restoreProject,
  duplicateProject,
  getProjectById,
  getPublishReadiness,
}));

vi.mock("@/lib/manifest", () => ({
  buildProjectManifest,
}));

vi.mock("@/lib/publish/publish-version", () => ({
  createPublishedSnapshot,
}));

vi.mock("@/lib/rate-limiter", () => ({
  publishRateLimiter: {
    check: publishRateLimiterCheck,
  },
  getClientIdentifier: vi.fn(),
}));

describe("private project routes", () => {
  beforeEach(() => {
    vi.resetModules();
    requireAuth.mockReset();
    archiveProject.mockReset();
    restoreProject.mockReset();
    duplicateProject.mockReset();
    getProjectById.mockReset();
    getPublishReadiness.mockReset();
    createPublishedSnapshot.mockReset();
    buildProjectManifest.mockReset();
    publishRateLimiterCheck.mockReset();

    requireAuth.mockResolvedValue({
      userId: "user_test_123",
      email: "owner@test.local",
      name: "Test Owner",
    });
    publishRateLimiterCheck.mockReturnValue({
      ok: true,
      resetAt: Date.now() + 60_000,
    });
  });

  it("returns 404 when archiving a project the user does not own", async () => {
    archiveProject.mockResolvedValueOnce(false);

    const { POST } = await import("../[projectId]/archive/route");
    const response = await POST(new Request("http://localhost", { method: "POST" }), {
      params: Promise.resolve({ projectId: "missing-project" }),
    });

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({ error: "Not found" });
    expect(archiveProject).toHaveBeenCalledWith("missing-project", "user_test_123");
  });

  it("returns 404 when restoring a project the user does not own", async () => {
    restoreProject.mockResolvedValueOnce(false);

    const { POST } = await import("../[projectId]/restore/route");
    const response = await POST(new Request("http://localhost", { method: "POST" }), {
      params: Promise.resolve({ projectId: "missing-project" }),
    });

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({ error: "Not found" });
    expect(restoreProject).toHaveBeenCalledWith("missing-project", "user_test_123");
  });

  it("returns 404 when duplicating a project the user does not own", async () => {
    duplicateProject.mockResolvedValueOnce(null);

    const { POST } = await import("../[projectId]/duplicate/route");
    const response = await POST(new Request("http://localhost", { method: "POST" }), {
      params: Promise.resolve({ projectId: "missing-project" }),
    });

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({ error: "Not found" });
    expect(duplicateProject).toHaveBeenCalledWith("missing-project", "user_test_123");
  });

  it("returns 404 when loading a manifest for a project the user does not own", async () => {
    getProjectById.mockResolvedValueOnce(null);

    const { GET } = await import("../[projectId]/manifest/route");
    const response = await GET(new Request("http://localhost"), {
      params: Promise.resolve({ projectId: "missing-project" }),
    });

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({ error: "Not found" });
    expect(buildProjectManifest).not.toHaveBeenCalled();
  });

  it("returns 404 publish readiness when the project does not exist for the current user", async () => {
    getPublishReadiness.mockResolvedValueOnce({
      ready: false,
      blockedCount: 1,
      warningCount: 0,
      checks: [{ id: "project-missing", label: "Project lookup", status: "blocked" }],
      reasons: ["Project was not found."],
    });

    const { GET } = await import("../[projectId]/publish/readiness/route");
    const response = await GET(new Request("http://localhost"), {
      params: Promise.resolve({ projectId: "missing-project" }),
    });

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({
      ready: false,
      checks: [{ id: "project-missing" }],
    });
  });

  it("returns 404 publish when the project does not exist for the current user", async () => {
    getPublishReadiness.mockResolvedValueOnce({
      ready: false,
      blockedCount: 1,
      warningCount: 0,
      checks: [{ id: "project-missing", label: "Project lookup", status: "blocked" }],
      reasons: ["Project was not found."],
    });

    const { POST } = await import("../[projectId]/publish/route");
    const response = await POST(new Request("http://localhost", { method: "POST" }), {
      params: Promise.resolve({ projectId: "missing-project" }),
    });

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      readiness: {
        ready: false,
        checks: [{ id: "project-missing" }],
      },
    });
    expect(createPublishedSnapshot).not.toHaveBeenCalled();
  });
});
