import { beforeEach, describe, expect, it, vi } from "vitest";

const requireAuth = vi.fn();
const getRecentProjects = vi.fn();
const createProjectFromPreset = vi.fn();
const parseBody = vi.fn();

vi.mock("@/lib/auth", () => ({
  requireAuth,
}));

vi.mock("@/lib/data/projects", () => ({
  getRecentProjects,
  createProjectFromPreset,
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
    getRecentProjects.mockReset();
    createProjectFromPreset.mockReset();
    parseBody.mockReset();

    requireAuth.mockResolvedValue({
      userId: "user_test_123",
      email: "owner@test.local",
      name: "Test Owner",
    });
  });

  it("returns the authenticated user's recent projects", async () => {
    getRecentProjects.mockResolvedValueOnce([{ id: "project_123", title: "Project" }]);

    const { GET } = await import("../route");
    const response = await GET();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual([{ id: "project_123", title: "Project" }]);
    expect(getRecentProjects).toHaveBeenCalledWith("user_test_123");
  });

  it("returns retryable degraded state when workspace data is temporarily unavailable", async () => {
    getRecentProjects.mockRejectedValueOnce(
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
      data: { presetId: "product-reveal", title: "New Project" },
    });
    createProjectFromPreset.mockResolvedValueOnce({
      id: "project_123",
      title: "New Project",
    });

    const { POST } = await import("../route");
    const response = await POST(
      new Request("http://localhost", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ presetId: "product-reveal", title: "New Project" }),
      }),
    );

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toMatchObject({
      id: "project_123",
      title: "New Project",
    });
    expect(createProjectFromPreset).toHaveBeenCalledWith(
      "user_test_123",
      "product-reveal",
      "New Project",
    );
  });

  it("returns retryable degraded state when project creation hits a temporary backend failure", async () => {
    parseBody.mockResolvedValueOnce({
      data: { presetId: "product-reveal", title: "New Project" },
    });
    createProjectFromPreset.mockRejectedValueOnce(
      new Error("Failed query: insert into projects\ncause: connect ECONNREFUSED 127.0.0.1:5432"),
    );

    const { POST } = await import("../route");
    const response = await POST(
      new Request("http://localhost", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ presetId: "product-reveal", title: "New Project" }),
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
