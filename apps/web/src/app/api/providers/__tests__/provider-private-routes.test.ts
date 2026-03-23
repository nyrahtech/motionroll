import { beforeEach, describe, expect, it, vi } from "vitest";

const requireAuth = vi.fn();
const parseBody = vi.fn();
const mockProjectFindFirst = vi.fn();
const mockConnectionFindFirst = vi.fn();
const mockInsertValues = vi.fn();
const mockInsert = vi.fn(() => ({
  values: mockInsertValues,
}));
const uploadRateLimiterCheck = vi.fn();

vi.mock("@/lib/auth", () => ({
  requireAuth,
}));

vi.mock("@/lib/api-utils", () => ({
  parseBody,
}));

vi.mock("@/db/client", () => ({
  db: {
    query: {
      projects: { findFirst: mockProjectFindFirst },
      userProviderConnections: { findFirst: mockConnectionFindFirst },
    },
    insert: mockInsert,
    transaction: vi.fn(),
  },
}));

vi.mock("@/db/schema", () => ({
  aiGenerations: {},
  projects: {},
  userProviderConnections: {},
  projectAssets: {},
}));

vi.mock("@/lib/ai/crypto", () => ({
  decryptJsonPayload: vi.fn(() => ({ apiKey: "secret" })),
}));

vi.mock("@/lib/ai/providers", () => ({
  getAiProviderAdapter: vi.fn(() => ({
    importGeneratedAsset: vi.fn().mockResolvedValue({ sourceUrl: "https://example.com/video.mp4" }),
  })),
}));

vi.mock("@/lib/logger", () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

vi.mock("@/lib/inngest-client", () => ({
  inngest: { send: vi.fn() },
}));

vi.mock("@/lib/env", () => ({
  env: {
    PROCESSING_TEMP_DIR: "./tmp",
    SOURCE_RETENTION_DEFAULT: "delete_after_success",
  },
}));

vi.mock("@/lib/storage/s3-adapter", () => ({
  createSignedUploadUrl: vi.fn(),
  getStoragePublicUrl: vi.fn((key: string) => `https://storage.local/${key}`),
}));

vi.mock("@/lib/uploads/validation", () => ({
  validateVideoUpload: vi.fn(() => ({
    filename: "clip.mp4",
    contentType: "video/mp4",
    bytes: 1024,
  })),
}));

vi.mock("@/lib/rate-limiter", () => ({
  uploadRateLimiter: {
    check: uploadRateLimiterCheck,
  },
  getClientIdentifier: vi.fn(),
}));

vi.mock("node:fs/promises", () => ({
  mkdir: vi.fn(),
}));

vi.mock("drizzle-orm", () => ({
  and: vi.fn(),
  eq: vi.fn(),
}));

describe("provider and upload private routes", () => {
  beforeEach(() => {
    vi.resetModules();
    requireAuth.mockReset();
    parseBody.mockReset();
    mockProjectFindFirst.mockReset();
    mockConnectionFindFirst.mockReset();
    mockInsert.mockClear();
    mockInsertValues.mockReset();
    uploadRateLimiterCheck.mockReset();

    requireAuth.mockResolvedValue({
      userId: "user_test_123",
      email: "owner@test.local",
      name: "Test Owner",
    });

    uploadRateLimiterCheck.mockReturnValue({
      ok: true,
      resetAt: Date.now() + 60_000,
    });
  });

  it("returns 404 when generating against a project the user does not own", async () => {
    parseBody.mockResolvedValueOnce({
      data: {
        projectId: "00000000-0000-0000-0000-000000000123",
        prompt: "Build a hero clip",
        durationSeconds: 6,
        aspectRatio: "16:9",
        connectionId: "00000000-0000-0000-0000-000000000999",
      },
    });
    mockProjectFindFirst.mockResolvedValueOnce(null);

    const { POST } = await import("../[provider]/generate/route");
    const response = await POST(
      new Request("http://localhost", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      }),
      { params: Promise.resolve({ provider: "runway" }) },
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({ error: "Project not found." });
    expect(mockConnectionFindFirst).not.toHaveBeenCalled();
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it("returns 404 when importing into a project the user does not own", async () => {
    parseBody.mockResolvedValueOnce({
      data: {
        projectId: "00000000-0000-0000-0000-000000000123",
        assetExternalId: "asset_123",
      },
    });
    mockProjectFindFirst.mockResolvedValueOnce(null);

    const { POST } = await import("../[provider]/import/route");
    const response = await POST(
      new Request("http://localhost", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      }),
      { params: Promise.resolve({ provider: "runway" }) },
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({ error: "Project not found." });
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it("returns 404 when registering an upload for a project the user does not own", async () => {
    parseBody.mockResolvedValueOnce({
      data: {
        projectId: "00000000-0000-0000-0000-000000000123",
        filename: "clip.mp4",
        contentType: "video/mp4",
        bytes: 1024,
        sourceType: "video",
        sourceOrigin: "upload",
      },
    });
    mockProjectFindFirst.mockResolvedValueOnce(null);

    const { POST } = await import("../../uploads/register/route");
    const response = await POST(
      new Request("http://localhost", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      }),
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({ error: "Project not found." });
    expect(mockInsert).not.toHaveBeenCalled();
  });
});
