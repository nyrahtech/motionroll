import { beforeEach, describe, expect, it, vi } from "vitest";

const requireAuth = vi.fn();
const getProjectById = vi.fn();
const buildProjectManifest = vi.fn();
const loggerError = vi.fn();

vi.mock("@/lib/auth", () => ({
  requireAuth,
}));

vi.mock("@/lib/data/projects", () => ({
  getProjectById,
}));

vi.mock("@/lib/manifest", () => ({
  buildProjectManifest,
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    error: loggerError,
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

describe("/api/projects/[projectId]/export", () => {
  beforeEach(() => {
    vi.resetModules();
    requireAuth.mockReset();
    getProjectById.mockReset();
    buildProjectManifest.mockReset();
    loggerError.mockReset();

    requireAuth.mockResolvedValue({
      userId: "user_test_123",
      email: "owner@test.local",
      name: "Test Owner",
    });
  });

  it("returns 404 when exporting a project the user does not own", async () => {
    getProjectById.mockResolvedValueOnce(null);

    const { GET } = await import("../[projectId]/export/route");
    const response = await GET(new Request("http://localhost"), {
      params: Promise.resolve({ projectId: "missing-project" }),
    });

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({ error: "Not found" });
    expect(buildProjectManifest).not.toHaveBeenCalled();
  });

  it("returns 500 when export manifest preparation fails for an owned project", async () => {
    getProjectById.mockResolvedValueOnce({ id: "project-1" });
    buildProjectManifest.mockRejectedValueOnce(new Error("manifest boom"));

    const { GET } = await import("../[projectId]/export/route");
    const response = await GET(new Request("http://localhost"), {
      params: Promise.resolve({ projectId: "project-1" }),
    });

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toMatchObject({
      error: "Failed to prepare export bundle",
    });
    expect(loggerError).toHaveBeenCalledWith(
      "Failed to build export manifest",
      expect.objectContaining({ projectId: "project-1", error: "manifest boom" }),
    );
  });
});
