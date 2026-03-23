import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const mockInsertValues = vi.fn();
  const mockInsert = vi.fn(() => ({
    values: mockInsertValues,
  }));
  const mockProjectFindFirst = vi.fn();
  const mockProjectFindMany = vi.fn();
  const logger = {
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  };

  return {
    mockInsertValues,
    mockInsert,
    mockProjectFindFirst,
    mockProjectFindMany,
    logger,
  };
});

vi.mock("@/lib/demo-projects", () => ({
  demoProjectSeeds: [],
}));

vi.mock("@/lib/logger", () => ({
  logger: mocks.logger,
}));

vi.mock("@/lib/manifest", () => ({
  buildProjectManifest: vi.fn(),
}));

vi.mock("@/lib/utils", () => ({
  slugify: (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
}));

vi.mock("@/db/client", () => ({
  db: {
    insert: mocks.mockInsert,
    update: vi.fn(),
    delete: vi.fn(),
    query: {
      projects: {
        findFirst: mocks.mockProjectFindFirst,
        findMany: mocks.mockProjectFindMany,
      },
    },
  },
}));

vi.mock("@/db/schema", () => ({
  assetVariants: {},
  processingJobs: {},
  projectAssets: {},
  projectOverlays: {},
  projects: { id: "id", ownerId: "ownerId", slug: "slug" },
  projectSections: {},
  publishTargets: {},
  templates: {},
  users: {},
}));

vi.mock("drizzle-orm", () => ({
  and: (...clauses: unknown[]) => ({ type: "and", clauses }),
  eq: (field: unknown, value: unknown) => ({ type: "eq", field, value }),
  like: (field: unknown, value: unknown) => ({ type: "like", field, value }),
}));

function createInsertChain(resultFactory: () => Promise<unknown> | unknown) {
  return {
    onConflictDoUpdate: vi.fn().mockImplementation(resultFactory),
  };
}

describe("ensureUserWorkspace", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-22T12:00:00.000Z"));

    mocks.mockInsert.mockClear();
    mocks.mockInsertValues.mockReset();
    mocks.mockProjectFindFirst.mockReset();
    mocks.mockProjectFindMany.mockReset();
    mocks.logger.warn.mockReset();
    mocks.logger.error.mockReset();
    mocks.logger.info.mockReset();
    mocks.logger.debug.mockReset();

    mocks.mockProjectFindMany.mockResolvedValue([]);
    mocks.mockProjectFindFirst.mockImplementation(async (query?: { where?: { clauses?: Array<{ field?: string; value?: string }> } }) => {
      const clauses = query?.where?.clauses ?? [];
      const slugClause = clauses.find((clause) => clause?.field === "slug");
      if (slugClause?.value === "demo-motionroll-editor-user-123") {
        return null;
      }

      return { id: "project_123" };
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("deduplicates concurrent bootstrap requests for the same user", async () => {
    let resolveInsert!: () => void;
    const insertPromise = new Promise<void>((resolve) => {
      resolveInsert = resolve;
    });
    mocks.mockInsertValues.mockReturnValue(createInsertChain(() => insertPromise));

    const { ensureUserWorkspace } = await import("./workspace-bootstrap");
    const user = { userId: "user_123", email: "owner@test.local", name: "Owner" };

    const first = ensureUserWorkspace(user);
    const second = ensureUserWorkspace(user);

    expect(mocks.mockInsert).toHaveBeenCalledTimes(1);

    resolveInsert();
    await Promise.all([first, second]);

    expect(mocks.mockProjectFindFirst).toHaveBeenCalledTimes(1);
  });

  it("caches successful bootstrap completion for later requests", async () => {
    mocks.mockInsertValues.mockReturnValue(createInsertChain(() => Promise.resolve(undefined)));

    const { ensureUserWorkspace } = await import("./workspace-bootstrap");
    const user = { userId: "user_123", email: "owner@test.local", name: "Owner" };

    await ensureUserWorkspace(user);
    const insertCountAfterFirstBootstrap = mocks.mockInsert.mock.calls.length;
    const projectLookupCountAfterFirstBootstrap = mocks.mockProjectFindFirst.mock.calls.length;
    await ensureUserWorkspace(user);

    expect(mocks.mockInsert.mock.calls.length).toBe(insertCountAfterFirstBootstrap);
    expect(mocks.mockProjectFindFirst.mock.calls.length).toBe(projectLookupCountAfterFirstBootstrap);
    expect(mocks.logger.warn).not.toHaveBeenCalled();
  });

  it("backs off retries after a failed bootstrap attempt", async () => {
    mocks.mockInsertValues
      .mockReturnValueOnce(
        createInsertChain(async () => {
          throw new Error("connect ECONNREFUSED 127.0.0.1:5432");
        }),
      )
      .mockReturnValue(createInsertChain(() => Promise.resolve(undefined)));

    const { ensureUserWorkspace } = await import("./workspace-bootstrap");
    const user = { userId: "user_123", email: "owner@test.local", name: "Owner" };

    await ensureUserWorkspace(user);
    const insertCountDuringBackoff = mocks.mockInsert.mock.calls.length;
    await ensureUserWorkspace(user);

    expect(mocks.mockInsert.mock.calls.length).toBe(insertCountDuringBackoff);
    expect(mocks.logger.warn).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(30_000);

    await ensureUserWorkspace(user);

    expect(mocks.mockInsert.mock.calls.length).toBeGreaterThan(insertCountDuringBackoff);
  });

  it("allows a later full bootstrap to upgrade a user after minimal bootstrap", async () => {
    mocks.mockInsertValues.mockReturnValue(createInsertChain(() => Promise.resolve(undefined)));

    const { ensureUserWorkspace } = await import("./workspace-bootstrap");
    const user = { userId: "user_123", email: "owner@test.local", name: "Owner" };

    await ensureUserWorkspace(user, { mode: "minimal" });
    const insertCountAfterMinimalBootstrap = mocks.mockInsert.mock.calls.length;
    await ensureUserWorkspace(user, { mode: "full" });

    expect(mocks.mockInsert.mock.calls.length).toBeGreaterThan(insertCountAfterMinimalBootstrap);
  });
});
