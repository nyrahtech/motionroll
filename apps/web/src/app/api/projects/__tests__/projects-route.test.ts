import { beforeEach, describe, expect, it, vi } from "vitest";

const requireAuth = vi.fn();
const getMyProjects = vi.fn();
const createProjectFromSource = vi.fn();
const parseBody = vi.fn();

vi.mock("@/lib/auth", () => ({
  requireAuth,
}));

vi.mock("@/lib/data/projects", () => ({
  getMyProjects,
  createProjectFromSource,
}));

vi.mock("@/lib/rate-limiter", () => ({
  apiRateLimiter: {
    check: vi.fn(() => ({ ok: true, resetAt: Date.now() + 60_000 })),
  },
}));

vi.mock("@/lib/api-utils", () => ({
  parseBody,
}));

describe("/api/projects", () => {
  beforeEach(() => {
    vi.resetModules();
    requireAuth.mockReset();
    getMyProjects.mockReset();
    createProjectFromSource.mockReset();
    parseBody.mockReset();

    requireAuth.mockResolvedValue({
      userId: "user_test_123",
      email: "owner@test.local",
      name: "Test Owner",
    });
  });

  it("returns the authenticated user's recent projects", async () => {
    getMyProjects.mockResolvedValueOnce([{ id: "project_123", title: "Project" }]);

    const { GET } = await import("../route");
    const response = await GET();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual([{ id: "project_123", title: "Project" }]);
    expect(getMyProjects).toHaveBeenCalledWith("user_test_123");
  });

  it("returns retryable degraded state when workspace data is temporarily unavailable", async () => {
    getMyProjects.mockRejectedValueOnce(
      new Error("Failed query: select * from projects\ncause: connect ECONNREFUSED 127.0.0.1:5432"),
    );

    const { GET } = await import("../route");
    const response = await GET();

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      error: "Workspace data is temporarily unavailable.",
      code: "workspace_unavailable",
      retryable: true,
    });
  });

  it("creates a project for the authenticated user", async () => {
    parseBody.mockResolvedValueOnce({
      data: { source: { kind: "demo", demoId: "ocean-depth" }, title: "New Project" },
    });
    createProjectFromSource.mockResolvedValueOnce({
      id: "project_123",
      title: "New Project",
    });

    const { POST } = await import("../route");
    const response = await POST(
      new Request("http://localhost", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source: { kind: "demo", demoId: "ocean-depth" }, title: "New Project" }),
      }),
    );

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toMatchObject({
      id: "project_123",
      title: "New Project",
    });
    expect(createProjectFromSource).toHaveBeenCalledWith(
      "user_test_123",
      { kind: "demo", demoId: "ocean-depth" },
      "New Project",
    );
  });

  it("returns retryable degraded state when project creation hits a temporary backend failure", async () => {
    parseBody.mockResolvedValueOnce({
      data: { source: { kind: "blank" }, title: "New Project" },
    });
    createProjectFromSource.mockRejectedValueOnce(
      new Error("Failed query: insert into projects\ncause: connect ECONNREFUSED 127.0.0.1:5432"),
    );

    const { POST } = await import("../route");
    const response = await POST(
      new Request("http://localhost", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source: { kind: "blank" }, title: "New Project" }),
      }),
    );

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      error: "Workspace data is temporarily unavailable.",
      code: "workspace_unavailable",
      retryable: true,
    });
  });
});
