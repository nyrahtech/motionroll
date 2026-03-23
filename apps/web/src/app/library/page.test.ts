import { beforeEach, describe, expect, it, vi } from "vitest";

const requirePageAuth = vi.fn();
const getRecentProjects = vi.fn();
const getDemoProjects = vi.fn();
const getArchivedProjects = vi.fn();
vi.mock("@/lib/auth", () => ({
  requirePageAuth,
}));

vi.mock("@/lib/data/projects", () => ({
  getRecentProjects,
  getDemoProjects,
  getArchivedProjects,
}));

vi.mock("@/components/library/library-page", () => ({
  LibraryPage: () => null,
}));

describe("LibraryRoute", () => {
  beforeEach(() => {
    vi.resetModules();
    requirePageAuth.mockReset();
    getRecentProjects.mockReset();
    getDemoProjects.mockReset();
    getArchivedProjects.mockReset();
    requirePageAuth.mockResolvedValue({
      userId: "user_test_123",
      email: "owner@test.local",
      name: "Test Owner",
    });
  });

  it("passes healthy workspace data through when all project queries succeed", async () => {
    const recentProjects = [{ id: "recent-1" }];
    const demoProjects = [{ id: "demo-1" }];
    const archivedProjects = [{ id: "archived-1" }];

    getRecentProjects.mockResolvedValueOnce(recentProjects);
    getDemoProjects.mockResolvedValueOnce(demoProjects);
    getArchivedProjects.mockResolvedValueOnce(archivedProjects);

    const LibraryRoute = (await import("./page")).default;
    const element = await LibraryRoute();

    expect(element.props).toMatchObject({
      recentProjects,
      demoProjects,
      archivedProjects,
      workspaceDegraded: false,
      workspaceNotice: undefined,
    });
  });

  it("passes workspaceDegraded when any project query fails", async () => {
    const recentProjects = [{ id: "recent-1" }];
    const archivedProjects = [{ id: "archived-1" }];

    getRecentProjects.mockResolvedValueOnce(recentProjects);
    getDemoProjects.mockRejectedValueOnce(new Error("db down"));
    getArchivedProjects.mockResolvedValueOnce(archivedProjects);

    const LibraryRoute = (await import("./page")).default;
    const element = await LibraryRoute();

    expect(element.props).toMatchObject({
      recentProjects,
      demoProjects: [],
      archivedProjects,
      workspaceDegraded: true,
    });
  });

  it("passes a workspace notice through when redirected back from failed project creation", async () => {
    getRecentProjects.mockResolvedValueOnce([]);
    getDemoProjects.mockResolvedValueOnce([]);
    getArchivedProjects.mockResolvedValueOnce([]);

    const LibraryRoute = (await import("./page")).default;
    const element = await LibraryRoute({
      searchParams: Promise.resolve({ workspace: "create_failed" }),
    });

    expect(element.props).toMatchObject({
      workspaceNotice: "MotionRoll couldn't create a new project right now. Try again in a moment.",
    });
  });
});
