import { beforeEach, describe, expect, it, vi } from "vitest";

const requireAuth = vi.fn();
const parseBody = vi.fn();
const getRemoteProjectDraftSnapshot = vi.fn();
const saveRemoteProjectDraft = vi.fn();
const loggerError = vi.fn();

vi.mock("@/lib/auth", () => ({
  requireAuth,
}));

vi.mock("@/lib/api-utils", () => ({
  parseBody,
}));

vi.mock("@/lib/data/project-drafts", () => ({
  getRemoteProjectDraftSnapshot,
  saveRemoteProjectDraft,
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    error: loggerError,
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

function makeSnapshot(overrides: Partial<{
  revision: number;
  updatedAt: string;
}> = {}) {
  return {
    draft: {
      version: 1,
      title: "Draft Project",
      presetId: "product-reveal",
      sectionTitle: "Scene 01",
      sceneEnterTransition: { preset: "none", duration: 0.4 },
      sceneExitTransition: { preset: "none", duration: 0.4 },
      sectionHeightVh: 240,
      scrubStrength: 1,
      frameRangeStart: 0,
      frameRangeEnd: 180,
      layerCount: 1,
      overlays: [],
    },
    revision: 3,
    updatedAt: "2026-03-22T12:00:00.000Z",
    ...overrides,
  };
}

describe("/api/projects/[projectId]/draft", () => {
  beforeEach(() => {
    vi.resetModules();
    requireAuth.mockReset();
    parseBody.mockReset();
    getRemoteProjectDraftSnapshot.mockReset();
    saveRemoteProjectDraft.mockReset();
    loggerError.mockReset();

    requireAuth.mockResolvedValue({
      userId: "user_test_123",
      email: "owner@test.local",
      name: "Test Owner",
    });
  });

  it("returns the authenticated user's remote checkpoint snapshot", async () => {
    getRemoteProjectDraftSnapshot.mockResolvedValueOnce(makeSnapshot());

    const { GET } = await import("../[projectId]/draft/route");
    const response = await GET(new Request("http://localhost"), {
      params: Promise.resolve({ projectId: "project_123" }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      draft: { title: "Draft Project" },
      revision: 3,
    });
    expect(getRemoteProjectDraftSnapshot).toHaveBeenCalledWith("project_123", "user_test_123");
  });

  it("returns 404 when the authenticated user does not own the project draft", async () => {
    getRemoteProjectDraftSnapshot.mockResolvedValueOnce(null);

    const { GET } = await import("../[projectId]/draft/route");
    const response = await GET(new Request("http://localhost"), {
      params: Promise.resolve({ projectId: "missing_project" }),
    });

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({ error: "Not found" });
  });

  it("returns 503 with retryable metadata when loading the draft snapshot fails transiently", async () => {
    getRemoteProjectDraftSnapshot.mockRejectedValueOnce(new Error("manifest unavailable"));

    const { GET } = await import("../[projectId]/draft/route");
    const response = await GET(new Request("http://localhost"), {
      params: Promise.resolve({ projectId: "project_123" }),
    });

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      error: "Draft temporarily unavailable",
      code: "draft_unavailable",
      retryable: true,
    });
    expect(loggerError).toHaveBeenCalledWith(
      "Draft service unavailable",
      expect.objectContaining({
        projectId: "project_123",
        action: "load",
        error: "manifest unavailable",
      }),
    );
  });

  it("returns 404 when saving a checkpoint for a project the user does not own", async () => {
    parseBody.mockResolvedValueOnce({
      data: {
        draft: makeSnapshot().draft,
        baseRevision: 3,
      },
    });
    saveRemoteProjectDraft.mockResolvedValueOnce({
      ok: false,
      notFound: true,
    });

    const { POST } = await import("../[projectId]/draft/route");
    const response = await POST(
      new Request("http://localhost", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ draft: makeSnapshot().draft, baseRevision: 3 }),
      }),
      { params: Promise.resolve({ projectId: "missing_project" }) },
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({ error: "Not found" });
    expect(saveRemoteProjectDraft).toHaveBeenCalledWith(
      "missing_project",
      "user_test_123",
      makeSnapshot().draft,
      { baseRevision: 3 },
    );
  });

  it("returns 503 with retryable metadata when saving the checkpoint fails transiently", async () => {
    parseBody.mockResolvedValueOnce({
      data: {
        draft: makeSnapshot().draft,
        baseRevision: 3,
      },
    });
    saveRemoteProjectDraft.mockRejectedValueOnce(new Error("database unavailable"));

    const { POST } = await import("../[projectId]/draft/route");
    const response = await POST(
      new Request("http://localhost", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ draft: makeSnapshot().draft, baseRevision: 3 }),
      }),
      { params: Promise.resolve({ projectId: "project_123" }) },
    );

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      error: "Draft temporarily unavailable",
      code: "draft_unavailable",
      retryable: true,
    });
  });

  it("returns metadata-only conflict details on checkpoint revision mismatch", async () => {
    const snapshot = makeSnapshot({ revision: 7, updatedAt: "2026-03-22T12:05:00.000Z" });
    parseBody.mockResolvedValueOnce({
      data: {
        draft: snapshot.draft,
        baseRevision: 6,
      },
    });
    saveRemoteProjectDraft.mockResolvedValueOnce({
      ok: false,
      conflict: true,
      snapshot,
    });

    const { POST } = await import("../[projectId]/draft/route");
    const response = await POST(
      new Request("http://localhost", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ draft: snapshot.draft, baseRevision: 6 }),
      }),
      { params: Promise.resolve({ projectId: "project_123" }) },
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      conflict: true,
      revision: 7,
      updatedAt: "2026-03-22T12:05:00.000Z",
    });
  });

  it("persists the authenticated user's draft through the checkpoint POST route", async () => {
    const snapshot = makeSnapshot({ revision: 4, updatedAt: "2026-03-22T12:10:00.000Z" });
    parseBody.mockResolvedValueOnce({
      data: {
        draft: snapshot.draft,
        baseRevision: 3,
      },
    });
    saveRemoteProjectDraft.mockResolvedValueOnce({
      ok: true,
      snapshot,
    });

    const { POST } = await import("../[projectId]/draft/route");
    const response = await POST(
      new Request("http://localhost", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ draft: snapshot.draft, baseRevision: 3 }),
      }),
      { params: Promise.resolve({ projectId: "project_123" }) },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      revision: 4,
      updatedAt: "2026-03-22T12:10:00.000Z",
    });
  });
});
