import { beforeEach, describe, expect, it, vi } from "vitest";

const requirePageAuth = vi.fn();
const getMyProjects = vi.fn();
vi.mock("@/lib/auth", () => ({
  requirePageAuth,
}));

vi.mock("@/lib/data/projects", () => ({
  getMyProjects,
}));

vi.mock("@/components/library/library-page", () => ({
  LibraryPage: () => null,
}));

describe("LibraryRoute", () => {
  beforeEach(() => {
    vi.resetModules();
    requirePageAuth.mockReset();
    getMyProjects.mockReset();
    requirePageAuth.mockResolvedValue({
      userId: "user_test_123",
      email: "owner@test.local",
      name: "Test Owner",
    });
  });

  it("passes healthy workspace data through when my projects load successfully", async () => {
    const myProjects = [{ id: "project-1" }];

    getMyProjects.mockResolvedValueOnce(myProjects);

    const LibraryRoute = (await import("./page")).default;
    const element = await LibraryRoute();

    expect(element.props).toMatchObject({
      myProjects,
      workspaceDegraded: false,
      workspaceNotice: undefined,
    });
  });

  it("passes workspaceDegraded when my projects fail to load", async () => {
    getMyProjects.mockRejectedValueOnce(new Error("db down"));

    const LibraryRoute = (await import("./page")).default;
    const element = await LibraryRoute();

    expect(element.props).toMatchObject({
      myProjects: [],
      workspaceDegraded: true,
    });
  });

  it("passes a workspace notice through when redirected back from failed project creation", async () => {
    getMyProjects.mockResolvedValueOnce([]);

    const LibraryRoute = (await import("./page")).default;
    const element = await LibraryRoute({
      searchParams: Promise.resolve({ workspace: "create_failed" }),
    });

    expect(element.props).toMatchObject({
      workspaceNotice: "MotionRoll couldn't create a new project right now. Try again in a moment.",
    });
  });
});
