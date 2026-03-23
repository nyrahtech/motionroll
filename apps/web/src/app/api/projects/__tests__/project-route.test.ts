import { beforeEach, describe, expect, it, vi } from "vitest";

const requireAuth = vi.fn();
const getProjectById = vi.fn();
const renameProject = vi.fn();
const parseBody = vi.fn();
const mockFindFirst = vi.fn();
const mockUpdate = vi.fn();

vi.mock("@/lib/auth", () => ({
  requireAuth,
}));

vi.mock("@/lib/data/projects", () => ({
  getProjectById,
  renameProject,
}));

vi.mock("@/lib/api-utils", () => ({
  parseBody,
}));

vi.mock("@/db/client", () => ({
  db: {
    query: {
      projectAssets: { findFirst: mockFindFirst },
    },
    update: mockUpdate,
    insert: vi.fn(),
  },
}));

vi.mock("@/lib/env", () => ({
  env: {
    STORAGE_BUCKET: "test-bucket",
    STORAGE_REGION: "auto",
    STORAGE_ENDPOINT: "http://localhost:9000",
    STORAGE_PUBLIC_BASE_URL: "http://localhost:9000/test-bucket",
    STORAGE_ACCESS_KEY_ID: "test",
    STORAGE_SECRET_ACCESS_KEY: "test",
    DATABASE_URL: "postgres://test",
    DIRECT_URL: "postgres://test",
    UPLOAD_MAX_VIDEO_BYTES: 100_000_000,
    SOURCE_RETENTION_DEFAULT: "delete_after_success",
  },
}));

vi.mock("@/lib/processing-dispatch", () => ({ dispatchProcessingJob: vi.fn() }));
vi.mock("@/lib/project-assets", () => ({ getSourceAssetValidationError: vi.fn(() => null) }));
vi.mock("@/db/schema", () => ({
  projects: {},
  projectSections: {},
  projectOverlays: {},
  projectAssets: {},
  processingJobs: {},
}));
vi.mock("drizzle-orm", () => ({ and: vi.fn(), eq: vi.fn() }));

describe("/api/projects/[projectId]", () => {
  beforeEach(() => {
    vi.resetModules();
    requireAuth.mockResolvedValue({
      userId: "user_test_123",
      email: "owner@test.local",
      name: "Test Owner",
    });
    getProjectById.mockReset();
    renameProject.mockReset();
    parseBody.mockReset();
    mockFindFirst.mockReset();
    mockUpdate.mockReset();
  });

  it("returns 404 for an unknown project", async () => {
    getProjectById.mockResolvedValueOnce(null);

    const { GET } = await import("../[projectId]/route");
    const response = await GET(new Request("http://localhost"), {
      params: Promise.resolve({ projectId: "missing-project" }),
    });

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({ error: "Not found" });
    expect(getProjectById).toHaveBeenCalledWith("missing-project", "user_test_123");
  });

  it("returns the authenticated user's project", async () => {
    getProjectById.mockResolvedValueOnce({
      id: "existing-id",
      title: "Test Project",
      ownerId: "user_test_123",
    });

    const { GET } = await import("../[projectId]/route");
    const response = await GET(new Request("http://localhost"), {
      params: Promise.resolve({ projectId: "existing-id" }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ id: "existing-id" });
    expect(getProjectById).toHaveBeenCalledWith("existing-id", "user_test_123");
  });

  it("rejects patch payloads that do not match the title-only schema", async () => {
    parseBody.mockResolvedValueOnce(
      {
        error: new Response(JSON.stringify({ error: "Invalid request body" }), { status: 400 }),
      },
    );

    const { PATCH } = await import("../[projectId]/route");
    const response = await PATCH(
      new Request("http://localhost", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ownerId: "hacker-id" }),
      }),
      { params: Promise.resolve({ projectId: "existing-id" }) },
    );

    expect(response.status).toBe(400);
    expect(renameProject).not.toHaveBeenCalled();
  });

  it("renames the authenticated user's project", async () => {
    parseBody.mockResolvedValueOnce({
      data: { title: "Updated Title" },
    });
    renameProject.mockResolvedValueOnce({
      id: "existing-id",
      title: "Updated Title",
      ownerId: "user_test_123",
    });

    const { PATCH } = await import("../[projectId]/route");
    const response = await PATCH(
      new Request("http://localhost", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Updated Title" }),
      }),
      { params: Promise.resolve({ projectId: "existing-id" }) },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      project: { id: "existing-id", title: "Updated Title" },
    });
    expect(renameProject).toHaveBeenCalledWith("existing-id", "user_test_123", "Updated Title");
  });
});
